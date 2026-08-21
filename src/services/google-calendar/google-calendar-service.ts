import { supabase } from "@/integrations/supabase/client";

export interface GoogleCalendarIntegrationStatus {
  connected: boolean;
  status: "connected" | "disconnected" | "reauthorization_required" | "error";
  email?: string;
  name?: string;
  avatar?: string;
  calendarId?: string;
  calendarName?: string;
  lastSyncAt?: string;
  lastSyncError?: string;
}

export interface GoogleCalendarEntry {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  timeZone?: string;
  accessRole?: string;
}

export const googleCalendarService = {
  async getStatus(): Promise<GoogleCalendarIntegrationStatus> {
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "status" },
      });

      if (error) {
        console.warn("[googleCalendarService] Erro ao obter status:", error);
        return { connected: false, status: "disconnected" };
      }

      return data as GoogleCalendarIntegrationStatus;
    } catch (err: any) {
      console.warn("[googleCalendarService] Falha ao consultar status:", err);
      return { connected: false, status: "disconnected" };
    }
  },

  async startOAuth(): Promise<string> {
    const { data, error } = await supabase.functions.invoke("google-calendar-oauth/start");

    if (error || !data?.authorization_url) {
      throw new Error(data?.error || error?.message || "Falha ao iniciar autenticação com Google Calendar.");
    }

    return data.authorization_url;
  },

  async listCalendars(): Promise<GoogleCalendarEntry[]> {
    const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
      body: { action: "list_calendars" },
    });

    if (error || !data?.success) {
      throw new Error(data?.error || error?.message || "Falha ao carregar calendários do Google.");
    }

    return data.calendars as GoogleCalendarEntry[];
  },

  async selectCalendar(calendarId: string, calendarName?: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
      body: { action: "select_calendar", calendarId, calendarName },
    });

    if (error || !data?.success) {
      throw new Error(data?.error || error?.message || "Falha ao selecionar agenda.");
    }
  },

  async disconnect(): Promise<void> {
    const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
      body: { action: "disconnect" },
    });

    if (error || !data?.success) {
      throw new Error(data?.error || error?.message || "Falha ao desconectar Google Calendar.");
    }
  },

  async syncEvent(eventId: string): Promise<{ success: boolean; action?: string; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "sync_event", eventId },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: Boolean(data?.success),
        action: data?.result?.action,
        error: data?.result?.error,
      };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  },

  async syncAllConfirmed(): Promise<{ total: number; synced: number; errors: number }> {
    const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
      body: { action: "sync_all" },
    });

    if (error || !data?.summary) {
      throw new Error(data?.error || error?.message || "Falha ao sincronizar eventos com Google Calendar.");
    }

    return data.summary;
  },
};
