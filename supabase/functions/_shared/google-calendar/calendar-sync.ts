import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoatBarEventRecord, SyncEventResult } from "./types.ts";
import { getValidGoogleAccessToken } from "./token-manager.ts";
import {
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
} from "./google-calendar-client.ts";
import { buildGoogleCalendarPayload } from "./event-formatter.ts";

export function isEventConfirmed(status?: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return (
    s === "confirmado" ||
    s === "confirmados" ||
    s === "proposta_aceita" ||
    s === "contrato_assinado" ||
    s === "finalizado" ||
    s.includes("conf")
  );
}

export function isEventCancelled(status?: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return s === "cancelado" || s === "cancelada" || s.includes("canc");
}

export async function syncSingleGoatBarEvent(
  supabaseAdmin: SupabaseClient,
  eventId: string,
  appUrl?: string
): Promise<SyncEventResult> {
  // 1. Fetch event from database
  const { data: event, error: eventError } = await supabaseAdmin
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    return {
      success: false,
      action: "error",
      eventId,
      error: `Evento não encontrado no banco: ${eventError?.message || "ID inexistente"}`,
    };
  }

  const record = event as GoatBarEventRecord;

  // 2. Check for active integration
  let accessToken: string;
  let calendarId: string;

  try {
    const tokenInfo = await getValidGoogleAccessToken(supabaseAdmin);
    accessToken = tokenInfo.accessToken;
    calendarId = tokenInfo.integration.calendar_id || "primary";
  } catch (authErr: any) {
    console.warn(`[calendar-sync] Sem integração ativa para sincronizar evento ${eventId}:`, authErr.message);

    // If no integration exists, mark status gracefully without breaking the event
    await supabaseAdmin
      .from("events")
      .update({
        google_calendar_sync_status: record.google_calendar_event_id ? "error" : "not_synced",
        google_calendar_sync_error: authErr.message,
      })
      .eq("id", eventId);

    return {
      success: false,
      action: "skipped",
      eventId,
      error: authErr.message,
    };
  }

  const confirmed = isEventConfirmed(record.status);
  const cancelled = isEventCancelled(record.status);

  // If event is not confirmed and not cancelled, and not already synced -> skip
  if (!confirmed && !cancelled && !record.google_calendar_event_id) {
    return {
      success: true,
      action: "skipped",
      eventId,
    };
  }

  // 3. Handle Cancelled Event
  if (cancelled) {
    if (!record.google_calendar_event_id) {
      // Nothing on Google Calendar to cancel
      await supabaseAdmin
        .from("events")
        .update({
          google_calendar_sync_status: "not_synced",
          google_calendar_sync_error: null,
        })
        .eq("id", eventId);

      return {
        success: true,
        action: "skipped",
        eventId,
      };
    }

    // Update the existing Google Calendar event with [CANCELADO] prefix
    try {
      const payload = buildGoogleCalendarPayload(record, true, appUrl);
      const result = await updateGoogleCalendarEvent(
        accessToken,
        calendarId,
        record.google_calendar_event_id,
        payload
      );

      await supabaseAdmin
        .from("events")
        .update({
          google_calendar_sync_status: "cancelled",
          google_calendar_synced_at: new Date().toISOString(),
          google_calendar_sync_error: null,
        })
        .eq("id", eventId);

      return {
        success: true,
        action: "cancelled",
        eventId,
        googleCalendarEventId: record.google_calendar_event_id,
      };
    } catch (cancelErr: any) {
      await supabaseAdmin
        .from("events")
        .update({
          google_calendar_sync_status: "error",
          google_calendar_sync_error: `Erro ao cancelar no Google Calendar: ${cancelErr.message}`,
        })
        .eq("id", eventId);

      return {
        success: false,
        action: "error",
        eventId,
        error: cancelErr.message,
      };
    }
  }

  // 4. Handle Confirmed / Active Event
  const payload = buildGoogleCalendarPayload(record, false, appUrl);

  try {
    if (record.google_calendar_event_id) {
      // Update existing calendar entry
      const updateRes = await updateGoogleCalendarEvent(
        accessToken,
        calendarId,
        record.google_calendar_event_id,
        payload
      );

      if (updateRes.notFound) {
        // Event was deleted externally on Google Calendar -> Recreate it!
        console.warn(
          `[calendar-sync] Evento ${record.google_calendar_event_id} não encontrado no Google Calendar. Recriando...`
        );
        const createRes = await createGoogleCalendarEvent(accessToken, calendarId, payload);

        await supabaseAdmin
          .from("events")
          .update({
            google_calendar_event_id: createRes.id,
            google_calendar_html_link: createRes.htmlLink || null,
            google_calendar_synced_at: new Date().toISOString(),
            google_calendar_sync_status: "synced",
            google_calendar_sync_error: null,
          })
          .eq("id", eventId);

        return {
          success: true,
          action: "created",
          eventId,
          googleCalendarEventId: createRes.id,
          htmlLink: createRes.htmlLink,
        };
      }

      await supabaseAdmin
        .from("events")
        .update({
          google_calendar_html_link: updateRes.event?.htmlLink || record.google_calendar_html_link || null,
          google_calendar_synced_at: new Date().toISOString(),
          google_calendar_sync_status: "synced",
          google_calendar_sync_error: null,
        })
        .eq("id", eventId);

      return {
        success: true,
        action: "updated",
        eventId,
        googleCalendarEventId: record.google_calendar_event_id,
        htmlLink: updateRes.event?.htmlLink,
      };
    } else {
      // Create new calendar entry
      const createRes = await createGoogleCalendarEvent(accessToken, calendarId, payload);

      await supabaseAdmin
        .from("events")
        .update({
          google_calendar_event_id: createRes.id,
          google_calendar_html_link: createRes.htmlLink || null,
          google_calendar_synced_at: new Date().toISOString(),
          google_calendar_sync_status: "synced",
          google_calendar_sync_error: null,
        })
        .eq("id", eventId);

      return {
        success: true,
        action: "created",
        eventId,
        googleCalendarEventId: createRes.id,
        htmlLink: createRes.htmlLink,
      };
    }
  } catch (syncErr: any) {
    console.error(`[calendar-sync] Falha ao sincronizar evento ${eventId}:`, syncErr.message);

    await supabaseAdmin
      .from("events")
      .update({
        google_calendar_sync_status: "error",
        google_calendar_sync_error: syncErr.message || "Erro desconhecido ao sincronizar com Google Calendar",
      })
      .eq("id", eventId);

    return {
      success: false,
      action: "error",
      eventId,
      error: syncErr.message,
    };
  }
}

