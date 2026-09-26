import type { GoatAIToolDefinition, ToolContext, ToolExecutionResult } from "../../types.ts";

type DocumentAction =
  | "generate_proposal"
  | "generate_menu"
  | "generate_contract_and_send";

function getEnv(name: string): string {
  try {
    return typeof Deno !== "undefined" ? (Deno.env.get(name) || "") : "";
  } catch {
    return "";
  }
}

function eventIdFromArgs(args: any): string {
  return typeof args?.event_id === "string" ? args.event_id.trim() : "";
}

async function runDocumentAction(
  context: ToolContext,
  action: DocumentAction,
  eventId: string,
): Promise<ToolExecutionResult> {
  if (!eventId) {
    return { success: false, error: "O event_id é obrigatório para gerar documentos." };
  }
  if (!context.userId) {
    return {
      success: false,
      error: "A geração de documentos exige um usuário interno identificado na GIA.",
    };
  }

  const supabaseUrl = getEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return { success: false, error: "Serviço interno de documentos não configurado." };
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/goat-ai-document-actions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
      "x-request-id": context.correlationId || crypto.randomUUID(),
    },
    body: JSON.stringify({
      action,
      event_id: eventId,
      requested_by_user_id: context.userId,
      requested_by_name: context.userName || null,
      channel: context.channel,
    }),
  });

  const raw = await response.text();
  let payload: any = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = { error: raw.slice(0, 500) };
  }

  if (!response.ok || payload?.success === false) {
    return {
      success: false,
      error: payload?.error || payload?.message || `Falha na ação de documento (HTTP ${response.status}).`,
      data: payload,
    };
  }

  return {
    success: true,
    data: payload,
    message: payload?.message || "Documento processado com sucesso.",
  };
}

export const generateCommercialProposalPdfTool: GoatAIToolDefinition = {
  name: "generate_commercial_proposal_pdf",
  domain: "EVENTS",
  sourceTable: "events,event_budget_versions,generated_proposals",
  description:
    "Gera a proposta comercial oficial em PDF para um evento, usando o orçamento atual e o modelo correto do tipo de evento. Use somente depois de resolver o evento e obter seu event_id. Retorna o link real do PDF.",
  parameters: {
    type: "object",
    properties: {
      event_id: { type: "string", description: "UUID do evento já resolvido." },
    },
    required: ["event_id"],
  },
  requiresConfirmation: false,
  execute: (context, args) =>
    runDocumentAction(context, "generate_proposal", eventIdFromArgs(args)),
};

export const generateEventMenuPdfTool: GoatAIToolDefinition = {
  name: "generate_event_menu_pdf",
  domain: "EVENTS",
  sourceTable: "events,event_budget_versions,drinks,event_menu_settings",
  description:
    "Gera o cardápio oficial GOAT Bar em PDF usando os drinks do orçamento atual, descrições cadastradas e personalização do evento. Use somente depois de resolver o event_id. Retorna um link real e temporário para o PDF.",
  parameters: {
    type: "object",
    properties: {
      event_id: { type: "string", description: "UUID do evento já resolvido." },
    },
    required: ["event_id"],
  },
  requiresConfirmation: false,
  execute: (context, args) =>
    runDocumentAction(context, "generate_menu", eventIdFromArgs(args)),
};

export const generateContractAndSendSignatureTool: GoatAIToolDefinition = {
  name: "generate_contract_and_send_signature",
  domain: "EVENTS",
  sourceTable:
    "events,event_contracts,contract_templates,contract_signers,event_contract_client_data,event_budget_versions,contract_signature_requests",
  description:
    "Gera o contrato oficial do evento em PDF e o envia para assinatura eletrônica pela Assinafy. Acione esta ferramenta SOMENTE quando o usuário pedir explicitamente para gerar E enviar o contrato para assinatura. Se faltarem dados obrigatórios, a ferramenta interrompe antes da Assinafy e informa as pendências. Retorna o link real do PDF e o status do envio.",
  parameters: {
    type: "object",
    properties: {
      event_id: { type: "string", description: "UUID do evento já resolvido." },
    },
    required: ["event_id"],
  },
  requiresConfirmation: false,
  execute: (context, args) =>
    runDocumentAction(context, "generate_contract_and_send", eventIdFromArgs(args)),
};
