import { GoatAIToolDefinition, ToolContext, ToolExecutionResult } from "../../types.ts";
import { learnDrinkAlias } from "../../matchers/drink-matcher.ts";

export const upsertDrinkAliasTool: GoatAIToolDefinition = {
  name: "upsert_drink_alias",
  domain: "SALES",
  sourceTable: "drink_aliases",
  description: "Aprende ou atualiza o vínculo (alias) entre um nome de drink lido no fechamento/foto/texto e o drink real correspondente do catálogo oficial.",
  parameters: {
    type: "object",
    properties: {
      alias: {
        type: "string",
        description: "Nome ou variação do drink lido no fechamento (ex: 'Spritz Veneziano', 'Red Label', 'Caipivodka Morango').",
      },
      target_drink: {
        type: "string",
        description: "Nome oficial do drink cadastrado no catálogo (ex: 'Aperol', 'whisky (Dose)', 'caipi morango').",
      },
      business_unit: {
        type: "string",
        description: "Unidade de negócio específica ('7 Steak House', 'Goat Botequim' ou 'Global'). Padrão: unidade atual da sessão.",
      },
      force_override: {
        type: "boolean",
        description: "Forçar atualização caso já exista um mapeamento para um drink diferente.",
      },
    },
    required: ["alias", "target_drink"],
  },
  requiresConfirmation: false,
  execute: async (
    ctx: ToolContext,
    args: {
      alias: string;
      target_drink: string;
      business_unit?: string;
      force_override?: boolean;
    }
  ): Promise<ToolExecutionResult> => {
    if (!args.alias || !args.target_drink) {
      return {
        success: false,
        error: "Campos obrigatórios ausentes: 'alias' e 'target_drink'.",
      };
    }

    const result = await learnDrinkAlias({
      supabaseAdmin: ctx.supabaseAdmin,
      alias: args.alias,
      targetDrinkName: args.target_drink,
      businessUnit: args.business_unit,
      userId: ctx.userId,
      performerName: ctx.userName || "GIA",
      userRole: ctx.userRole,
      forceOverride: args.force_override || false,
      source: "chat_tool",
    });

    if (result.status === "TARGET_NOT_FOUND" || result.status === "ERROR" || result.status === "AMBIGUOUS") {
      return {
        success: false,
        error: result.message,
        data: result,
      };
    }

    if (result.status === "ALIAS_CONFLICT") {
      return {
        success: false,
        error: result.message,
        data: result,
      };
    }

    return {
      success: true,
      data: {
        alias: result.alias,
        target_drink: result.targetDrinkName,
        drink_id: result.resolvedDrinkId,
        business_unit: result.businessUnit,
        status: result.status,
      },
      message: result.message,
    };
  },
};
