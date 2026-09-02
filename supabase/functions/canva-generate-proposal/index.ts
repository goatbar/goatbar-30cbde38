import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getCanvaBrandTemplateDataset,
  getValidCanvaAccessToken,
  auditCanvaIntegration,
  fetchCanvaUserProfile,
  sanitizeLog,
} from "../_shared/canva-auth.ts";
import {
  autofillAndExportPdf,
  auditAutofillPayload,
  buildAutofillData,
  buildDeterministicStoragePath,
  getMissingCanvaMappingKeys,
  hydrateBudgetDrinks,
  normalizeProposalEventType,
  ProposalGenerationError,
  uploadPdfToStorage,
  validatePdfBytes,
} from "./logic.ts";
import { resolveProposalTemplate } from "../../../src/lib/proposal-template-resolver.ts";
import { resolveProposalField } from "../../../src/lib/proposal-field-resolver.ts";
import { buildProposalFilename } from "../../../src/lib/proposal-filename.ts";

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
    const { data: activeTemplates, error: templateError } = await supabaseAdmin
      .from("proposal_templates")
      .select("*")
      .eq("is_active", true);
    const template = resolveProposalTemplate(event.event_type, activeTemplates || []);
    if (templateError || !template)
      throw new ProposalGenerationError(
        "proposal_template_not_found",
        `Nenhum modelo ativo foi encontrado para o tipo ${eventType}.`,
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
    const integrationAudit = await auditCanvaIntegration(user.id, supabaseAdmin, token);
    let profileLookupError: string | null = null;
    const canvaProfile = await fetchCanvaUserProfile(token).catch((error) => {
      profileLookupError = error instanceof Error ? error.message : String(error);
      return { id: null, display_name: null };
    });
    if (canvaProfile.id && canvaProfile.id !== integrationAudit.canva_user_id) {
      const { error: identityUpdateError } = await supabaseAdmin
        .from("canva_integrations")
        .update({ canva_user_id: canvaProfile.id, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (identityUpdateError) {
        console.warn("[canva-generate-proposal][identity-persistence]", {
          persisted: false,
          error: identityUpdateError.message,
        });
      } else {
        integrationAudit.canva_user_id = canvaProfile.id;
      }
    }
    console.info("[canva-generate-proposal][integration-audit]", {
      ...integrationAudit,
      profile_user_id: canvaProfile.id,
      profile_display_name: canvaProfile.display_name,
      profile_lookup_error: profileLookupError,
      profile_matches_integration: Boolean(
        canvaProfile.id && canvaProfile.id === integrationAudit.canva_user_id,
      ),
    });
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
    console.info("[canva-generate-proposal][payload-audit]", {
      event_id: eventId,
      budget_version_id: budgetVersionId,
      fields: auditAutofillPayload(mappings || [], autofillData),
    });
    let generated;
    try {
      generated = await autofillAndExportPdf({
        token,
        brandTemplateId: template.canva_brand_template_id,
        data: autofillData,
      });
    } catch (error) {
      if (error instanceof ProposalGenerationError && error.status === 429) {
        error.details = {
          ...error.details,
          canva_account: {
            canva_user_id: integrationAudit.canva_user_id,
            display_name: canvaProfile.display_name,
          },
          integration_audit: integrationAudit,
        };
      }
      throw error;
    }
    const pdfResponse = await fetch(generated.downloadUrl);
    if (!pdfResponse.ok) {
      throw new ProposalGenerationError(
        "canva_pdf_download_failed",
        "Não foi possível baixar o PDF temporário do Canva.",
        502,
      );
    }
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdf = new Uint8Array(pdfBuffer);
    validatePdfBytes(pdf);

    const proposalId = crypto.randomUUID();
    const filename = buildProposalFilename(event.event_name);
    const storagePath = buildDeterministicStoragePath(eventId, budget.id, proposalId, filename);

    const { error: storageError } = await uploadPdfToStorage(
      supabaseAdmin.storage,
      "generated-proposals",
      storagePath,
      pdf,
    );

    if (storageError) {
      console.error("[canva-generate-proposal] storage_upload error", {
        stage: "storage_upload",
        bucket: "generated-proposals",
        storage_path: storagePath,
        byte_length: pdf.byteLength,
        content_type: "application/pdf",
        storage_error_name: storageError.name,
        storage_error_message: storageError.message,
        storage_status: (storageError as any)?.status || (storageError as any)?.statusCode,
      });
      throw new ProposalGenerationError(
        "storage_upload_failed",
        "Não foi possível salvar o PDF no Storage.",
        500,
        {
          stage: "storage_upload",
          storage_error_message: storageError.message,
        },
      );
    }

    const { data: publicData } = supabaseAdmin.storage
      .from("generated-proposals")
      .getPublicUrl(storagePath);
    const proposalData = Object.fromEntries(
      Object.entries(autofillData).map(([key, value]) => [key, value.text]),
    );

    const record = {
      id: proposalId,
      event_id: eventId,
      budget_id: budget.id,
      template_id: template.id,
      proposal_data: proposalData,
      final_pdf_url: publicData.publicUrl,
      status: "ready",
      canva_design_id: generated.designId,
      generated_at: new Date().toISOString(),
      storage_path: storagePath,
      updated_at: new Date().toISOString(),
    };

    const { data: proposal, error: persistError } = await supabaseAdmin
      .from("generated_proposals")
      .insert(record)
      .select()
      .single();

    if (persistError) {
      console.error("[canva-generate-proposal] persist error", persistError);
      // Cleanup orphan storage file on persist error
      await supabaseAdmin.storage
        .from("generated-proposals")
        .remove([storagePath])
        .catch(() => {});
      throw new ProposalGenerationError(
        "storage_upload_failed",
        "PDF gerado, mas o registro da proposta não pôde ser salvo.",
        500,
      );
    }

    // Mark previous ready proposals for this event as superseded to preserve history
    await supabaseAdmin
      .from("generated_proposals")
      .update({ status: "superseded", updated_at: new Date().toISOString() })
      .eq("event_id", eventId)
      .neq("id", proposalId)
      .eq("status", "ready");

    return json({
      proposal,
      canva_design_id: generated.designId,
      pdf_url: publicData.publicUrl,
      filename,
      storage_path: storagePath,
      jobs: { autofill: generated.autofillJobId, export: generated.exportJobId },
    });
  } catch (error) {
    console.error("[canva-generate-proposal]", sanitizeLog(error));
    const known = error instanceof ProposalGenerationError;
    return json(
      {
        code: known ? error.code : "canva_autofill_failed",
        status: known ? error.status : 500,
        error_code: known ? error.code : "canva_autofill_failed",
        error: known ? error.message : "Não foi possível gerar a proposta no Canva.",
        ...(known ? error.details : {}),
      },
      known ? error.status : 500,
    );
  }
});
