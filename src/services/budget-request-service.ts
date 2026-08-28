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

export interface PersistedBudgetRequestResult {
  state: "USED";
  idempotent: boolean;
  event_id: string;
}

export function assertPersistedBudgetRequest(value: unknown): PersistedBudgetRequestResult {
  const result = value as Partial<PersistedBudgetRequestResult> | null;
  if (
    !result ||
    result.state !== "USED" ||
    typeof result.event_id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      result.event_id,
    )
  ) {
    throw new Error("A API não confirmou a persistência da solicitação. Tente novamente.");
  }
  return result as PersistedBudgetRequestResult;
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
    return invoke<unknown>({
      action: "submit_public_lead_request",
      context,
      payload,
    }).then(assertPersistedBudgetRequest);
  },
  submit(token: string, payload: BudgetRequestPayload) {
    return invoke<unknown>({ action: "submit", token, payload }).then(assertPersistedBudgetRequest);
  },
};
