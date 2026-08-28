import { supabase } from "@/integrations/supabase/client";
import type { GeneratedProposal, ProposalTemplate } from "@/services/proposal-service";

export type ProposalGenerationFlow = "internal" | "canva";

export function getProposalGenerationFlow(template: ProposalTemplate): ProposalGenerationFlow {
  return template.provider === "canva" ? "canva" : "internal";
}

export const CANVA_PROPOSAL_ERROR_MESSAGES: Record<string, string> = {
  proposal_template_not_found:
    "Nenhum modelo de proposta ativo foi configurado para este tipo de evento.",
  canva_template_not_configured:
    "O modelo selecionado ainda não está vinculado a um Brand Template do Canva.",
  mapping_incomplete: "O mapeamento do modelo Canva está incompleto.",
  required_value_missing: "Um campo obrigatório da proposta não foi preenchido.",
  required_field_empty: "Um campo obrigatório não possui dados na versão deste orçamento.",
  drinks_query_failed: "Não foi possível carregar os drinks desta versão.",
  drinks_not_found: "Alguns drinks desta versão não foram encontrados no cadastro.",
  selected_drinks_invalid: "Os dados de drinks desta versão estão em um formato inválido.",
  canva_menu_overflow:
    "A lista de drinks ou bebidas excede a área segura do modelo. Reduza a lista para preservar a logo no rodapé.",
  canva_field_missing:
    "O Brand Template não possui um dos Data Fields mapeados. Atualize o template no Canva ou sincronize os campos.",
  canva_fields_missing: "Existem campos mapeados que ainda não são Data Fields do Canva.",
  canva_autofill_failed: "O Canva não conseguiu preencher o modelo. Tente novamente.",
  canva_autofill_quota_exceeded: "Cota de geração automática do Canva atingida.",
  canva_export_failed: "O Canva não conseguiu exportar a proposta em PDF. Tente novamente.",
  canva_pdf_download_failed: "Não foi possível baixar o PDF temporário do Canva.",
  pdf_invalid: "O arquivo retornado pelo Canva não é um documento PDF válido.",
  storage_failed: "O PDF foi gerado, mas não pôde ser salvo no Goat Bar.",
  storage_upload_failed: "Não foi possível salvar o PDF gerado. A proposta não foi registrada.",
  selected_drinks_invalid_format: "Os drinks desta versão estão em um formato antigo ou inválido.",
  selected_drink_not_found: "Um ou mais drinks desta versão não existem mais no cadastro.",
  selected_drinks_query_failed: "Não foi possível consultar os drinks desta versão.",
  delete_failed: "Não foi possível excluir a proposta.",
  proposal_not_found: "A proposta não foi encontrada.",
  unauthorized: "Acesso não autorizado para esta operação.",
};

export class CanvaProposalError extends Error {
  constructor(
    message: string,
    public code?: string,
    public upsellUrl?: string | null,
    public missingFields?: string[],
  ) {
    super(message);
    this.name = "CanvaProposalError";
  }
}

export function friendlyCanvaProposalError(value: any): string {
  const code = value?.error_code || value?.code || value?.context?.error_code;
  if (code === "required_field_empty") {
    if (
      value?.field === "DRINKS" ||
      value?.source_key === "package.drinks_list" ||
      value?.source_key === "package.drinks_count"
    ) {
      return "Esta versão do orçamento não possui drinks selecionados.";
    }
    if (value?.field) {
      return `Não foi possível gerar a proposta porque o campo ${value.field} não possui dados na versão deste orçamento.`;
    }
  }
  if (code === "canva_autofill_quota_exceeded") {
    return CANVA_PROPOSAL_ERROR_MESSAGES.canva_autofill_quota_exceeded;
  }
  return (
    CANVA_PROPOSAL_ERROR_MESSAGES[code] ||
    value?.error ||
    value?.context?.error ||
    value?.message ||
    "Não foi possível gerar a proposta Canva."
  );
}

export type CanvaGenerationDiagnostic = {
  code: string;
  status: number;
  message: string;
  upsell_url?: string;
  canva_details?: Record<string, unknown>;
  canva_account?: { canva_user_id?: string | null; display_name?: string | null };
  integration_audit?: Record<string, unknown>;
};

export class CanvaGenerationError extends Error {
  constructor(public diagnostic: CanvaGenerationDiagnostic) {
    super(friendlyCanvaProposalError(diagnostic));
    this.name = "CanvaGenerationError";
  }
}

export function getCanvaQuotaPresentation(diagnostic?: CanvaGenerationDiagnostic) {
  return {
    message: "A Canva ainda está identificando esta integração como sem cota de Autofill.",
    upsellUrl: diagnostic?.upsell_url,
    accountLabel: diagnostic?.canva_account?.display_name || "Nome não informado",
    canvaUserId: diagnostic?.canva_account?.canva_user_id || "Não informado",
  };
}

export function formatCanvaGenerationError(value: any): string {
  const code = value?.error_code || value?.code || value?.context?.error_code;
  const message =
    code === "canva_fields_missing"
      ? CANVA_PROPOSAL_ERROR_MESSAGES.canva_fields_missing
      : friendlyCanvaProposalError(value);
  const missing = Array.isArray(value?.missing_fields) ? value.missing_fields : [];
  return missing.length > 0
    ? `${message}\n\nCampos ausentes:\n${missing.map((key: string) => `• ${key}`).join("\n")}`
    : message;
}

async function readFunctionErrorBody(error: any) {
  const response = error?.context;
  if (response && typeof response.clone === "function") {
    try {
      return await response.clone().json();
    } catch {
      /* body is not JSON */
    }
  }
  return null;
}

export async function generateCanvaProposal(eventId: string, budgetVersionId: string) {
  const { data, error } = await supabase.functions.invoke("canva-generate-proposal", {
    body: { event_id: eventId, budget_version_id: budgetVersionId },
  });
  if (error || data?.error_code) {
    const body = data || (await readFunctionErrorBody(error)) || {};
    const code = body.error_code || body.code || error?.name;
    const message = formatCanvaGenerationError(body || error);
    const upsellUrl = body.upsell_url || body.upsellUrl || null;
    const missingFields = Array.isArray(body.missing_fields) ? body.missing_fields : undefined;
    if (code === "canva_autofill_quota_exceeded") {
      throw new CanvaGenerationError({
        code,
        status: body.status ?? 429,
        message: body.error || message,
        upsell_url: upsellUrl,
        canva_details: body.canva_details,
        canva_account: body.canva_account,
        integration_audit: body.integration_audit,
      });
    }
    throw new CanvaProposalError(message, code, upsellUrl, missingFields);
  }
  return data as {
    proposal: GeneratedProposal;
    canva_design_id: string;
    pdf_url: string;
    filename: string;
  };
}

export async function deleteGeneratedProposal(proposalId: string) {
  const { data, error } = await supabase.functions.invoke("canva-delete-generated-proposal", {
    body: { generated_proposal_id: proposalId },
  });
  if (error || data?.error_code) {
    const body = data || (await readFunctionErrorBody(error)) || {};
    const code = body.error_code || body.code || error?.name;
    const message = formatCanvaGenerationError(body || error);
    throw new CanvaProposalError(message, code);
  }
  return data as { success: boolean; deleted_proposal_id: string };
}
