import { createBudgetRequestLink } from "../../../budget-request-link.ts";
import type { GoatAIToolDefinition } from "../../types.ts";

export const createBudgetRequestLinkTool: GoatAIToolDefinition = {
  name: "create_budget_request_link",
  domain: "EVENTS",
  sourceTable: "budget_request_links",
  description:
    "Cria deterministicamente um link público real para o cliente solicitar um novo orçamento.",
  parameters: {
    type: "object",
    properties: {
      customer_name_hint: {
        type: "string",
        description: "Nome opcional do cliente citado pelo usuário.",
      },
    },
  },
  requiresConfirmation: false,
  async execute(context, args) {
    const hint =
      typeof args.customer_name_hint === "string"
        ? args.customer_name_hint.trim().slice(0, 120)
        : "";
    const result = await createBudgetRequestLink(context.supabaseAdmin, {
      createdBy: context.userId,
      metadata: hint ? { customer_name_hint: hint } : {},
    });
    return {
      success: true,
      data: result,
      message: `Link criado para solicitação de orçamento:\n\n${result.url}\n\nVocê pode copiar e enviar ao cliente.`,
    };
  },
};

export const listPendingBudgetRequestsTool: GoatAIToolDefinition = {
  name: "list_pending_budget_requests",
  domain: "EVENTS",
  sourceTable: "events,event_budget_versions",
  description: "Lista solicitações do formulário público que ainda não possuem nenhuma versão de orçamento.",
  parameters: { type: "object", properties: {} },
  requiresConfirmation: false,
  async execute(context) {
    const { data, error } = await context.supabaseAdmin
      .from("events")
      .select("id,client_name,event_name,event_type,date,event_time,event_location,city,guests,phone,created_at,event_budget_versions!left(id)")
      .eq("origin", "public_budget_form")
      .order("created_at", { ascending: false });
    if (error) return { success: false, error: error.message || String(error) };
    const appUrl = (typeof Deno !== "undefined" ? Deno.env.get("PUBLIC_APP_URL") || Deno.env.get("SITE_URL") : "")?.replace(/\/$/, "");
    const requests = (data || [])
      .filter((event: any) => !event.event_budget_versions?.length)
      .map(({ event_budget_versions: _versions, ...event }: any) => ({
        ...event,
        ...(appUrl ? { event_url: `${appUrl}/eventos/${event.id}` } : {}),
      }));
    return { success: true, data: { requests, count: requests.length } };
  },
};
