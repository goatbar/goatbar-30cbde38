import { supabase } from "@/integrations/supabase/client";
import Tesseract from "tesseract.js";

export type FinancialModality = "Evento" | "Steakhouse" | "Goatbotequim" | "Geral";
export type FinancialCategory = "Fornecedor" | "Equipe" | "Insumos" | "Operacional" | "Outros";
export type FinancialStatus = "Pago" | "Pendente";
export type FinancialClassification = "Direto" | "Indireto";
export type PaymentMethod = "PIX" | "Dinheiro" | "Cartão" | "Transferência" | "Outros";

export interface FinancialExpense {
  id: string;
  event_id?: string;
  date: string;
  due_date?: string;
  modality: FinancialModality;
  category: FinancialCategory;
  description: string;
  amount: number;
  responsible: string;
  payment_method: PaymentMethod;
  status: FinancialStatus;
  classification: FinancialClassification;
  supplier_name?: string;
  staff_name?: string;
  staff_role?: string;
  invoice_url?: string;
  receipt_url?: string;
  expense_type?: "despesa";
  supplier_cnpj?: string;
  cost_center?: string;
  payment_source?: string;
  review_status?: "Lido automaticamente" | "Precisa revisar" | "Erro na leitura";
  ocr_raw_text?: string;
  ocr_metadata?: Record<string, unknown>;
  auto_filled_fields?: string[];
  manually_edited_fields?: string[];
  created_at: string;
  updated_at: string;
}

export interface FinancialExpenseItem {
  id?: string;
  expense_id?: string;
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  suggested_category?: string;
  reviewed?: boolean;
}

export interface ReceiptExtractionResult {
  supplier_name?: string;
  supplier_cnpj?: string;
  date?: string;
  amount?: number;
  payment_method?: PaymentMethod;
  items?: FinancialExpenseItem[];
  description?: string;
  category?: FinancialCategory;
  cost_center?: string;
  payment_source?: string;
  raw_text: string;
  review_status: "Lido automaticamente" | "Precisa revisar" | "Erro na leitura";
  confidence?: number;
  auto_filled_fields: string[];
}

const CATEGORY_HINTS: Array<{ keywords: string[]; category: FinancialCategory }> = [
  { keywords: ["vodka", "gin", "cerveja", "energetico", "bebida"], category: "Insumos" },
  { keywords: ["copo", "guardanapo", "canudo", "descart"], category: "Operacional" },
  { keywords: ["gelo"], category: "Operacional" },
  { keywords: ["transporte", "gasolina", "uber", "estacionamento"], category: "Operacional" },
  { keywords: ["freelancer", "bartender", "equipe"], category: "Equipe" },
  { keywords: ["decoracao", "flores", "visual"], category: "Operacional" },
  { keywords: ["supermercado", "atacadao", "assai", "epa", "bh"], category: "Insumos" },
];

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const inferCategoryFromText = (text: string): FinancialCategory => {
  const normalized = normalize(text);
  const match = CATEGORY_HINTS.find((rule) => rule.keywords.some((k) => normalized.includes(k)));
  return match?.category || "Outros";
};

const normalizeModality = (value: string | null | undefined): string => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "goatbotequim" || normalized === "goat botequim") return "Goat Botequim";
  if (normalized === "7steakhouse" || normalized === "steakhouse") return "7Steakhouse";
  if (normalized === "evento" || normalized === "evento(s)") return "Evento";
  return value || "";
};

const toDatabaseModality = (value: string | null | undefined): string => {
  const normalized = normalizeModality(value);
  if (normalized === "Goat Botequim" || normalized === "7Steakhouse") return normalized;
  // fallback seguro: sessões de vendas deste módulo só aceitam essas duas modalidades
  return "Goat Botequim";
};

const toFiniteNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = value
      .trim()
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^0-9.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toSafeDrinkId = (drinkId: unknown): string | null => {
  const value = typeof drinkId === "string" ? drinkId.trim() : "";
  if (!value) return null;
  return UUID_V4_REGEX.test(value) ? value : null;
};

