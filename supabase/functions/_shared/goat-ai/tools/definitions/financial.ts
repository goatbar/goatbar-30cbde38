import { GoatAIToolDefinition, ToolContext, ToolExecutionResult } from "../../types.ts";
import { resolveBusinessUnit, matchUnitName } from "../../matchers/unit-matcher.ts";

export function normalizeDateInput(d?: string | null, defaultYear = 2026): string {
  if (!d || typeof d !== "string") return "";
  const trimmed = d.trim();
  if (!trimmed) return "";

  // 1. ISO string with time (e.g. 2026-08-07T12:00:00... or 2026-08-07 12:00:00)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // 2. DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    return `${dmyMatch[3]}-${month}-${day}`;
  }

  // 3. DD/MM/YY or DD-MM-YY (2-digit year)
  const dmy2Match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (dmy2Match) {
    const day = dmy2Match[1].padStart(2, "0");
    const month = dmy2Match[2].padStart(2, "0");
    const year = `20${dmy2Match[3]}`;
    return `${year}-${month}-${day}`;
  }

  // 4. DD/MM or DD-MM (deterministic Brazilian day first, month second)
  const dmMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (dmMatch) {
    const day = dmMatch[1].padStart(2, "0");
    const month = dmMatch[2].padStart(2, "0");
    return `${defaultYear}-${month}-${day}`;
  }

  // 5. Portuguese textual dates: "07 de agosto de 2026", "7 de agosto", "07 de ago", "7 ago 2026"
  const ptMonths: Record<string, string> = {
    janeiro: "01", jan: "01",
    fevereiro: "02", fev: "02",
    marco: "03", março: "03", mar: "03",
    abril: "04", abr: "04",
    maio: "05", mai: "05",
    junho: "06", jun: "06",
    julho: "07", jul: "07",
    agosto: "08", ago: "08",
    setembro: "09", set: "09",
    outubro: "10", out: "10",
    novembro: "11", nov: "11",
    dezembro: "12", dez: "12",
  };

  const cleanPt = trimmed
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const textMatch = cleanPt.match(/^(\d{1,2})\s*(?:de|\/)?\s*([a-z]+)(?:\s*(?:de|\/)?\s*(\d{2,4}))?$/);
  if (textMatch) {
    const day = textMatch[1].padStart(2, "0");
    const monthKey = textMatch[2];
    const month = ptMonths[monthKey];
    if (month) {
      let year = defaultYear;
      if (textMatch[3]) {
        year = textMatch[3].length === 2 ? Number(`20${textMatch[3]}`) : Number(textMatch[3]);
      }
      return `${year}-${month}-${day}`;
    }
  }

  return trimmed;
}

