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


async function createContractDataRequestLink(
  context: ToolContext,
  eventId: string,
): Promise<ToolExecutionResult> {
  if (!eventId) {
    return { success: false, error: "O event_id é obrigatório para gerar o link dos dados do contrato." };
  }

  const { data: event, error: eventError } = await context.supabaseAdmin
    .from("events")
    .select("id,event_name,client_name")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) return { success: false, error: eventError.message };
  if (!event) return { success: false, error: "Evento não encontrado." };

  const now = new Date();
  const { data: existing, error: existingError } = await context.supabaseAdmin
    .from("event_contract_client_data")
    .select("public_token,token_expires_at")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existingError) return { success: false, error: existingError.message };

  let token = existing?.public_token || "";
  const currentExpiry = existing?.token_expires_at ? new Date(existing.token_expires_at) : null;
  const canReuse = Boolean(token && currentExpiry && currentExpiry.getTime() > now.getTime() + 60_000);

  let expiresAt = currentExpiry;
  if (!canReuse) {
    token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { error: saveError } = await context.supabaseAdmin
      .from("event_contract_client_data")
      .upsert(
        {
          event_id: eventId,
          public_token: token,
          token_expires_at: expiresAt.toISOString(),
          updated_at: now.toISOString(),
        },
        { onConflict: "event_id" },
      );

    if (saveError) return { success: false, error: saveError.message };
  }

  const appUrl = (
    getEnv("PUBLIC_APP_URL") ||
    getEnv("APP_URL") ||
    getEnv("SITE_URL") ||
    "https://goatbar.com.br"
  ).replace(/\/$/, "");
  const link = `${appUrl}/contrato/dados/${token}`;
  const eventLabel = event.event_name || event.client_name || "evento";

  return {
    success: true,
    data: {
      event_id: eventId,
      event_name: eventLabel,
      contract_data_url: link,
      expires_at: expiresAt?.toISOString() || null,
      reused_existing_token: canReuse,
    },
    message:
      `Link para solicitação dos dados do contrato de ${eventLabel}:\n\n${link}\n\nO link é válido por 7 dias.`,
  };
}


export const createContractDataRequestLinkTool: GoatAIToolDefinition = {
  name: "create_contract_data_request_link",
  domain: "EVENTS",
  sourceTable: "events,event_contract_client_data",
  description:
    "Gera ou reutiliza o link público para o cliente preencher os dados necessários ao contrato. Use quando o usuário pedir o link/formulário de dados do contrato, solicitação de dados contratuais ou equivalente. Resolva primeiro o event_id real. Retorna o link oficial /contrato/dados/{token}, válido por 7 dias.",
  parameters: {
    type: "object",
    properties: {
      event_id: { type: "string", description: "UUID do evento já resolvido." },
    },
    required: ["event_id"],
  },
  requiresConfirmation: false,
  execute: (context, args) =>
    createContractDataRequestLink(context, eventIdFromArgs(args)),
};

export const generateCommercialProposalPdfTool: GoatAIToolDefinition = {
  name: "generate_commercial_proposal_pdf",
  domain: "EVENTS",
  sourceTable: "events,event_budget_versions,generated_proposals",
  description:
    "Gera a proposta comercial oficial em PDF. Use SOMENTE quando o usuário pedir explicitamente uma proposta ou proposta comercial. A palavra 'orçamento' sozinha é consulta e NÃO autoriza esta ferramenta. Use depois de resolver o event_id. Retorna o PDF real.",
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
    "Gera o cardápio oficial GOAT Bar em PDF. Use SOMENTE quando o usuário pedir explicitamente PDF, arquivo ou link do cardápio/menu. Pedidos como 'me manda os drinks', 'qual o cardápio?' ou 'quais bebidas?' são consultas e devem usar get_event_details, sem gerar PDF. Use depois de resolver o event_id.",
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
    "Gera o contrato oficial do evento e o envia para assinatura eletrônica pela Assinafy. Acione SOMENTE quando o usuário pedir explicitamente envio para assinatura. O objetivo desta ferramenta é o DISPARO JURÍDICO, não entregar o PDF ao solicitante no WhatsApp. Se faltarem dados obrigatórios, interrompe antes da Assinafy. Retorna o status do envio; não exponha o PDF ao usuário salvo se ele pedir uma cópia em solicitação separada.",
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