export const financialService = {
  async listExpenses(filters?: {
    start_date?: string;
    end_date?: string;
    modality?: string;
    status?: string;
    category?: string;
  }) {
    let query = supabase.from("financial_expenses").select("*").order("date", { ascending: false });

    if (filters?.start_date) query = query.gte("date", filters.start_date);
    if (filters?.end_date) query = query.lte("date", filters.end_date);
    if (filters?.modality) query = query.eq("modality", filters.modality);
    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.category) query = query.eq("category", filters.category);

    const { data, error } = await query;
    if (error) throw error;
    return data as FinancialExpense[];
  },

  async getExpenseById(id: string) {
    const { data, error } = await supabase
      .from("financial_expenses")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as FinancialExpense;
  },

  async createExpense(payload: Partial<FinancialExpense> & { items?: FinancialExpenseItem[] }) {
    const { items, ...expensePayload } = payload;
    
    const { data, error } = await supabase
      .from("financial_expenses")
      .insert(expensePayload)
      .select()
      .single();
    if (error) throw error;
    
    if (items && items.length > 0 && data.id) {
      const itemsToInsert = items.map(item => ({
        expense_id: data.id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        total_price: item.total_price,
        suggested_category: item.suggested_category,
        reviewed: item.reviewed || false
      }));
      const { error: itemsError } = await supabase
        .from("financial_expense_items")
        .insert(itemsToInsert);
      if (itemsError) console.error("Error inserting expense items:", itemsError);
    }
    
    return data as FinancialExpense;
  },

  async updateExpense(id: string, payload: Partial<FinancialExpense>) {
    const { data, error } = await supabase
      .from("financial_expenses")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as FinancialExpense;
  },

  async deleteExpense(id: string) {
    const { error } = await supabase.from("financial_expenses").delete().eq("id", id);
    if (error) throw error;
  },

  async uploadAttachment(file: File, type: "invoice" | "receipt") {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}_${type}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("financial_attachments")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("financial_attachments").getPublicUrl(filePath);

    return publicUrl;
  },

  async extractExpenseFromReceipt(file: File): Promise<ReceiptExtractionResult> {
    try {
      const result = await Tesseract.recognize(file, 'por', {
        logger: m => console.log(m),
      });

      const rawText = result.data.text || "";
      const confidence = result.data.confidence || 0;
      const normalizedText = normalize(rawText);

      // Extract CNPJ
      const cnpjMatch = rawText.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14}/);
      
      // Extract Date (tries standard formats)
      const dateMatch = rawText.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})/);
      
      // Extract Amount (looks for largest value after words like total, valor or R$)
      const amountMatches = [...rawText.matchAll(/(?:total|valor|pago|r\$)[^\d]{0,10}(\d+[\.,]\d{2})/gi)];
      const fallbackAmountMatches = [...rawText.matchAll(/(\d+[\.,]\d{2})/g)];
      
      let amountValue: number | undefined = undefined;
      if (amountMatches.length) {
        amountValue = toFiniteNumber(amountMatches[amountMatches.length - 1][1]);
      } else if (fallbackAmountMatches.length) {
        const vals = fallbackAmountMatches.map(m => toFiniteNumber(m[1])).filter(v => v > 0);
        if (vals.length) amountValue = Math.max(...vals);
      }

      // Extract Supplier Name (heuristic: first non-empty line before CNPJ usually)
      const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 3);
      let supplierName = "";
      if (lines.length > 0) {
        // Find line with CNPJ to take previous lines, or just take first line
        const cnpjLineIdx = lines.findIndex(l => /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14}/.test(l));
        if (cnpjLineIdx > 0) {
          supplierName = lines[0]; // first line is usually the name
        } else {
          supplierName = lines[0];
        }
        // Clean up common receipt headers
        supplierName = supplierName.replace(/cnpj.*|extrato.*|cupom.*/i, "").trim();
      }

      // Extract Payment Method
      const paymentMethod: PaymentMethod | undefined = normalizedText.includes("pix")
        ? "PIX"
        : normalizedText.includes("dinheiro")
          ? "Dinheiro"
          : (normalizedText.includes("cartao") || normalizedText.includes("debito") || normalizedText.includes("credito"))
            ? "Cartão"
            : normalizedText.includes("transfer")
              ? "Transferência"
              : undefined;

      const auto_filled_fields: string[] = [];
      if (cnpjMatch) auto_filled_fields.push("supplier_cnpj");
      if (dateMatch) auto_filled_fields.push("date");
      if (amountValue) auto_filled_fields.push("amount");
      if (paymentMethod) auto_filled_fields.push("payment_method");
      if (supplierName) auto_filled_fields.push("supplier_name");

      // Extract items (Heuristic)
      const extractedItems: FinancialExpenseItem[] = [];
      // Look for patterns like: "1 UN VODKA 45,00 45,00" or "02 VODKA ABSOLUT 50.00 100.00"
      // [qty] [unit?] [name] [unit_price?] [total_price]
      const itemRegex = /^(\d+[\.,]?\d*)\s*(un|kg|l|cx|pct)?\s+(.+?)\s+(\d+[\.,]\d{2})(?:\s+(\d+[\.,]\d{2}))?$/i;
      
      lines.forEach(line => {
        const match = line.match(itemRegex);
        if (match) {
          const qty = toFiniteNumber(match[1]) || 1;
          const unit = match[2]?.toLowerCase() || 'un';
          const name = match[3].trim();
          let price1 = toFiniteNumber(match[4]);
          let price2 = match[5] ? toFiniteNumber(match[5]) : undefined;
          
          let unit_price = price1;
          let total_price = price2 !== undefined ? price2 : price1;

          // If they are equal, or unit_price * qty approx total_price
          if (price2 && Math.abs((price1 * qty) - price2) < 0.1) {
            unit_price = price1;
            total_price = price2;
          } else if (price2 && Math.abs((price2 * qty) - price1) < 0.1) {
             // reversed order in receipt
             unit_price = price2;
             total_price = price1;
          }

          if (name.length > 2 && !name.toLowerCase().includes("total") && !name.toLowerCase().includes("troco")) {
            extractedItems.push({
              product_name: name,
              quantity: qty,
              unit,
              unit_price,
              total_price,
              suggested_category: inferCategoryFromText(name),
              reviewed: false
            });
          }
        }
      });

      return {
        raw_text: rawText,
        supplier_name: supplierName || undefined,
        supplier_cnpj: cnpjMatch?.[0],
        date: dateMatch?.[1],
        amount: amountValue,
        payment_method: paymentMethod,
        category: inferCategoryFromText(rawText),
        review_status: auto_filled_fields.length >= 3 ? "Lido automaticamente" : "Precisa revisar",
        auto_filled_fields,
        confidence,
        items: extractedItems,
      };
    } catch (error) {
      console.error("OCR Error:", error);
      return {
        raw_text: "",
        review_status: "Erro na leitura",
        auto_filled_fields: [],
        confidence: 0,
      };
    }
  },



  async createReceiptLog(payload: {
    expense_id: string;
    is_ocr_generated: boolean;
    auto_filled_fields: string[];
    manually_edited_fields: string[];
    reading_error: string | null;
    metadata: Record<string, unknown>;
  }) {
    const { error } = await supabase.from("financial_expense_receipt_logs" as never).insert(payload as never);
    if (error) throw error;
  },

  // --- Sessions (Goat Botequim / 7Steakhouse) ---
  async listSessions() {
    try {
      const { data, error } = await supabase
        .from("financial_sessions")
        .select(
          `
          *,
          items:financial_session_items(*)
        `,
        )
        .order("date", { ascending: false });

      if (error) throw error;

      const remoteSessions = (data || []).map((s) => ({
        ...s,
        data: s.date,
        modalidade: normalizeModality(s.modality),
        maoDeObraValor: s.labor_value,
        maoDeObraQtd: s.labor_quantity,
        maoDeObraNomes: s.labor_names,
        maoDeObraDetalhes: s.labor_details,
        reposicaoRestaurante: s.reposicao_restaurante,
        custosRestauranteDetalhes: s.custos_restaurante_detalhes,
        items: (s.items || []).map((i: any) => ({
          ...i,
          // Map DB column names → app interface names (the root cause of all R$ 0,00)
          drinkId: i.drink_id, // drink_id → drinkId (needed by resolvePersistedCost)
          nome: i.drink_name, // drink_name → nome
          quantidade: i.quantity, // quantity → quantidade (was undefined → NaN → R$0)
          precoUnitario: i.unit_price, // unit_price → precoUnitario
          custoUnitario: i.unit_cost, // unit_cost → custoUnitario
          custoInsumo: i.ingredient_cost, // ingredient_cost → custoInsumo
        })),
      }));

      return remoteSessions.map((session: any) => ({
        ...session,
        modalidade: normalizeModality(session.modalidade),
      }));
    } catch (e) {
      console.error("Erro ao buscar sessões do Supabase.", {
        table: "financial_sessions",
        query: "select financial_sessions with financial_session_items order by date",
        error: e,
      });
      throw e;
    }
  },

  async createSession(payload: any) {
    // Try Supabase first
    try {
      const { data: session, error: sError } = await supabase
        .from("financial_sessions")
        .insert({
          date: payload.data,
          modality: toDatabaseModality(payload.modalidade),
          labor_value: payload.maoDeObraValor,
          labor_quantity: payload.maoDeObraQtd,
          labor_names: payload.maoDeObraNomes,
          labor_details: payload.maoDeObraDetalhes,
          reposicao_restaurante: payload.reposicaoRestaurante || 0,
          custos_restaurante_detalhes: payload.custosRestauranteDetalhes || [],
        })
        .select()
        .single();

      if (sError) throw sError;

      if (payload.items && payload.items.length > 0) {
        const itemsPayload = payload.items.map((i: any) => ({
          session_id: session.id,
          drink_id: toSafeDrinkId(i.drinkId),
          drink_name: i.nome,
          quantity: i.quantidade,
          unit_price: i.precoUnitario,
          unit_cost: i.custoUnitario,
          ingredient_cost: i.custoInsumo,
        }));

        const { error: iError } = await supabase
          .from("financial_session_items")
          .insert(itemsPayload);

        if (iError) throw iError;
      }

      return session;
    } catch (e) {
      console.warn("Erro ao criar sessão no Supabase, verifique se a tabela existe.", e);
      throw e;
    }
  },

  async updateSession(id: string, payload: any) {
    const { error: sError } = await supabase
      .from("financial_sessions")
      .update({
        date: payload.data,
        modality: toDatabaseModality(payload.modalidade),
        labor_value: payload.maoDeObraValor,
        labor_quantity: payload.maoDeObraQtd,
        labor_names: payload.maoDeObraNomes,
        labor_details: payload.maoDeObraDetalhes,
        reposicao_restaurante: payload.reposicaoRestaurante || 0,
        custos_restaurante_detalhes: payload.custosRestauranteDetalhes || [],
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (sError) throw sError;

    const { error: deleteItemsError } = await supabase
      .from("financial_session_items")
      .delete()
      .eq("session_id", id);
    if (deleteItemsError) throw deleteItemsError;

    if (payload.items && payload.items.length > 0) {
      const itemsPayload = payload.items.map((i: any) => ({
        session_id: id,
        drink_id: toSafeDrinkId(i.drinkId),
        drink_name: i.nome,
        quantity: i.quantidade,
        unit_price: i.precoUnitario,
        unit_cost: i.custoUnitario,
        ingredient_cost: i.custoInsumo,
      }));
      const { error: iError } = await supabase.from("financial_session_items").insert(itemsPayload);
      if (iError) throw iError;
    }
  },

  async deleteSession(id: string) {
    const { error } = await supabase.from("financial_sessions").delete().eq("id", id);

    if (error) throw error;
  },

  calculateMetrics(sessions: any[], events: any[], drinks: any[]) {
    // Resolve price, operational cost and insumo cost dynamically prioritizing live drink configuration:
    // If the drink is found in the current live database catalog, use its latest values.
    // Otherwise, fallback to the values persisted in the session item.
    const resolveLivePrice = (item: any, modalidade: string): number => {
      const d =
        drinks.find((x: any) => x.id === item.drinkId) ||
        drinks.find((x: any) => x.nome === item.nome || x.nome === item.drink_name);

      if (d) {
        const livePrice =
          modalidade === "7Steakhouse"
            ? d.modalityConfig?.steakhouse?.price
            : d.modalityConfig?.goatbotequim?.price;
        if (livePrice !== undefined && livePrice !== null) {
          return toFiniteNumber(livePrice);
        }
      }
      return toFiniteNumber(item.precoUnitario ?? 0);
    };

    const resolvePersistedCost = (item: any, modalidade: string): number => {
      const d =
        drinks.find((x: any) => x.id === item.drinkId) ||
        drinks.find((x: any) => x.nome === item.nome || x.nome === item.drink_name);

      if (d) {
        const liveCost =
          modalidade === "7Steakhouse"
            ? d.modalityConfig?.evento?.cost
            : d.modalityConfig?.goatbotequim?.cost;
        if (liveCost !== undefined && liveCost !== null) {
          return toFiniteNumber(liveCost);
        }
        return toFiniteNumber(d.custoUnitario ?? 0);
      }

      if (modalidade === "7Steakhouse") {
        return toFiniteNumber(item.custoInsumo ?? item.custoUnitario ?? 0);
      }
      return toFiniteNumber(item.custoUnitario ?? item.custoInsumo ?? 0);
    };

    const resolvePersistedCustoUnitario = (item: any, modalidade: string): number => {
      const d =
        drinks.find((x: any) => x.id === item.drinkId) ||
        drinks.find((x: any) => x.nome === item.nome || x.nome === item.drink_name);

      if (d) {
        const liveCost =
          modalidade === "7Steakhouse"
            ? d.modalityConfig?.steakhouse?.cost
            : d.modalityConfig?.goatbotequim?.cost;
        if (liveCost !== undefined && liveCost !== null) {
          return toFiniteNumber(liveCost);
        }
        return toFiniteNumber(d.custoUnitario ?? 0);
      }
      return toFiniteNumber(item.custoUnitario ?? 0);
    };

    // BUG 5 fix: normalize modalidade before filtering to catch LocalStorage sessions
    // that may have stored old values like "Goatbotequim" without a space.
    const botList = sessions.filter((s) => normalizeModality(s.modalidade) === "Goat Botequim");
    const botReceita = botList.reduce(
      (acc, s) =>
        acc +
        (s.items || []).reduce(
          (sum: number, item: any) =>
            sum + resolveLivePrice(item, "Goat Botequim") * toFiniteNumber(item.quantidade),
          0,
        ),
      0,
    );
    const botCusto = botList.reduce((acc, s) => {
      return (
        acc +
        (s.items || []).reduce((sum: number, item: any) => {
          // BUG 3 fix: use persisted cost first, with toFiniteNumber for safety
          return (
            sum + resolvePersistedCost(item, "Goat Botequim") * toFiniteNumber(item.quantidade)
          );
        }, 0)
      );
    }, 0);
    const botLabor = botList.reduce((acc, s) => {
      if (s.maoDeObraDetalhes && s.maoDeObraDetalhes.length > 0) {
        return (
          acc + s.maoDeObraDetalhes.reduce((a: number, b: any) => a + toFiniteNumber(b.valor), 0)
        );
      }
      return acc + toFiniteNumber(s.maoDeObraValor) * toFiniteNumber(s.maoDeObraQtd);
    }, 0);
    const botLucro = (botReceita - botCusto) * 0.6 - botLabor;

    // Steakhouse
    const steakList = sessions.filter((s) => normalizeModality(s.modalidade) === "7Steakhouse");
    // Receita Goatbar = O que o restaurante paga ao Goat Bar (custoUnitario no item)
    const steakReceita = steakList.reduce(
      (acc, s) =>
        acc +
        (s.items || []).reduce(
          (sum: number, item: any) =>
            sum +
            resolvePersistedCustoUnitario(item, "7Steakhouse") * toFiniteNumber(item.quantidade),
          0,
        ),
      0,
    );
    // Custo Insumos = O que o Goat Bar gasta para fazer (custoInsumo — BUG 3 fix: persisted first)
    const steakCustoInsumos = steakList.reduce((acc, s) => {
      return (
        acc +
        (s.items || []).reduce((sum: number, item: any) => {
          // BUG 3 fix: use persisted cost first, with toFiniteNumber for safety
          return sum + resolvePersistedCost(item, "7Steakhouse") * toFiniteNumber(item.quantidade);
        }, 0)
      );
    }, 0);
    // Total reposição do restaurante nas sessões da Steakhouse
    const steakReposicao = steakList.reduce(
      (acc, s) => acc + toFiniteNumber(s.reposicaoRestaurante),
      0,
    );
    const steakCustoTotal = steakCustoInsumos + steakReposicao;
    // Lucro Final = (Receita - Custo Total) - Mão de Obra
    const steakLucro =
      steakReceita -
      steakCustoTotal -
      steakList.reduce((acc, s) => {
        if (s.maoDeObraDetalhes && s.maoDeObraDetalhes.length > 0) {
          return (
            acc + s.maoDeObraDetalhes.reduce((a: number, b: any) => a + toFiniteNumber(b.valor), 0)
          );
        }
        return acc + toFiniteNumber(s.maoDeObraValor) * toFiniteNumber(s.maoDeObraQtd);
      }, 0);

    // Events
    const confirmedEvents = events.filter((e) =>
      ["CONFIRMADO", "FINALIZADO", "REALIZADO", "PROPOSTA_ACEITA"].includes(
        e.status?.toUpperCase(),
      ),
    );
    const eventReceita = confirmedEvents.reduce((acc, e) => acc + (e.current_budget_value || 0), 0);
    const eventLucro = confirmedEvents.reduce((acc, e) => acc + (e.current_profit_value || 0), 0);
    const eventCustos = eventReceita - eventLucro;

    return {
      bot: { receita: botReceita, custo: botCusto, lucro: botLucro },
      steak: { receita: steakReceita, custo: steakCustoTotal, lucro: steakLucro },
      events: {
        receita: eventReceita,
        custo: eventCustos,
        lucro: eventLucro,
        count: confirmedEvents.length,
      },
      consolidated: {
        receita: botReceita + steakReceita + eventReceita,
        lucro: botLucro + steakLucro + eventLucro,
      },
    };
  },
};
