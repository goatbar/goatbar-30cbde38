import { GoatBarEventRecord, GoogleCalendarEventPayload } from "./types.ts";
import { buildGoogleCalendarDateTimeRange } from "./time-utils.ts";

export function formatEventSummary(event: GoatBarEventRecord, isCancelled: boolean = false): string {
  let title = "";
  if (event.event_name && event.event_name.trim()) {
    title = event.event_name.trim();
  } else if (event.groom_name && event.bride_name) {
    title = `Casamento ${event.bride_name} e ${event.groom_name}`;
  } else if (event.client_name) {
    title = `${event.client_name} - ${event.event_type || "Evento Goat Bar"}`;
  } else {
    title = `Evento Goat Bar`;
  }

  // Remove existing [CANCELADO] prefix if present to prevent duplication
  const cleanTitle = title.replace(/^\[CANCELADO\]\s*/i, "").trim();

  return isCancelled ? `[CANCELADO] ${cleanTitle}` : cleanTitle;
}

export function formatEventDescription(
  event: GoatBarEventRecord,
  isCancelled: boolean = false,
  appUrl?: string
): string {
  const parts: string[] = [];

  parts.push(`Cliente: ${event.client_name || "Não informado"}`);
  if (event.event_name) {
    parts.push(`Evento: ${event.event_name}`);
  }
  if (event.event_type) {
    parts.push(`Tipo: ${event.event_type}`);
  }
  if (event.guests) {
    parts.push(`Convidados: ${event.guests}`);
  }
  if (event.event_location) {
    const loc = event.city ? `${event.event_location} - ${event.city}` : event.event_location;
    parts.push(`Local: ${loc}`);
  }
  if (event.event_time) {
    parts.push(`Horário: ${event.event_time}`);
  }

  parts.push(`Status Goat Bar: ${isCancelled ? "CANCELADO" : (event.status || "Confirmado")}`);

  if (event.drinks && Array.isArray(event.drinks) && event.drinks.length > 0) {
    parts.push(``);
    parts.push(`Drinks / Cardápio:`);
    parts.push(event.drinks.map((d) => `• ${d}`).join("\n"));
  }

  if (event.notes && event.notes.trim()) {
    parts.push(``);
    parts.push(`Observações:`);
    parts.push(event.notes.trim());
  }

  const baseUrl = (appUrl || "https://goatbar.com.br").replace(/\/+$/, "");
  parts.push(``);
  parts.push(`Abrir no Goat Bar:`);
  parts.push(`${baseUrl}/eventos/${event.id}`);

  return parts.join("\n");
}

export function formatEventLocation(event: GoatBarEventRecord): string | undefined {
  if (!event.event_location && !event.city) return undefined;
  if (event.event_location && event.city) {
    return `${event.event_location}, ${event.city}`;
  }
  return event.event_location || event.city || undefined;
}

export function buildGoogleCalendarPayload(
  event: GoatBarEventRecord,
  isCancelled: boolean = false,
  appUrl?: string
): GoogleCalendarEventPayload {
  const summary = formatEventSummary(event, isCancelled);
  const description = formatEventDescription(event, isCancelled, appUrl);
  const location = formatEventLocation(event);
  const timeRange = buildGoogleCalendarDateTimeRange(event.date, event.event_time);

  return {
    summary,
    description,
    location,
    start: timeRange.start,
    end: timeRange.end,
    status: isCancelled ? "tentative" : "confirmed", // keep visible in calendar
    reminders: {
      useDefault: true,
    },
  };
}
