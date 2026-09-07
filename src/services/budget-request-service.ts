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

export async function extractInvokeErrorMessage(error: unknown): Promise<string> {
  const fallback = "Não foi possível processar a solicitação. Por favor, revise as informações e tente novamente.";
  if (!error) return fallback;

  const candidate = error as {
    message?: string;
    context?: Response | { json?: () => Promise<unknown>; text?: () => Promise<string> };
  };

  if (candidate.context && typeof candidate.context === "object") {
    try {
      if (typeof (candidate.context as any).clone === "function") {
        const cloned = (candidate.context as Response).clone();
        const body = await cloned.json();
        if (body && typeof body === "object") {
          const err = (body as Record<string, unknown>).error || (body as Record<string, unknown>).message;
          if (typeof err === "string" && err.trim()) {
            return err.trim();
          }
        }
      } else if (typeof candidate.context.json === "function") {
        const body = await candidate.context.json();
        if (body && typeof body === "object") {
          const err = (body as Record<string, unknown>).error || (body as Record<string, unknown>).message;
          if (typeof err === "string" && err.trim()) {
            return err.trim();
          }
        }
      }
    } catch {
      try {
        if (typeof (candidate.context as any).clone === "function") {
          const text = await (candidate.context as Response).clone().text();
          if (text && text.trim() && !text.includes("<html") && !text.includes("<!DOCTYPE")) {
            return text.trim();
          }
        }
      } catch {
        // ignore
      }
    }
  }

  const rawMessage = typeof candidate.message === "string" ? candidate.message.trim() : "";
  if (
    !rawMessage ||
    rawMessage.toLowerCase().includes("non-2xx status code") ||
    rawMessage.toLowerCase().includes("functionshttperror")
  ) {
    return fallback;
  }

  return rawMessage;
}

export function normalizePayloadForBackend(payload: BudgetRequestPayload): BudgetRequestPayload {
  let event_type = payload.event_type;
  // O backend Edge Function em produção valida ALLOWED_EVENT_TYPES contendo "Confraternização".
  // "Comemoração" é mapeado para "Confraternização" para garantir compatibilidade retroativa e imediata.
  if (event_type === "Comemoração") {
    event_type = "Confraternização";
  }

  return {
    ...payload,
    event_type,
  };
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("budget-request", { body });
  if (error) {
    const message = await extractInvokeErrorMessage(error);
    throw new Error(message);
  }
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
      payload: normalizePayloadForBackend(payload),
    }).then(assertPersistedBudgetRequest);
  },
  submit(token: string, payload: BudgetRequestPayload) {
    return invoke<unknown>({
      action: "submit",
      token,
      payload: normalizePayloadForBackend(payload),
    }).then(assertPersistedBudgetRequest);
  },
};
