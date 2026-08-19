import { supabase } from "@/integrations/supabase/client";
import type { GeneratedProposal, ProposalTemplate } from "@/services/proposal-service";

export type ProposalGenerationFlow = "internal" | "canva";

export function getProposalGenerationFlow(template: ProposalTemplate): ProposalGenerationFlow {
  return template.provider === "canva" ? "canva" : "internal";
}

export const CANVA_PROPOSAL_ERROR_MESSAGES: Record<string, string> = {
  proposal_template_not_found: "Nenhum modelo de proposta ativo foi configurado para este tipo de evento.",
  canva_template_not_configured: "O modelo selecionado ainda não está vinculado a um Brand Template do Canva.",
  mapping_incomplete: "O mapeamento do modelo Canva está incompleto.",
  required_value_missing: "Um campo obrigatório da proposta não foi preenchido.",
  canva_field_missing: "O Brand Template não possui um dos Data Fields mapeados. Atualize o template no Canva ou sincronize os campos.",
  canva_fields_missing: "Existem campos mapeados que ainda não são Data Fields do Canva.",
  canva_autofill_failed: "O Canva não conseguiu preencher o modelo. Tente novamente.",
  canva_export_failed: "O Canva não conseguiu exportar a proposta em PDF. Tente novamente.",
  storage_failed: "O PDF foi gerado, mas não pôde ser salvo no Goat Bar.",
};

export function friendlyCanvaProposalError(value: any): string {
  const code = value?.error_code || value?.context?.error_code;
  return value?.error || value?.context?.error || CANVA_PROPOSAL_ERROR_MESSAGES[code] || value?.message || "Não foi possível gerar a proposta Canva.";
}

export function formatCanvaGenerationError(value: any): string {
  const message = value?.error_code === "canva_fields_missing"
    ? CANVA_PROPOSAL_ERROR_MESSAGES.canva_fields_missing
    : friendlyCanvaProposalError(value);
  const missing = Array.isArray(value?.missing_fields) ? value.missing_fields : [];
  return missing.length > 0 ? `${message}\n\nCampos ausentes:\n${missing.map((key: string) => `• ${key}`).join("\n")}` : message;
}

async function readFunctionErrorBody(error: any) {
  const response = error?.context;
  if (response && typeof response.clone === "function") {
    try { return await response.clone().json(); } catch { /* body is not JSON */ }
  }
  return null;
}

export async function generateCanvaProposal(eventId: string, budgetVersionId: string) {
  const { data, error } = await supabase.functions.invoke("canva-generate-proposal", {
    body: { event_id: eventId, budget_version_id: budgetVersionId },
  });
  if (error || data?.error_code) {
    const body = data || await readFunctionErrorBody(error);
    throw new Error(formatCanvaGenerationError(body || error));
  }
  return data as { proposal: GeneratedProposal; canva_design_id: string; pdf_url: string };
}
