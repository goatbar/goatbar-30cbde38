import { supabase } from "@/integrations/supabase/client";
import Tesseract from "tesseract.js";
import { calculateSteakhouseSessionFinancials } from "@/lib/steakhouse-financials";

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
  matched_product_id?: string;
  matched_confidence?: number;
  raw_product_name?: string;
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

const toSafeDrinkId = (drinkId: unknown): string | null => {
  const value = typeof drinkId === "string" ? drinkId.trim() : "";
  return value || null;
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
      // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
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
        // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
        .from("financial_expense_items")
        // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
        .insert(itemsToInsert);
      if (itemsError) console.error("Error inserting expense items:", itemsError);

      // --- Update Inventory ---
      for (const item of items) {
        if (item.matched_product_id) {
          const { data: invData } = await supabase.from("inventory").select("quantity").eq("id", item.matched_product_id).single();
          if (invData) {
             const newQuantity = Number(invData.quantity || 0) + Number(item.quantity || 0);
             await supabase.from("inventory").update({ quantity: newQuantity, updated_at: new Date().toISOString() }).eq("id", item.matched_product_id);
             
             await supabase.from("inventory_movements").insert({
               inventory_id: item.matched_product_id,
               quantity: item.quantity,
               type: "ENTRADA",
               source: expensePayload.event_id ? `Compra - Evento` : "Compra Controladoria"
             });
          }
        }
      }
    }
    
    return data as FinancialExpense;
  },

  async updateExpense(id: string, payload: Partial<FinancialExpense>) {
    const { data, error } = await supabase
      .from("financial_expenses")
      // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
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

  async parseReceiptText(rawText: string, confidence: number = 100): Promise<ReceiptExtractionResult> {
    try {
      const normalizedText = normalize(rawText);

      // Fetch inventory to try fuzzy matching
      const { data: inventory } = await supabase.from("inventory").select("*");
      const products = inventory || [];

      // Extract CNPJ
      const cnpjMatch = rawText.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14}/);
      
      // Extract Date
      const dateMatch = rawText.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})/);
      
      // Extract Amount
      const amountMatches = [...rawText.matchAll(/(?:total|valor|pago|r\$)[^\d]{0,10}(\d+[\.,]\d{2})/gi)];
      const fallbackAmountMatches = [...rawText.matchAll(/(\d+[\.,]\d{2})/g)];
      
      let amountValue: number | undefined = undefined;
      if (amountMatches.length) {
        amountValue = toFiniteNumber(amountMatches[amountMatches.length - 1][1]);
      } else if (fallbackAmountMatches.length) {
        const vals = fallbackAmountMatches.map(m => toFiniteNumber(m[1])).filter(v => v > 0);
        if (vals.length) amountValue = Math.max(...vals);
      }

      // Extract Supplier Name
      const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 3);
      let supplierName = "";
      if (lines.length > 0) {
        const cnpjLineIdx = lines.findIndex(l => /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14}/.test(l));
        if (cnpjLineIdx > 0) {
          supplierName = lines[0];
        } else {
          supplierName = lines[0];
        }
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

      // Helper for fuzzy match
      const normalizeForSearch = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
      
      const fuzzyMatchProduct = (text: string) => {
        const query = normalizeForSearch(text);
        const exact = products.find(p => normalizeForSearch(p.name || "") === query);
        if (exact) return { product: exact, confidence: 1 };
        
        let bestMatch = null;
        let bestScore = 0;
        
        for (const p of products) {
          const pName = normalizeForSearch(p.name || "");
          if (!pName) continue;
          
          if (pName.includes(query) || query.includes(pName)) {
            const score = Math.min(pName.length, query.length) / Math.max(pName.length, query.length);
            if (score > bestScore) {
              bestScore = score;
              bestMatch = p;
            }
          } else {
             const words1 = query.split(' ');
             const words2 = pName.split(' ');
             let overlap = 0;
             for (const w1 of words1) {
               if (w1.length > 2 && words2.some(w2 => w2 === w1 || w2.includes(w1) || w1.includes(w2))) {
                 overlap++;
               }
             }
             const score = overlap / Math.max(words1.length, words2.length);
             if (score > bestScore) {
               bestScore = score;
               bestMatch = p;
             }
          }
        }
        
        if (bestScore > 0.4) return { product: bestMatch, confidence: bestScore };
        return { product: null, confidence: 0 };
      };

      // Extract items (Heuristic)
      const extractedItems: FinancialExpenseItem[] = [];
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

          if (price2 && Math.abs((price1 * qty) - price2) < 0.1) {
            unit_price = price1;
            total_price = price2;
          } else if (price2 && Math.abs((price2 * qty) - price1) < 0.1) {
             unit_price = price2;
             total_price = price1;
          }

          if (name.length > 2 && !name.toLowerCase().includes("total") && !name.toLowerCase().includes("troco")) {
            const matched = fuzzyMatchProduct(name);
            extractedItems.push({
              product_name: matched.product ? matched.product.name : name,
              raw_product_name: name,
              quantity: qty,
              // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
              unit: matched.product ? (matched.product.default_unit || unit) : unit,
              unit_price,
              total_price,
              suggested_category: matched.product ? matched.product.category : inferCategoryFromText(name),
              reviewed: false,
              matched_product_id: matched.product ? matched.product.id : undefined,
              matched_confidence: matched.confidence
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
      console.error("Text parse Error:", error);
      return {
        raw_text: rawText,
        review_status: "Erro na leitura",
        auto_filled_fields: [],
        confidence: 100,
      };
    }
  },

  async extractExpenseFromReceipt(file: File): Promise<ReceiptExtractionResult> {
    try {
      const result = await Tesseract.recognize(file, 'por', {
        logger: m => console.log(m),
      });
      const rawText = result.data.text || "";
      const confidence = result.data.confidence || 0;
      
      return await this.parseReceiptText(rawText, confidence);
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

  async extractExpenseFromText(rawText: string): Promise<ReceiptExtractionResult> {
    return await this.parseReceiptText(rawText, 100);
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
    // Preserva rigorosamente os valores de preço e custo gravados no snapshot do item da sessão.
    // Consulta o catálogo live de drinks apenas se o lançamento original não contiver os valores salvos.
    const resolveLivePrice = (item: any, modalidade: string): number => {
      if (item.precoUnitario !== undefined && item.precoUnitario !== null && !isNaN(Number(item.precoUnitario))) {
        return toFiniteNumber(item.precoUnitario);
      }

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
      return 0;
    };

    const resolvePersistedCost = (item: any, modalidade: string): number => {
      if (item.custoInsumo !== undefined && item.custoInsumo !== null && !isNaN(Number(item.custoInsumo))) {
        return toFiniteNumber(item.custoInsumo);
      }
      if (item.custoUnitario !== undefined && item.custoUnitario !== null && !isNaN(Number(item.custoUnitario))) {
        return toFiniteNumber(item.custoUnitario);
      }

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

      return 0;
    };

    const resolvePersistedCustoUnitario = (item: any, modalidade: string): number => {
      if (item.custoUnitario !== undefined && item.custoUnitario !== null && !isNaN(Number(item.custoUnitario))) {
        return toFiniteNumber(item.custoUnitario);
      }

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
      return 0;
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

    // Steakhouse - Centralized and audited pure calculation
    const steakList = sessions.filter((s) => normalizeModality(s.modalidade) === "7Steakhouse");
    const steakCalculatedList = steakList.map((s) => calculateSteakhouseSessionFinancials(s, drinks));

    const steakReceita = steakCalculatedList.reduce((acc, s) => acc + s.receitaGoatBar, 0);
    const steakCustoInsumos = steakCalculatedList.reduce((acc, s) => acc + s.custoInsumos, 0);
    const steakLucro = steakCalculatedList.reduce((acc, s) => acc + s.lucroFinal, 0);

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
      steak: { receita: steakReceita, custo: steakCustoInsumos, lucro: steakLucro },
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


