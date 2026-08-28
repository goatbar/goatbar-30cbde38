import { supabase } from "@/integrations/supabase/client";
import {
  resolveCanonicalProposalData,
  type CanonicalProposalData,
} from "@/lib/proposal-field-resolver";
import { buildProposalFilename } from "@/lib/proposal-filename";
import { ProposalPdfRenderer } from "./pdf-engine/renderer";
import { ProposalTemplateRegistry } from "./pdf-engine/registry";
import type { ProposalRenderResult, ProposalTemplateDefinition } from "./pdf-engine/types";
import { hydrateBudgetDrinks } from "../../supabase/functions/canva-generate-proposal/logic";
import type { GeneratedProposal } from "@/services/proposal-service";

export interface ProposalGenerationContext {
  event: Record<string, any>;
  budget: Record<string, any>;
  resolvedDrinkNames?: string[];
}

/**
 * Carrega os dados históricos do banco para o evento e orçamento informados.
 */
export async function loadProposalContext(
  eventId: string,
  budgetVersionId: string,
): Promise<ProposalGenerationContext> {
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    throw new Error("Evento não encontrado para geração da proposta.");
  }

  const { data: budget, error: budgetError } = await supabase
    .from("event_budget_versions")
    .select("*")
    .eq("id", budgetVersionId)
    .eq("event_id", eventId)
    .single();

  if (budgetError || !budget) {
    throw new Error("Versão do orçamento não encontrada.");
  }

  // Hidrata nomes de drinks a partir dos IDs
  let resolvedDrinkNames: string[] = [];
  try {
    const hydrated = await hydrateBudgetDrinks(
      budget.selected_drinks,
      supabase as any,
      { event_id: eventId, budget_version_id: budgetVersionId },
    );
    resolvedDrinkNames = hydrated.resolvedDrinkNames;
  } catch (err: any) {
    console.warn("[loadProposalContext] Falha ao hidratar drinks via catálogo:", err?.message);
    // Fallback gracioso se drinks já estiverem em array de nomes
    if (Array.isArray(budget.selected_drinks)) {
      resolvedDrinkNames = budget.selected_drinks
        .map((d: any) => (typeof d === "string" ? d : d?.nome || d?.name || ""))
        .filter(Boolean);
    }
  }

  return {
    event,
    budget,
    resolvedDrinkNames,
  };
}

/**
 * Seleciona deterministicamente o template correto a partir do tipo de evento ou ID explícito.
 */
export function selectProposalTemplateForEvent(
  eventType?: string | null,
  explicitTemplateId?: string,
): ProposalTemplateDefinition {
  if (explicitTemplateId) {
    const found = ProposalTemplateRegistry.getTemplate(explicitTemplateId);
    if (found) return found;
  }
  const typeClean = (eventType || "").toLowerCase().trim();
  if (typeClean === "despedida" || typeClean === "despedida_solteira" || typeClean.includes("despedida")) {
    const despedida = ProposalTemplateRegistry.getTemplate("goatbar-despedida");
    if (despedida) return despedida;
  }
  const standard = ProposalTemplateRegistry.getTemplate("goatbar-commercial");
  if (!standard) {
    throw new Error('Template padrão "goatbar-commercial" não encontrado.');
  }
  return standard;
}

/**
 * Gera o preview da proposta comercial em PDF em memória (Blob URL).
 * NÃO grava nada em generated_proposals e NÃO faz upload no Supabase Storage.
 */
export async function generateProposalPreview(params: {
  eventId: string;
  budgetVersionId: string;
  templateId?: string;
  customContext?: ProposalGenerationContext;
}): Promise<{
  pdfBytes: Uint8Array;
  blobUrl: string;
  canonicalData: CanonicalProposalData;
  renderResult: ProposalRenderResult;
  template: ProposalTemplateDefinition;
}> {
  const context =
    params.customContext || (await loadProposalContext(params.eventId, params.budgetVersionId));

  const canonicalData = resolveCanonicalProposalData({
    event: context.event,
    budget: context.budget,
    hydratedData: { selectedDrinkNames: context.resolvedDrinkNames },
  });

  const template = selectProposalTemplateForEvent(
    canonicalData.tipoEvento || (context.event as any)?.event_type,
    params.templateId,
  );

  const renderResult = await ProposalPdfRenderer.render(template, canonicalData);
  const blob = new Blob([renderResult.pdfBytes as any], { type: "application/pdf" });
  const blobUrl = URL.createObjectURL(blob);

  return {
    pdfBytes: renderResult.pdfBytes,
    blobUrl,
    canonicalData,
    renderResult,
    template,
  };
}

/**
 * Gera o PDF definitivo, faz upload no Supabase Storage e registra em generated_proposals.
 */
export async function generateAndPersistProposal(params: {
  eventId: string;
  budgetVersionId: string;
  templateId?: string;
}): Promise<{
  proposal: GeneratedProposal;
  pdfUrl: string;
  filename: string;
  storagePath: string;
  renderResult: ProposalRenderResult;
}> {
  const context = await loadProposalContext(params.eventId, params.budgetVersionId);

  const canonicalData = resolveCanonicalProposalData({
    event: context.event,
    budget: context.budget,
    hydratedData: { selectedDrinkNames: context.resolvedDrinkNames },
  });

  const template = selectProposalTemplateForEvent(
    canonicalData.tipoEvento || (context.event as any)?.event_type,
    params.templateId,
  );

  const renderResult = await ProposalPdfRenderer.render(template, canonicalData);
  const filename = buildProposalFilename(context.event.event_name);
  const proposalId = crypto.randomUUID();
  const storagePath = `events/${params.eventId}/budgets/${params.budgetVersionId}/proposals/${proposalId}/${filename}`;

  // Upload para o Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("generated-proposals")
    .upload(storagePath, renderResult.pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    console.error("[generateAndPersistProposal] Falha no upload Storage:", uploadError);
    throw new Error(`Não foi possível salvar o PDF no Storage: ${uploadError.message}`);
  }

  const { data: publicData } = supabase.storage
    .from("generated-proposals")
    .getPublicUrl(storagePath);

  const proposalRecord = {
    id: proposalId,
    event_id: params.eventId,
    budget_id: params.budgetVersionId,
    template_id: null, // Mantém null se for template de arquivo local ou UUID de template DB
    proposal_data: {
      ...canonicalData,
      template_id: template.id,
      template_version: template.version,
      generation_engine: "internal_pdf",
      storage_path: storagePath,
      generated_at: renderResult.generatedAt,
    } as any,
    final_pdf_url: publicData.publicUrl,
    status: "ready",
    storage_path: storagePath,
    generated_at: renderResult.generatedAt,
    updated_at: new Date().toISOString(),
  };

  const { data: savedProposal, error: insertError } = await supabase
    .from("generated_proposals")
    .insert(proposalRecord)
    .select()
    .single();

  if (insertError) {
    // Remove o arquivo órfão no Storage
    await supabase.storage.from("generated-proposals").remove([storagePath]).catch(() => {});
    throw new Error(`Falha ao registrar proposta no banco: ${insertError.message}`);
  }

  // Marca propostas anteriores como superseded
  await supabase
    .from("generated_proposals")
    .update({ status: "superseded", updated_at: new Date().toISOString() })
    .eq("event_id", params.eventId)
    .neq("id", proposalId)
    .eq("status", "ready");

  return {
    proposal: savedProposal as unknown as GeneratedProposal,
    pdfUrl: publicData.publicUrl,
    filename,
    storagePath,
    renderResult,
  };
}
