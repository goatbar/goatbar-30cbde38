import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getCanvaBrandTemplateDataset,
  getValidCanvaAccessToken,
  sanitizeLog,
} from "../_shared/canva-auth.ts";
import {
  autofillAndExportPdf,
  buildAutofillData,
  getMissingCanvaMappingKeys,
  hydrateBudgetDrinks,
  normalizeProposalEventType,
  ProposalGenerationError,
} from "./logic.ts";
import { resolveProposalField } from "../../../src/lib/proposal-field-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization)
      return json({ error_code: "unauthenticated", error: "Usuário não autenticado." }, 401);
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );
    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
    if (!user)
      return json({ error_code: "unauthenticated", error: "Usuário não autenticado." }, 401);
    const { event_id: eventId, budget_version_id: budgetVersionId } = await req.json();
    if (!eventId || !budgetVersionId)
      throw new ProposalGenerationError(
        "mapping_incomplete",
        "Evento e versão do orçamento são obrigatórios.",
      );

    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();
    if (eventError || !event)
      throw new ProposalGenerationError(
        "proposal_template_not_found",
        "Evento não encontrado.",
        404,
      );
    const eventType = normalizeProposalEventType(event.event_type || "");
    const { data: template, error: templateError } = await supabaseAdmin
      .from("proposal_templates")
      .select("*")
      .eq("event_type", eventType)
      .eq("is_active", true)
      .eq("is_default", true)
      .maybeSingle();
    if (templateError || !template)
      throw new ProposalGenerationError(
        "proposal_template_not_found",
        "Nenhum modelo ativo e padrão foi encontrado para este tipo de evento.",
        404,
      );
    if (template.provider !== "canva")
      throw new ProposalGenerationError(
        "proposal_template_not_found",
        "O modelo associado a este evento não é Canva.",
        409,
      );
    if (!template.canva_brand_template_id)
      throw new ProposalGenerationError(
        "canva_template_not_configured",
        "O modelo não possui Brand Template ID configurado.",
      );

    const { data: budget, error: budgetError } = await supabaseAdmin
      .from("event_budget_versions")
      .select("*")
      .eq("id", budgetVersionId)
      .eq("event_id", eventId)
      .single();
    if (budgetError || !budget)
      throw new ProposalGenerationError(
        "mapping_incomplete",
        "A versão do orçamento selecionada não foi encontrada.",
        404,
      );
    const { resolvedDrinkNames, normalized } = await hydrateBudgetDrinks(
      budget.selected_drinks,
      supabaseAdmin,
      { event_id: eventId, budget_version_id: budgetVersionId },
    );
    console.log("[canva-generate-proposal] hydrate_selected_drinks", {
      stage: "hydrate_selected_drinks",
      event_id: eventId,
      budget_version_id: budgetVersionId,
      selected_drinks_type: normalized.rawType,
      selected_drinks_is_array: normalized.isArray,
      selected_drinks_has_ids: normalized.hasIds,
      selected_drinks_ids_count: normalized.idsCount,
      selected_drinks_ids_types: normalized.idsTypes,
      query_error_code: null,
      query_error_message: null,
    });
    const resolvedBudget = { ...budget, selected_drinks: resolvedDrinkNames };
    const { data: mappings, error: mappingsError } = await supabaseAdmin
      .from("proposal_template_field_mappings")
      .select("*")
      .eq("template_id", template.id);
    if (mappingsError)
      throw new ProposalGenerationError(
        "mapping_incomplete",
        "Não foi possível carregar os mappings.",
      );

    const token = await getValidCanvaAccessToken(user.id, supabaseAdmin);
    const dataset = await getCanvaBrandTemplateDataset(token, template.canva_brand_template_id);
    const mappingKeys = (mappings || []).map((mapping) => mapping.canva_field_key);
    const datasetKeys = dataset.fields.map((field) => field.key);
    const missingKeys = getMissingCanvaMappingKeys(mappings || [], datasetKeys);
    console.log("[canva-generate-proposal] dataset validation", {
      template_id: template.id,
      brand_template_id: template.canva_brand_template_id,
      dataset_keys: datasetKeys,
      mapping_keys: mappingKeys,
      missing_keys: missingKeys,
    });
    if (missingKeys.length > 0) {
      return json(
        {
          error_code: "canva_fields_missing",
          error: "Existem campos mapeados que não são Data Fields do Brand Template Canva.",
          missing_fields: missingKeys,
        },
        400,
      );
    }
    for (const mapping of mappings || []) {
      const raw =
        mapping.source_type === "field" && mapping.source_field_key
          ? resolveProposalField(mapping.source_field_key, {
              event,
              budget,
              hydratedData: { selectedDrinkNames: resolvedDrinkNames },
            })
          : mapping.static_value;
      console.log("[canva-generate-proposal] mapping audit", {
        stage: "resolve_mappings",
        event_id: eventId,
        budget_version_id: budgetVersionId,
        template_id: template.id,
        mapping_key: mapping.canva_field_key,
        source_key: mapping.source_field_key,
        source_type: Array.isArray(raw) ? "array" : typeof raw,
        source_count: Array.isArray(raw) ? raw.length : undefined,
        has_value: Array.isArray(raw) ? raw.length > 0 : raw != null && raw !== "",
        required: Boolean(mapping.required),
        exists_in_canva: datasetKeys.includes(mapping.canva_field_key),
      });
    }
    const autofillData = buildAutofillData(mappings || [], datasetKeys, event, resolvedBudget);
    const generated = await autofillAndExportPdf({
      token,
      brandTemplateId: template.canva_brand_template_id,
      data: autofillData,
    });
    const pdfResponse = await fetch(generated.downloadUrl);
    if (!pdfResponse.ok)
      throw new ProposalGenerationError(
        "storage_failed",
        "Não foi possível baixar o PDF temporário do Canva.",
        502,
      );
    const pdf = new Uint8Array(await pdfResponse.arrayBuffer());
    const storagePath = `propostas/${eventId}_canva_${Date.now()}.pdf`;
    const { error: storageError } = await supabaseAdmin.storage
      .from("generated-proposals")
      .upload(storagePath, pdf, { contentType: "application/pdf", upsert: false });
    if (storageError)
      throw new ProposalGenerationError(
        "storage_failed",
        "Não foi possível salvar o PDF no Storage.",
        500,
      );
    const { data: publicData } = supabaseAdmin.storage
      .from("generated-proposals")
      .getPublicUrl(storagePath);
    const proposalData = Object.fromEntries(
      Object.entries(autofillData).map(([key, value]) => [key, value.text]),
    );
    const { data: existing } = await supabaseAdmin
      .from("generated_proposals")
      .select("id")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const record = {
      event_id: eventId,
      budget_id: budget.id,
      template_id: template.id,
      proposal_data: proposalData,
      final_pdf_url: publicData.publicUrl,
      status: "downloaded",
      canva_design_id: generated.designId,
      generated_at: new Date().toISOString(),
      storage_path: storagePath,
      updated_at: new Date().toISOString(),
    };
    const query = existing?.id
      ? supabaseAdmin.from("generated_proposals").update(record).eq("id", existing.id)
      : supabaseAdmin.from("generated_proposals").insert(record);
    const { data: proposal, error: persistError } = await query.select().single();
    if (persistError)
      throw new ProposalGenerationError(
        "storage_failed",
        "PDF salvo, mas a proposta não pôde ser registrada.",
        500,
      );
    return json({
      proposal,
      canva_design_id: generated.designId,
      pdf_url: publicData.publicUrl,
      jobs: { autofill: generated.autofillJobId, export: generated.exportJobId },
    });
  } catch (error) {
    console.error("[canva-generate-proposal]", sanitizeLog(error));
    const known = error instanceof ProposalGenerationError;
    return json(
      {
        error_code: known ? error.code : "canva_autofill_failed",
        error: known ? error.message : "Não foi possível gerar a proposta no Canva.",
        ...(known ? error.details : {}),
      },
      known ? error.status : 500,
    );
  }
});