export function calculateSalesSessionMetrics(s: any) {
  const items = s.financial_session_items || s.items || [];
  const modalityRes = resolveBusinessUnit(s.modality);
  const isSteak = modalityRes.id === "steakhouse";
  const canonicalModality = modalityRes.dbModality;

  const totalDrinks = items.reduce(
    (sum: number, it: any) => sum + (Number(it.quantity ?? it.quantidade) || 0),
    0
  );

  const grossRevenue = Math.round(
    items.reduce(
      (sum: number, it: any) =>
        sum + (Number(it.quantity ?? it.quantidade) || 0) * (Number(it.unit_price ?? it.precoUnitario) || 0),
      0
    ) * 100
  ) / 100;

  const costDrinks = Math.round(
    items.reduce(
      (sum: number, it: any) =>
        sum + (Number(it.quantity ?? it.quantidade) || 0) * (Number(it.unit_cost ?? it.custoUnitario ?? it.custoInsumo) || 0),
      0
    ) * 100
  ) / 100;

  const grossProfit = Math.round((grossRevenue - costDrinks) * 100) / 100;

  const laborDetails = s.labor_details || s.maoDeObraDetalhes;
  const laborValue =
    laborDetails && Array.isArray(laborDetails) && laborDetails.length > 0
      ? Math.round(laborDetails.reduce((sum: number, b: any) => sum + (Number(b.valor) || 0), 0) * 100) / 100
      : Math.round(((Number(s.labor_value ?? s.maoDeObraValor) || 0) * (Number(s.labor_quantity ?? s.maoDeObraQtd) || 1)) * 100) / 100;

  const reposicao = Number(s.reposicao_restaurante ?? s.reposicaoRestaurante) || 0;

  // Formula exact matching frontend rules in vendas.tsx / financial-service.ts
  let repasse = 0;
  let saldoGoat = grossProfit;
  let finalProfit = 0;

  if (isSteak) {
    // 7Steakhouse: gross_profit - reposicao - laborValue
    repasse = 0;
    saldoGoat = grossProfit;
    finalProfit = Math.round((grossProfit - reposicao - laborValue) * 100) / 100;
  } else {
    // Goat Botequim: (gross_profit * 0.60) - laborValue
    repasse = Math.round(grossProfit * 0.40 * 100) / 100;
    saldoGoat = Math.round((grossProfit - repasse) * 100) / 100;
    finalProfit = Math.round((saldoGoat - laborValue) * 100) / 100;
  }

  return {
    id: s.id,
    date: s.date,
    unit: modalityRes.canonicalName,
    modality: canonicalModality,
    responsible: s.labor_names || s.maoDeObraNomes || "Não informado",
    total_drinks: totalDrinks,
    gross_revenue: grossRevenue,
    cost_drinks: costDrinks,
    gross_profit: grossProfit,
    repasse_restaurante: repasse,
    saldo_goat: saldoGoat,
    labor_value: laborValue,
    reposicao_restaurante: reposicao,
    final_profit: finalProfit,
    items_count: items.length,
    items: items.map((it: any) => ({
      name: it.drink_name || it.nome || "Item",
      quantity: Number(it.quantity ?? it.quantidade) || 0,
      unit_price: Number(it.unit_price ?? it.precoUnitario) || 0,
      unit_cost: Number(it.unit_cost ?? it.custoUnitario ?? it.custoInsumo) || 0,
      total: Math.round(((Number(it.quantity ?? it.quantidade) || 0) * (Number(it.unit_price ?? it.precoUnitario) || 0)) * 100) / 100,
    })),
  };
}

