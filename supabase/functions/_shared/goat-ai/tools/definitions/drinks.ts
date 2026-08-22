import { GoatAIToolDefinition, ToolContext, ToolExecutionResult } from "../../types.ts";
import { resolveBusinessUnit } from "../../matchers/unit-matcher.ts";

export const getDrinksCatalogTool: GoatAIToolDefinition = {
  name: "get_drinks_catalog",
  domain: "SALES",
  sourceTable: "drinks",
  description:
    "Consulta o catálogo e cardápio de drinks cadastrados no sistema para uma unidade específica ('7 Steak House', 'Goat Botequim' ou 'Eventos'). Retorna apenas os drinks ativos vinculados àquela unidade com seus preços e custos oficiais.",
  parameters: {
    type: "object",
    properties: {
      unit_name: {
        type: "string",
        description: "Nome ou identificador da unidade ('7 Steak House', 'Goat Botequim' ou 'Eventos').",
      },
      category: {
        type: "string",
        description: "Filtro opcional por categoria (ex: 'Gin', 'Vodka', 'Whisky', 'Cachaça', 'Sem Álcool').",
      },
    },
    required: [],
  },
  requiresConfirmation: false,
  execute: async (
    ctx: ToolContext,
    args: { unit_name?: string; category?: string }
  ): Promise<ToolExecutionResult> => {
    const unitRes = resolveBusinessUnit(args.unit_name);
    const isSteak = unitRes.id === "steakhouse" || unitRes.dbModality === "7Steakhouse";
    const isBotequim = unitRes.id === "goat_botequim" || unitRes.dbModality === "Goat Botequim";
    const isEvento = unitRes.id === "eventos" || unitRes.dbModality === "Evento";

    const { data: dbDrinks, error } = await ctx.supabaseAdmin
      .from("drinks")
      .select("id, nome, categoria, descricao, custo_unitario, modality_config, imagem")
      .order("nome", { ascending: true });

    if (error) {
      return {
        success: false,
        error: `Erro ao consultar catálogo de drinks: ${error.message}`,
      };
    }

    const allDrinks = dbDrinks || [];

    const filtered = allDrinks.filter((d: any) => {
      const modConfig = d.modality_config || {};

      if (isSteak) {
        if (!modConfig.steakhouse?.active) return false;
      } else if (isBotequim) {
        if (!modConfig.goatbotequim?.active) return false;
      } else if (isEvento) {
        if (!modConfig.evento?.active) return false;
      }

      if (args.category && args.category.trim() !== "") {
        const catClean = args.category.trim().toLowerCase();
        if ((d.categoria || "").toLowerCase() !== catClean) return false;
      }

      return true;
    });

    const items = filtered.map((d: any) => {
      const modConfig = d.modality_config || {};
      let price = 0;
      let cost = Number(d.custo_unitario || 0);

      if (isSteak) {
        price = Number(modConfig.steakhouse?.price ?? 0);
        cost = Number(modConfig.steakhouse?.cost ?? d.custo_unitario ?? 0);
      } else if (isBotequim) {
        price = Number(modConfig.goatbotequim?.price ?? 0);
        cost = Number(modConfig.goatbotequim?.cost ?? d.custo_unitario ?? 0);
      } else if (isEvento) {
        cost = Number(modConfig.evento?.cost ?? d.custo_unitario ?? 0);
      }

      return {
        id: d.id,
        name: d.nome,
        category: d.categoria || "Geral",
        description: d.descricao || "",
        price: price > 0 ? price : undefined,
        cost,
        available_in_units: {
          steakhouse: Boolean(modConfig.steakhouse?.active),
          goatbotequim: Boolean(modConfig.goatbotequim?.active),
          evento: Boolean(modConfig.evento?.active),
        },
      };
    });

    return {
      success: true,
      data: {
        unit: unitRes.canonicalName,
        total_drinks: items.length,
        drinks: items,
      },
      message: `Encontrados ${items.length} drinks ativos para a unidade ${unitRes.canonicalName}.`,
    };
  },
};
