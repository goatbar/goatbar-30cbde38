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

export interface PublicLeadContext {
  visitor_id: string;
  session_id: string;
  source?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
  landing_page?: string;
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
  startPublicJourney(context: PublicLeadContext) {
    return invoke<{ state: "ACTIVE"; public_drinks?: PublicDrink[] }>({
      action: "start_public_journey",
      context,
    });
  },
  capturePublicLead(
    context: PublicLeadContext,
    contact: { client_name: string; phone: string; email?: string },
  ) {
    return invoke<{ lead_id: string; state: "CONTACT_CAPTURED" }>({
      action: "capture_public_lead",
      context,
      contact,
    });
  },
  submitPublicLeadRequest(context: PublicLeadContext, payload: BudgetRequestPayload) {
    return invoke<{ state: "USED"; idempotent: boolean; event_id?: string }>({
      action: "submit_public_lead_request",
      context,
      payload,
    });
  },
  submit(token: string, payload: BudgetRequestPayload) {
    return invoke<{ state: "USED"; idempotent: boolean }>({ action: "submit", token, payload });
  },
};