export const createSalesSessionTool: GoatAIToolDefinition = {
  name: "create_sales_session",
  domain: "SALES",
  sourceTable: "financial_sessions",
  description: "Registra uma nova sessão de vendas de uma unidade ('7 Steak House' ou 'Goat Botequim') com drinks vendidos, período/data e mão de obra opcional.",
  parameters: {
    type: "object",
    properties: {
      unit_name: {
        type: "string",
        description: "Nome da unidade ('7 Steak House' ou 'Goat Botequim').",
      },
      start_date: {
        type: "string",
        description: "Data inicial da operação no formato YYYY-MM-DD (ex: '2026-08-05').",
      },
      end_date: {
        type: "string",
        description: "Data final da operação no formato YYYY-MM-DD (ex: '2026-08-09').",
      },
      items: {
        type: "array",
        description: "Lista de drinks vendidos na sessão.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Nome do drink." },
            quantity: { type: "number", description: "Quantidade vendida." },
            unit_price: { type: "number", description: "Preço unitário (opcional, buscado do cardápio)." },
            unit_cost: { type: "number", description: "Custo unitário (opcional)." },
          },
          required: ["name", "quantity"],
        },
      },
      labor_value: {
        type: "number",
        description: "Valor total de mão de obra / acerto barmen (opcional).",
      },
      labor_quantity: {
        type: "number",
        description: "Quantidade de barmen / diárias (opcional).",
      },
      labor_names: {
        type: "string",
        description: "Nomes dos barmen da equipe (opcional).",
      },
      labor_details: {
        type: "array",
        description: "Detalhamento de mão de obra por dia da semana (opcional).",
      },
      reposicao_restaurante: {
        type: "number",
        description: "Valor de reposição de insumos pelo restaurante (opcional, 7 Steakhouse).",
      },
      custos_restaurante_detalhes: {
        type: "array",
        description: "Detalhamento das reposições do restaurante (opcional, 7 Steakhouse).",
      },
      notes: {
        type: "string",
        description: "Observações adicionais da sessão (opcional).",
      },
    },
    required: ["unit_name", "start_date", "items"],
  },
  requiresConfirmation: true,
  execute: async (ctx: ToolContext, args: {
    unit_name: string;
    start_date: string;
    end_date?: string;
    items?: Array<{ name: string; quantity: number; unit_price?: number; unit_cost?: number; ingredient_cost?: number; drink_id?: string }>;
    labor_value?: number;
    labor_quantity?: number;
    labor_names?: string;
    labor_details?: any[];
    reposicao_restaurante?: number;
    custos_restaurante_detalhes?: any[];
    notes?: string;
  }): Promise<ToolExecutionResult> => {
    // 1. Validate mandatory fields
    const missing: string[] = [];
    if (!args.unit_name) missing.push("unit_name");
    if (!args.start_date) missing.push("start_date");
    if (!args.items || !Array.isArray(args.items) || args.items.length === 0) missing.push("items");

    if (missing.length > 0) {
      return {
        success: false,
        missing_fields: missing,
        error: `Campos obrigatórios pendentes: ${missing.join(", ")}`,
      };
    }

    const unitInfo = resolveBusinessUnit(args.unit_name);
    const dbModality = unitInfo.dbModality === "7Steakhouse" ? "7Steakhouse" : "Goat Botequim";
    const isSteak = dbModality === "7Steakhouse";

    // 2. Fetch Drinks Catalog for price/cost resolution
    let catalog: any[] = [];
    try {
      const { data: dbDrinks } = await ctx.supabaseAdmin
        .from("drinks")
        .select("id, nome, custo_unitario, modality_config");
      if (dbDrinks) catalog = dbDrinks;
    } catch {
      // ignore catalog fetch failure if table not accessible
    }

    // 3. Insert into financial_sessions
    const { data: session, error: sError } = await ctx.supabaseAdmin
      .from("financial_sessions")
      .insert({
        date: args.start_date,
        modality: dbModality,
        labor_value: Number(args.labor_value) || 0,
        labor_quantity: Number(args.labor_quantity) || 0,
        labor_names: args.labor_names || null,
        labor_details: args.labor_details || [],
        reposicao_restaurante: Number(args.reposicao_restaurante) || 0,
        custos_restaurante_detalhes: args.custos_restaurante_detalhes || [],
      })
      .select()
      .single();

    if (sError || !session) {
      return {
        success: false,
        error: `Erro ao criar sessão no banco de dados: ${sError?.message}`,
      };
    }

    // 4. Insert items with catalog matching
    let totalDrinks = 0;
    let grossRevenue = 0;

    const itemsPayload = (args.items || []).map((i) => {
      const qty = Number(i.quantity) || 1;
      totalDrinks += qty;

      let unitPrice = Number(i.unit_price) || 0;
      let unitCost = Number(i.unit_cost) || 0;
      let ingredientCost = Number(i.ingredient_cost) || 0;
      let drinkId = i.drink_id || null;

      if (catalog.length > 0) {
        const normItemName = i.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const matched = catalog.find((cd: any) => {
          const normCatalog = (cd.nome || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
          return normCatalog === normItemName || normCatalog.includes(normItemName) || normItemName.includes(normCatalog);
        });

        if (matched) {
          drinkId = matched.id;
          const modConfig = matched.modality_config || {};
          const conf = isSteak ? (modConfig.steakhouse || {}) : (modConfig.goatbotequim || {});
          if (unitPrice <= 0) unitPrice = Number(conf.price ?? 0);
          if (unitCost <= 0) unitCost = Number(conf.cost ?? matched.custo_unitario ?? 0);
          if (ingredientCost <= 0) {
            ingredientCost = isSteak ? Number(modConfig.evento?.cost ?? matched.custo_unitario ?? unitCost) : unitCost;
          }
        }
      }

      grossRevenue += qty * unitPrice;

      return {
        session_id: session.id,
        drink_id: drinkId,
        drink_name: i.name,
        quantity: qty,
        unit_price: unitPrice,
        unit_cost: unitCost,
        ingredient_cost: ingredientCost,
      };
    });

    if (itemsPayload.length > 0) {
      await ctx.supabaseAdmin.from("financial_session_items").insert(itemsPayload);
    }

    return {
      success: true,
      data: {
        session_id: session.id,
        unit: unitInfo.canonicalName,
        modality: dbModality,
        date: args.start_date,
        end_date: args.end_date,
        total_drinks: totalDrinks,
        gross_revenue: Math.round(grossRevenue * 100) / 100,
        items_count: itemsPayload.length,
      },
      message: `Sessão de vendas da ${unitInfo.canonicalName} (${totalDrinks} drinks) registrada com sucesso (ID: ${session.id}).`,
    };
  },
};