export async function syncAllConfirmedEvents(
  supabaseAdmin: SupabaseClient,
  appUrl?: string
): Promise<{ total: number; synced: number; errors: number; details: SyncEventResult[] }> {
  // Query all confirmed events
  const { data: events, error } = await supabaseAdmin
    .from("events")
    .select("id, status, google_calendar_event_id, google_calendar_sync_status")
    .or("status.ilike.%conf%,status.ilike.%proposta_aceita%,status.ilike.%contrato_assinado%,status.ilike.%finalizado%,google_calendar_sync_status.eq.pending,google_calendar_sync_status.eq.error");

  if (error || !events) {
    throw new Error(`Erro ao buscar eventos para sincronização: ${error?.message || "erro"}`);
  }

  const results: SyncEventResult[] = [];
  let synced = 0;
  let errors = 0;

  for (const ev of events) {
    const res = await syncSingleGoatBarEvent(supabaseAdmin, ev.id, appUrl);
    results.push(res);
    if (res.success) {
      synced++;
    } else if (res.action === "error") {
      errors++;
    }
  }

  // Update integration last_sync_at
  try {
    await supabaseAdmin
      .from("google_calendar_integrations")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_error: errors > 0 ? `${errors} erro(s) na sincronização de ${events.length} evento(s)` : null,
      })
      .eq("status", "connected");
  } catch {
    // non-blocking
  }

  return {
    total: events.length,
    synced,
    errors,
    details: results,
  };
}
