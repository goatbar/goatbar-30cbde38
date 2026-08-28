import { supabase } from "@/integrations/supabase/client";

export type BudgetRequestState = "ACTIVE" | "INVALID" | "EXPIRED" | "USED" | "CANCELLED";
export interface BudgetRequestPayload {
  client_name: string;
  event_name?: string;
  phone: string;
  email?: string;
  date: string;
  event_time?: string;
  event_location?: string;
  city?: string;
  event_type: string;
  guests: number;
  lead_source?: string;
  referral_name?: string;
  notes?: string;
  groom_name?: string;
  bride_name?: string;
  duration_hours: number;
  requested_drink_ids?: string[];
}
export interface PublicDrink {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  ingredients: string[];
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("budget-request", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const budgetRequestService = {
  createBudgetRequestLink(metadata?: { customer_name_hint?: string }) {
    return invoke<{ url: string; expires_at: string }>({ action: "create", metadata });
  },
  validate(token: string) {
    return invoke<{
      state: BudgetRequestState;
      metadata?: { customer_name_hint?: string };
      public_drinks?: PublicDrink[];
    }>({
      action: "validate",
      token,
    });
  },
  submit(token: string, payload: BudgetRequestPayload) {
    return invoke<{ state: "USED"; idempotent: boolean }>({ action: "submit", token, payload });
  },
};