export const getSalesSessionsTool: GoatAIToolDefinition = {
  name: "get_sales_sessions",
  domain: "SALES",
  sourceTable: "financial_sessions",
  description: "Consulta sessões de vendas registradas das unidades (Goat Botequim, 7 Steak House) por unidade, data específica ou período.",
  parameters: {
    type: "object",
    properties: {
      unit_name: {
        type: "string",
        description: "Nome da unidade (ex: 'Goat Botequim', '7 Steak House').",
      },
      date: {
        type: "string",
        description: "Data específica da sessão no formato YYYY-MM-DD ou DD/MM (ex: '2026-07-31' ou '31/07').",
      },
      start_date: {
        type: "string",
        description: "Data inicial do período no formato YYYY-MM-DD ou DD/MM (ex: '2026-07-31').",
      },
      end_date: {
        type: "string",
        description: "Data final do período no formato YYYY-MM-DD ou DD/MM (ex: '2026-08-07').",
      },
      dates: {
        type: "array",
        description: "Lista de datas específicas a consultar (ex: ['31/07', '07/08']).",
        items: {
          type: "string",
        },
      },
      month: {
        type: "number",
        description: "Mês a consultar (1 a 12).",
      },
      year: {
        type: "number",
        description: "Ano a consultar (ex: 2026).",
      },
      limit: {
        type: "number",
        description: "Limite de sessões a retornar (padrão 15).",
      },
    },
    required: [],
  },
  requiresConfirmation: false,
  execute: async (
    ctx: ToolContext,
    args: {
      unit_name?: string;
      date?: string;
      start_date?: string;
      end_date?: string;
      dates?: string[];
      month?: number;
      year?: number;
      limit?: number;
    }
  ): Promise<ToolExecutionResult> => {
    const currentYear = args.year || new Date().getFullYear();

    let query = ctx.supabaseAdmin
      .from("financial_sessions")
      .select(`
        id, date, modality, labor_value, labor_quantity, labor_names, labor_details, reposicao_restaurante, custos_restaurante_detalhes,
        financial_session_items (id, drink_name, quantity, unit_price, unit_cost)
      `)
      .order("date", { ascending: false })
      .limit(args.limit || 20);

    const requestedModalityRes = resolveBusinessUnit(args.unit_name);
    if (args.unit_name) {
      if (requestedModalityRes.id === "goat_botequim") {
        query = query.or("modality.eq.Goat Botequim,modality.ilike.%botequim%,modality.ilike.%goatbotequim%");
      } else if (requestedModalityRes.id === "steakhouse") {
        query = query.or("modality.eq.7Steakhouse,modality.ilike.%steakhouse%,modality.ilike.%7Steak%");
      } else {
        query = query.ilike("modality", `%${args.unit_name.trim()}%`);
      }
    }

    let normalizedRequestedDate: string | undefined;
    if (args.date) {
      normalizedRequestedDate = normalizeDateInput(args.date, currentYear);
      query = query.eq("date", normalizedRequestedDate);
    } else if (args.dates && args.dates.length > 0) {
      const normalizedDates = args.dates.map((d) => normalizeDateInput(d, currentYear));
      query = query.in("date", normalizedDates);
    } else {
      if (args.start_date) {
        query = query.gte("date", normalizeDateInput(args.start_date, currentYear));
      }
      if (args.end_date) {
        query = query.lte("date", normalizeDateInput(args.end_date, currentYear));
      }
      if (args.month && !args.start_date && !args.end_date) {
        const mStr = String(args.month).padStart(2, "0");
        query = query.gte("date", `${currentYear}-${mStr}-01`).lte("date", `${currentYear}-${mStr}-31`);
      }
    }

    const { data: rawSessions, error } = await query;
    if (error) {
      return { success: false, error: `Erro ao consultar sessões de vendas: ${error.message}` };
    }

    let candidateSessions = rawSessions || [];
    if (args.unit_name && requestedModalityRes.matched) {
      candidateSessions = candidateSessions.filter((s: any) => {
        const sUnit = resolveBusinessUnit(s.modality);
        return sUnit.id === requestedModalityRes.id;
      });
    }

    const sessionList = candidateSessions.map(calculateSalesSessionMetrics);

    console.log(
      `[GOAT-AI][TOOL][QUERY] toolName=get_sales_sessions requestedDate="${args.date || "none"}" normalizedDate="${normalizedRequestedDate || "none"}" requestedUnit="${args.unit_name || "all"}" canonicalModality="${requestedModalityRes.canonicalName}" resultCount=${sessionList.length}`
    );

    if (sessionList.length === 0) {
      return {
        success: true,
        data: {
          count: 0,
          sessions: [],
          filter_applied: {
            unit: args.unit_name,
            date: args.date,
            normalized_date: normalizedRequestedDate,
            start_date: args.start_date,
            end_date: args.end_date,
            dates: args.dates,
          },
        },
        message: "Nenhuma sessão de vendas encontrada para os critérios e período informados.",
      };
    }

    const first = sessionList[0];
    const summaryMsg =
      sessionList.length === 1
        ? `Sessão de vendas da ${first.unit} em ${first.date}: ${first.total_drinks} drinks vendidos, Receita Bruta de R$ ${first.gross_revenue.toFixed(2)}, Lucro Final de R$ ${first.final_profit.toFixed(2)}.`
        : `${sessionList.length} sessões de vendas encontradas no período.`;

    return {
      success: true,
      data: {
        count: sessionList.length,
        sessions: sessionList,
      },
      message: summaryMsg,
    };
  },
};

