import { GoatAIToolDefinition, ToolContext, ToolExecutionResult } from "../../types.ts";
import { matchUnitName } from "../../matchers/unit-matcher.ts";

export const createSalesSessionTool: GoatAIToolDefinition = {
  name: "create_sales_session",
  description: "Registra uma nova sessão de vendas de uma unidade (ex: 7 Steak House, Goat Botequim) com itens vendidos, mão de obra e total.",
  parameters: {
    type: "object",
    properties: {
      unit_name: {
        type: "string",
        description: "Nome da unidade (ex: '7 Steak House', 'Goat Botequim').",
      },
      start_date: {
        type: "string",
        description: "Data inicial do período no formato YYYY-MM-DD (ex: '2026-08-12').",
      },
      end_date: {
        type: "string",
        description: "Data final do período no formato YYYY-MM-DD (ex: '2026-08-16').",
      },
      responsible: {
        type: "string",
        description: "Nome do responsável pelo fechamento/operação da sessão (ex: 'Jhansen').",
      },
      total_amount: {
        type: "number",
        description: "Valor total bruto apurado na sessão (ex: 1539.50).",
      },
      items: {
        type: "array",
        description: "Lista de drinks e produtos vendidos na sessão.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Nome do drink/produto." },
            quantity: { type: "number", description: "Quantidade vendida." },
            unit_price: { type: "number", description: "Preço unitário." },
            total_price: { type: "number", description: "Preço total do item." },
          },
          required: ["name", "quantity"],
        },
      },
      labor_value: {
        type: "number",
        description: "Valor de mão de obra / acerto barmen.",
      },
      notes: {
        type: "string",
        description: "Observações adicionais sobre o movimento ou atendimento.",
      },
    },
    required: ["unit_name", "start_date", "responsible", "total_amount"],
  },
  requiresConfirmation: true,
  execute: async (ctx: ToolContext, args: {
    unit_name: string;
    start_date: string;
    end_date?: string;
    responsible: string;
    total_amount: number;
    items?: Array<{ name: string; quantity: number; unit_price?: number; total_price?: number; unit_cost?: number }>;
    labor_value?: number;
    notes?: string;
  }): Promise<ToolExecutionResult> => {
    // 1. Validate mandatory fields
    const missing: string[] = [];
    if (!args.unit_name) missing.push("unit_name");
    if (!args.start_date) missing.push("start_date");
    if (!args.responsible) missing.push("responsible");
    if (args.total_amount == null || isNaN(args.total_amount)) missing.push("total_amount");

    if (missing.length > 0) {
      return {
        success: false,
        missing_fields: missing,
        error: `Campos obrigatórios pendentes: ${missing.join(", ")}`,
      };
    }

    const unitInfo = matchUnitName(args.unit_name);
    const dbModality = unitInfo.modality === "Steakhouse" ? "7Steakhouse" : unitInfo.modality === "Goatbotequim" ? "Goat Botequim" : "7Steakhouse";

    // 2. Insert into financial_sessions
    const { data: session, error: sError } = await ctx.supabaseAdmin
      .from("financial_sessions")
      .insert({
        date: args.start_date,
        modality: dbModality,
        labor_names: args.responsible,
        labor_value: args.labor_value || 0,
        reposicao_restaurante: 0,
      })
      .select()
      .single();

    if (sError || !session) {
      return {
        success: false,
        error: `Erro ao criar sessão no banco de dados: ${sError?.message}`,
      };
    }

    // 3. Insert items if present
    if (args.items && args.items.length > 0) {
      const itemsPayload = args.items.map((i) => ({
        session_id: session.id,
        drink_name: i.name,
        quantity: Number(i.quantity) || 1,
        unit_price: Number(i.unit_price) || 0,
        unit_cost: Number(i.unit_cost) || 0,
      }));

      await ctx.supabaseAdmin.from("financial_session_items").insert(itemsPayload);
    }

    return {
      success: true,
      data: {
        session_id: session.id,
        unit: unitInfo.unitName,
        modality: dbModality,
        date: args.start_date,
        responsible: args.responsible,
        total: args.total_amount,
        items_count: args.items?.length || 0,
      },
      message: `Sessão de vendas da ${unitInfo.unitName} registrada com sucesso.`,
    };
  },
};

export const getSalesSessionsTool: GoatAIToolDefinition = {
  name: "get_sales_sessions",
  description: "Consulta sessões de vendas registradas das unidades com seus respectivos itens e totais.",
  parameters: {
    type: "object",
    properties: {
      unit_name: {
        type: "string",
        description: "Nome da unidade (ex: '7 Steak House', 'Goat Botequim').",
      },
      limit: {
        type: "number",
        description: "Limite de sessões a retornar (padrão 10).",
      },
    },
    required: [],
  },
  requiresConfirmation: false,
  execute: async (ctx: ToolContext, args: { unit_name?: string; limit?: number }): Promise<ToolExecutionResult> => {
    let query = ctx.supabaseAdmin
      .from("financial_sessions")
      .select(`
        id, date, modality, labor_value, labor_names,
        financial_session_items (id, drink_name, quantity, unit_price)
      `)
      .order("date", { ascending: false })
      .limit(args.limit || 10);

    if (args.unit_name) {
      const unit = matchUnitName(args.unit_name);
      query = query.ilike("modality", `%${unit.modality}%`);
    }

    const { data: sessions, error } = await query;
    if (error) {
      return { success: false, error: `Erro ao consultar sessões de vendas: ${error.message}` };
    }

    return {
      success: true,
      data: {
        count: (sessions || []).length,
        sessions: sessions || [],
      },
    };
  },
};

export const createControllerEntryTool: GoatAIToolDefinition = {
  name: "create_controller_entry",
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
