import { supabase } from "@/integrations/supabase/client";

export type FinancialModality = 'Evento' | 'Steakhouse' | 'Goatbotequim' | 'Geral';
export type FinancialCategory = 'Fornecedor' | 'Equipe' | 'Insumos' | 'Operacional' | 'Outros';
export type FinancialStatus = 'Pago' | 'Pendente';
export type FinancialClassification = 'Direto' | 'Indireto';
export type PaymentMethod = 'PIX' | 'Dinheiro' | 'Cartão' | 'Transferência' | 'Outros';

export interface FinancialExpense {
  id: string;
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
  created_at: string;
  updated_at: string;
}

export const financialService = {
  async listExpenses(filters?: { 
    start_date?: string, 
    end_date?: string, 
    modality?: string, 
    status?: string, 
    category?: string 
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
    const { data, error } = await supabase.from("financial_expenses").select("*").eq("id", id).single();
    if (error) throw error;
    return data as FinancialExpense;
  },

  async createExpense(payload: Partial<FinancialExpense>) {
    const { data, error } = await supabase.from("financial_expenses").insert(payload).select().single();
    if (error) throw error;
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

  async uploadAttachment(file: File, type: 'invoice' | 'receipt') {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${type}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('financial_attachments')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('financial_attachments')
      .getPublicUrl(filePath);

    return publicUrl;
  },

  // --- Sessions (Goat Botequim / 7Steakhouse) ---
  async listSessions() {
    try {
      const { data, error } = await supabase
        .from("financial_sessions")
        .select(`
          *,
          items:financial_session_items(*)
        `)
        .order("date", { ascending: false });

      if (error) {
        if (error.code === 'PGRST204' || error.code === '42P01') {
          console.warn("Tabela financial_sessions não encontrada. Usando LocalStorage.");
          return this.getLocalSessions();
        }
        throw error;
      }
      
      const localSessions = this.getLocalSessions();
      const remoteSessions = (data || []).map(s => ({
        ...s,
        data: s.date,
        modalidade: s.modality,
        maoDeObraValor: s.labor_value,
        maoDeObraQtd: s.labor_quantity,
        maoDeObraNomes: s.labor_names,
        maoDeObraDetalhes: s.labor_details,
        items: (s.items || []).map((i: any) => ({
          ...i,
          nome: i.drink_name,
          precoUnitario: i.unit_price,
          custoUnitario: i.unit_cost,
          custoInsumo: i.ingredient_cost
        }))
      }));

      // Merge avoiding duplicates by id (prefer remote if same id exists)
      const merged = [...remoteSessions];
      localSessions.forEach((ls: any) => {
        if (!merged.find(ms => ms.id === ls.id)) {
          merged.push(ls);
        }
      });

      return merged;
    } catch (e) {
      console.warn("Erro ao buscar sessões do Supabase, tentando LocalStorage:", e);
      return this.getLocalSessions();
    }
  },

  getLocalSessions() {
    const STORAGE_KEY = "goatbar-functional-store-v11";
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const store = JSON.parse(raw);
      return store.financialSessions || [];
    } catch {
      return [];
    }
  },

  async createSession(payload: any) {
    // Try Supabase first
    try {
      const { data: session, error: sError } = await supabase
        .from("financial_sessions")
        .insert({
          date: payload.data,
          modality: payload.modalidade,
          labor_value: payload.maoDeObraValor,
          labor_quantity: payload.maoDeObraQtd,
          labor_names: payload.maoDeObraNomes,
          labor_details: payload.maoDeObraDetalhes
        })
        .select()
        .single();

      if (sError) throw sError;

      if (payload.items && payload.items.length > 0) {
        const itemsPayload = payload.items.map((i: any) => ({
          session_id: session.id,
          drink_id: i.drinkId,
          drink_name: i.nome,
          quantity: i.quantidade,
          unit_price: i.precoUnitario,
          unit_cost: i.custoUnitario,
          ingredient_cost: i.custoInsumo
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
        modality: payload.modalidade,
        labor_value: payload.maoDeObraValor,
        labor_quantity: payload.maoDeObraQtd,
        labor_names: payload.maoDeObraNomes,
        labor_details: payload.maoDeObraDetalhes,
        updated_at: new Date().toISOString()
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
        drink_id: i.drinkId,
        drink_name: i.nome,
        quantity: i.quantidade,
        unit_price: i.precoUnitario,
        unit_cost: i.custoUnitario,
        ingredient_cost: i.custoInsumo
      }));
      const { error: iError } = await supabase
        .from("financial_session_items")
        .insert(itemsPayload);
      if (iError) throw iError;
    }
  },

  calculateMetrics(sessions: any[], events: any[], drinks: any[]) {
    const resolveFallbackCost = (item: any, modalidade: string) => {
      const d = drinks.find(x => x.id === item.drinkId) || drinks.find(x => x.nome === item.nome || x.nome === item.drink_name);
      if (!d) return 0;
      if (modalidade === "7Steakhouse") return Number(d.modalityConfig?.evento?.cost || d.custoUnitario || 0);
      if (modalidade === "Goat Botequim") return Number(item.custoUnitario ?? d.modalityConfig?.goatbotequim?.cost ?? 0);
      return Number(d.custoUnitario || 0);
    };

    // Botequim
    const botList = sessions.filter(s => s.modalidade === "Goat Botequim");
    const botReceita = botList.reduce((acc, s) => acc + (s.items || []).reduce((sum: number, item: any) => sum + (Number(item.precoUnitario || 0) * item.quantidade), 0), 0);
    const botCusto = botList.reduce((acc, s) => {
      return acc + (s.items || []).reduce((sum: number, item: any) => {
        const liveIngredientCost = resolveFallbackCost(item, "Goat Botequim");
        return sum + (Number(liveIngredientCost) * item.quantidade);
      }, 0);
    }, 0);
    const botLabor = botList.reduce((acc, s) => {
      if (s.maoDeObraDetalhes && s.maoDeObraDetalhes.length > 0) {
        return acc + s.maoDeObraDetalhes.reduce((a: number, b: any) => a + Number(b.valor || 0), 0);
      }
      return acc + (Number(s.maoDeObraValor || 0) * Number(s.maoDeObraQtd || 0));
    }, 0);
    const botLucro = (botReceita - botCusto) * 0.6 - botLabor;

    // Steakhouse
    const steakList = sessions.filter(s => s.modalidade === "7Steakhouse");
    // Receita Goatbar = O que o restaurante paga ao Goat Bar (custoUnitario no item)
    const steakReceita = steakList.reduce((acc, s) => acc + (s.items || []).reduce((sum: number, item: any) => sum + (Number(item.custoUnitario || 0) * item.quantidade), 0), 0);
    // Custo Insumos = O que o Goat Bar gasta para fazer (custoInsumo no item ou custoUnitario base do drink)
    const steakCusto = steakList.reduce((acc, s) => {
      return acc + (s.items || []).reduce((sum: number, item: any) => {
        const liveIngredientCost = item.custoInsumo ?? resolveFallbackCost(item, "7Steakhouse");
        return sum + (Number(liveIngredientCost) * item.quantidade);
      }, 0);
    }, 0);
    // Lucro Final = (Receita - Custo) - Mão de Obra
    const steakLucro = (steakReceita - steakCusto) - steakList.reduce((acc, s) => {
      if (s.maoDeObraDetalhes && s.maoDeObraDetalhes.length > 0) {
        return acc + s.maoDeObraDetalhes.reduce((a: number, b: any) => a + Number(b.valor || 0), 0);
      }
      return acc + (Number(s.maoDeObraValor || 0) * Number(s.maoDeObraQtd || 0));
    }, 0);

    // Events
    const confirmedEvents = events.filter(e => ["CONFIRMADO", "FINALIZADO", "REALIZADO", "PROPOSTA_ACEITA"].includes(e.status?.toUpperCase()));
    const eventReceita = confirmedEvents.reduce((acc, e) => acc + (e.current_budget_value || 0), 0);
    const eventLucro = confirmedEvents.reduce((acc, e) => acc + (e.current_profit_value || 0), 0);
    const eventCustos = eventReceita - eventLucro;

    return {
      bot: { receita: botReceita, custo: botCusto, lucro: botLucro },
      steak: { receita: steakReceita, custo: steakCusto, lucro: steakLucro },
      events: { receita: eventReceita, custo: eventCustos, lucro: eventLucro, count: confirmedEvents.length },
      consolidated: {
        receita: botReceita + steakReceita + eventReceita,
        lucro: botLucro + steakLucro + eventLucro
      }
    };
  }
};