export const createControllerEntryTool: GoatAIToolDefinition = {
  name: "create_controller_entry",
  domain: "CONTROLLER",
  sourceTable: "financial_expenses",
  description: "Registra uma despesa, nota fiscal ou comprovante no módulo de Controladoria do Goat Bar.",
  parameters: {
    type: "object",
    properties: {
      supplier_name: { type: "string", description: "Nome do fornecedor ou estabelecimento." },
      supplier_cnpj: { type: "string", description: "CNPJ do fornecedor se identificado." },
      amount: { type: "number", description: "Valor total da nota/despesa." },
      date: { type: "string", description: "Data da compra/emissão no formato YYYY-MM-DD." },
      category: {
        type: "string",
        description: "Categoria da despesa: 'Insumos', 'Fornecedor', 'Equipe', 'Operacional' ou 'Outros'.",
      },
      modality: {
        type: "string",
        description: "Destino da despesa: 'Evento', 'Steakhouse', 'Goatbotequim' ou 'Geral'.",
      },
      event_id: { type: "string", description: "ID do evento caso seja referente a um evento específico." },
      description: { type: "string", description: "Descrição dos itens ou finalidade da compra." },
      payment_method: { type: "string", description: "Forma de pagamento (PIX, Dinheiro, Cartão, Transferência, Outros)." },
      status: { type: "string", description: "Status de pagamento ('Pago' ou 'Pendente')." },
      items: {
        type: "array",
        description: "Itens listados na nota fiscal com quantidades e valores.",
        items: {
          type: "object",
          properties: {
            product_name: { type: "string" },
            quantity: { type: "number" },
            unit_price: { type: "number" },
            total_price: { type: "number" },
          },
        },
      },
    },
    required: ["supplier_name", "amount", "date"],
  },
  requiresConfirmation: true,
  execute: async (ctx: ToolContext, args: {
    supplier_name: string;
    supplier_cnpj?: string;
    amount: number;
    date: string;
    category?: string;
    modality?: string;
    event_id?: string;
    description?: string;
    payment_method?: string;
    status?: string;
    items?: Array<{ product_name: string; quantity: number; unit_price?: number; total_price?: number; unit?: string }>;
  }): Promise<ToolExecutionResult> => {
    const missing: string[] = [];
    if (!args.supplier_name) missing.push("supplier_name");
    if (args.amount == null || isNaN(args.amount)) missing.push("amount");
    if (!args.date) missing.push("date");

    if (missing.length > 0) {
      return { success: false, missing_fields: missing, error: `Campos obrigatórios pendentes: ${missing.join(", ")}` };
    }

    const { data: expense, error } = await ctx.supabaseAdmin
      .from("financial_expenses")
      .insert({
        supplier_name: args.supplier_name,
        supplier_cnpj: args.supplier_cnpj || null,
        amount: args.amount,
        date: args.date,
        category: args.category || "Insumos",
        modality: args.modality || (args.event_id ? "Evento" : "Geral"),
        description: args.description || `Compra de ${args.supplier_name}`,
        payment_method: args.payment_method || "PIX",
        status: args.status || "Pago",
        responsible: ctx.userName || "GIA",
      })
      .select()
      .single();

    if (error || !expense) {
      return { success: false, error: `Erro ao registrar na Controladoria: ${error?.message}` };
    }

    return {
      success: true,
      data: {
        expense_id: expense.id,
        supplier: args.supplier_name,
        amount: args.amount,
        date: args.date,
        category: args.category || "Insumos",
      },
      message: `Despesa de R$ ${args.amount.toFixed(2)} lançada na Controladoria com sucesso.`,
    };
  },
};

