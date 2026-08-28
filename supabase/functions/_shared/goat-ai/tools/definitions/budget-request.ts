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
