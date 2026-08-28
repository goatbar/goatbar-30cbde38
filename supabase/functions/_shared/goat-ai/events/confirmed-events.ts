import { ContextualEvent } from "../types.ts";

export const PIPELINE_CONFIRMED_STATUS = "confirmado";

export interface ExplicitConfirmedEventsIntent {
  matched: boolean;
  limit?: number;
}

/**
 * Resolves the current message only. Conversation history and recentEntities are
 * deliberately not inputs: they may resolve references, but must never create a
 * new search intent.
 */
export function resolveExplicitConfirmedEventsIntent(
  message: string,
): ExplicitConfirmedEventsIntent {
  const normalized = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const mentionsEvents = /\beventos?\b/.test(normalized);
  const mentionsConfirmed = /\bconfirmad[oa]s?\b/.test(normalized);
  if (!mentionsEvents || !mentionsConfirmed) return { matched: false };

  // Pagination is honored only when the user explicitly asks for it.
  const limitMatch = normalized.match(
    /\b(?:primeir[oa]s?|ultim[oa]s?|limite(?: de)?|ate|apenas|so)\s+(\d{1,3})\b/,
  );
  return limitMatch
    ? { matched: true, limit: Math.max(1, Number(limitMatch[1])) }
    : { matched: true };
}

export function toContextualEvent(ev: any): ContextualEvent {
  return {
    eventId: ev.id,
    clientName: ev.client_name,
    eventName: ev.event_name,
    groomName: ev.groom_name,
    brideName: ev.bride_name,
    date: ev.date,
    location: ev.event_location,
    city: ev.city,
    guests: ev.guests,
    status: ev.status,
    currentBudgetValue: ev.current_budget_value,
  };
}

export function formatConfirmedEventsReply(events: any[]): string {
  if (events.length === 0) return "Não encontrei eventos confirmados no Pipeline.";

  const lines = events.map((event, index) => {
    const eventName =
      event.event_name ||
      [event.bride_name, event.groom_name].filter(Boolean).join(" & ") ||
      "Sem nome do evento";
    const client = event.client_name || "Não informado";
    const date = event.date
      ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
          new Date(`${event.date}T00:00:00Z`),
        )
      : "Não informada";
    const location = [event.event_location, event.city].filter(Boolean).join(" — ");
    return `${index + 1}. *${eventName}*\n   Cliente/contratante: ${client} | Data: ${date}${location ? ` | Local: ${location}` : ""}`;
  });

  return `Encontrei ${events.length} evento(s) confirmado(s) no Pipeline:\n\n${lines.join("\n\n")}`;
}