export const searchControllerEntriesTool: GoatAIToolDefinition = {
  name: "search_controller_entries",
  domain: "CONTROLLER",
  sourceTable: "financial_expenses",
  description: "Busca lançamentos, despesas e notas fiscais registradas na Controladoria por fornecedor, categoria ou período.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Termo de busca (fornecedor, produto ou descrição)." },
      category: { type: "string", description: "Categoria (ex: 'Insumos', 'Fornecedor', 'Equipe')." },
      limit: { type: "number", description: "Limite de resultados (padrão 10)." },
    },
    required: [],
  },
  requiresConfirmation: false,
  execute: async (ctx: ToolContext, args: { query?: string; category?: string; limit?: number }): Promise<ToolExecutionResult> => {
    let queryBuilder = ctx.supabaseAdmin
      .from("financial_expenses")
      .select("id, date, supplier_name, amount, category, modality, description, status, payment_method")
      .order("date", { ascending: false })
      .limit(args.limit || 15);

    if (args.category) {
      queryBuilder = queryBuilder.ilike("category", `%${args.category}%`);
    }
    if (args.query) {
      queryBuilder = queryBuilder.or(`supplier_name.ilike.%${args.query}%,description.ilike.%${args.query}%`);
    }

    const { data: entries, error } = await queryBuilder;
    if (error) {
      return { success: false, error: `Erro ao consultar controladoria: ${error.message}` };
    }

    return {
      success: true,
      data: {
        count: (entries || []).length,
        entries: entries || [],
      },
    };
  },
};

