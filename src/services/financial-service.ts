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
  }
};