export const createEventPurchaseTool: GoatAIToolDefinition = {
  name: "create_event_purchase",
  domain: "PURCHASES",
  sourceTable: "financial_expenses",
  description: "Registra uma compra de insumos ou bebidas vinculada diretamente a um evento com entrada no estoque.",
  parameters: {
    type: "object",
    properties: {
      event_id: { type: "string", description: "ID do evento correspondente." },
      supplier_name: { type: "string", description: "Nome do fornecedor (ex: 'Assaí', 'Atacadão')." },
      total_amount: { type: "number", description: "Valor total da compra (ex: 780.00)." },
      date: { type: "string", description: "Data da compra no formato YYYY-MM-DD." },
      items: {
        type: "array",
        description: "Itens comprados com quantidades.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            quantity: { type: "number" },
            unit_price: { type: "number" },
          },
          required: ["name", "quantity"],
        },
      },
    },
    required: ["event_id", "supplier_name", "total_amount"],
  },
  requiresConfirmation: true,
  execute: async (ctx: ToolContext, args: {
    event_id: string;
    supplier_name: string;
    total_amount: number;
    date?: string;
    items?: Array<{ name: string; quantity: number; unit_price?: number }>;
  }): Promise<ToolExecutionResult> => {
    const missing: string[] = [];
    if (!args.event_id) missing.push("event_id");
    if (!args.supplier_name) missing.push("supplier_name");
    if (args.total_amount == null) missing.push("total_amount");

    if (missing.length > 0) {
      return { success: false, missing_fields: missing, error: `Campos obrigatórios pendentes: ${missing.join(", ")}` };
    }

    const { data: purchase, error } = await ctx.supabaseAdmin
      .from("financial_expenses")
      .insert({
        supplier_name: args.supplier_name,
        amount: args.total_amount,
        date: args.date || new Date().toISOString().split("T")[0],
        category: "Insumos",
        modality: "Evento",
        description: `Compra para evento (${args.items?.map((i) => `${i.quantity}x ${i.name}`).join(", ") || "Insumos"})`,
        responsible: ctx.userName || "GIA",
        status: "Pago",
      })
      .select()
      .single();

    if (error || !purchase) {
      return { success: false, error: `Erro ao registrar compra do evento: ${error?.message}` };
    }

    return {
      success: true,
      data: {
        purchase_id: purchase.id,
        event_id: args.event_id,
        supplier: args.supplier_name,
        total: args.total_amount,
      },
      message: `Compra de R$ ${args.total_amount.toFixed(2)} vinculada ao evento com sucesso.`,
    };
  },
};

export const getFinancialSummaryTool: GoatAIToolDefinition = {
  name: "get_financial_summary",
  domain: "FINANCIAL",
  sourceTable: "financial_expenses, events",
  description: "Obtém resumo financeiro consolidado de receitas, despesas e resultado operacional do período.",
  parameters: {
    type: "object",
    properties: {
      period: { type: "string", description: "Período (ex: 'julho', '2026-07', 'mes_atual', 'ano_atual')." },
      month: { type: "number", description: "Mês (1-12)." },
      year: { type: "number", description: "Ano (ex: 2026)." },
    },
    required: [],
  },
  requiresConfirmation: false,
  execute: async (ctx: ToolContext, args: { period?: string; month?: number; year?: number }): Promise<ToolExecutionResult> => {
    const targetYear = args.year || new Date().getFullYear();
    const targetMonth = args.month || (new Date().getMonth() + 1);

    const startDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`;
    const endDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-31`;

    const { data: expenses } = await ctx.supabaseAdmin
      .from("financial_expenses")
      .select("amount, category, modality")
      .gte("date", startDate)
      .lte("date", endDate);

    const { data: events } = await ctx.supabaseAdmin
      .from("events")
      .select("current_budget_value, current_profit_value")
      .gte("date", startDate)
      .lte("date", endDate);

    const totalExpenses = (expenses || []).reduce((acc: number, e: any) => acc + (Number(e.amount) || 0), 0);
    const totalEventRevenue = (events || []).reduce((acc: number, e: any) => acc + (Number(e.current_budget_value) || 0), 0);

    return {
      success: true,
      data: {
        period: `${targetMonth}/${targetYear}`,
        total_revenue: totalEventRevenue,
        total_expenses: totalExpenses,
        net_profit: totalEventRevenue - totalExpenses,
        expenses_count: (expenses || []).length,
      },
    };
  },
};

