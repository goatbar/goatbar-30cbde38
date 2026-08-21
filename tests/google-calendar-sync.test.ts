import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isEventCancelled,
  isEventConfirmed,
  syncSingleGoatBarEvent,
} from "../supabase/functions/_shared/google-calendar/calendar-sync";

describe("Google Calendar - Event Sync Logic", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("accurately identifies confirmed and cancelled status strings", () => {
    expect(isEventConfirmed("confirmado")).toBe(true);
    expect(isEventConfirmed("CONFIRMADO")).toBe(true);
    expect(isEventConfirmed("proposta_aceita")).toBe(true);
    expect(isEventConfirmed("contrato_assinado")).toBe(true);
    expect(isEventConfirmed("finalizado")).toBe(true);
    expect(isEventConfirmed("novo_lead")).toBe(false);
    expect(isEventConfirmed("orcamento_enviado")).toBe(false);
    expect(isEventConfirmed("cancelado")).toBe(false);

    expect(isEventCancelled("cancelado")).toBe(true);
    expect(isEventCancelled("CANCELADO")).toBe(true);
    expect(isEventCancelled("cancelada")).toBe(true);
    expect(isEventCancelled("confirmado")).toBe(false);
  });

  it("creates an event on Google Calendar if google_calendar_event_id is null", async () => {
    const mockEvent = {
      id: "evt-100",
      client_name: "Casamento Fernanda",
      event_name: "Casamento Fernanda e Lucas",
      date: "2026-09-12",
      event_time: "19:00 - 01:00",
      status: "confirmado",
      google_calendar_event_id: null,
      google_calendar_sync_status: "not_synced",
    };

    const mockIntegration = {
      id: "int-1",
      google_account_email: "socio@goatbar.com.br",
      calendar_id: "primary",
      access_token: "mock_token",
      token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      status: "connected",
    };

    const updatedEventFields: any = {};

    const mockSupabase: any = {
      from: (table: string) => {
        if (table === "events") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: mockEvent, error: null }),
              }),
            }),
            update: (payload: any) => ({
              eq: () => {
                Object.assign(updatedEventFields, payload);
                return Promise.resolve({ data: { ...mockEvent, ...payload }, error: null });
              },
            }),
          };
        }
        if (table === "google_calendar_integrations") {
          return {
            select: () => ({
              neq: () => ({
                order: () => ({
                  limit: async () => ({ data: [mockIntegration], error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "gcal-event-999",
        htmlLink: "https://calendar.google.com/event?eid=gcal-event-999",
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await syncSingleGoatBarEvent(mockSupabase, "evt-100");

    expect(result.success).toBe(true);
    expect(result.action).toBe("created");
    expect(result.googleCalendarEventId).toBe("gcal-event-999");
    expect(updatedEventFields.google_calendar_event_id).toBe("gcal-event-999");
    expect(updatedEventFields.google_calendar_sync_status).toBe("synced");
  });

  it("updates an existing event on Google Calendar if google_calendar_event_id is present", async () => {
    const mockEvent = {
      id: "evt-100",
      client_name: "Casamento Fernanda",
      event_name: "Casamento Fernanda e Lucas",
      date: "2026-09-12",
      event_time: "20:00 - 02:00", // updated time
      status: "confirmado",
      google_calendar_event_id: "gcal-event-999",
      google_calendar_sync_status: "synced",
    };

    const mockIntegration = {
      id: "int-1",
      calendar_id: "primary",
      access_token: "mock_token",
      token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      status: "connected",
    };

    const updatedFields: any = {};

    const mockSupabase: any = {
      from: (table: string) => {
        if (table === "events") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: mockEvent, error: null }),
              }),
            }),
            update: (payload: any) => ({
              eq: () => {
                Object.assign(updatedFields, payload);
                return Promise.resolve({ data: { ...mockEvent, ...payload }, error: null });
              },
            }),
          };
        }
        if (table === "google_calendar_integrations") {
          return {
            select: () => ({
              neq: () => ({
                order: () => ({
                  limit: async () => ({ data: [mockIntegration], error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "gcal-event-999",
        htmlLink: "https://calendar.google.com/event?eid=gcal-event-999",
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await syncSingleGoatBarEvent(mockSupabase, "evt-100");

    expect(result.success).toBe(true);
    expect(result.action).toBe("updated");
    expect(updatedFields.google_calendar_sync_status).toBe("synced");
  });

  it("recreates event if Google returns 404 (deleted manually in calendar)", async () => {
    const mockEvent = {
      id: "evt-100",
      client_name: "Casamento Fernanda",
      event_name: "Casamento Fernanda e Lucas",
      date: "2026-09-12",
      event_time: "19:00 - 01:00",
      status: "confirmado",
      google_calendar_event_id: "old-deleted-event-id",
      google_calendar_sync_status: "synced",
    };

    const mockIntegration = {
      id: "int-1",
      calendar_id: "primary",
      access_token: "mock_token",
      token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      status: "connected",
    };

    const updatedFields: any = {};

    const mockSupabase: any = {
      from: (table: string) => {
        if (table === "events") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: mockEvent, error: null }),
              }),
            }),
            update: (payload: any) => ({
              eq: () => {
                Object.assign(updatedFields, payload);
                return Promise.resolve({ data: { ...mockEvent, ...payload }, error: null });
              },
            }),
          };
        }
        if (table === "google_calendar_integrations") {
          return {
            select: () => ({
              neq: () => ({
                order: () => ({
                  limit: async () => ({ data: [mockIntegration], error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      },
    };

    // First call (PATCH) returns 404; Second call (POST create) returns 200 with new ID
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Not Found",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: "recreated-new-event-id",
          htmlLink: "https://calendar.google.com/event?eid=recreated-new-event-id",
        }),
      });
    vi.stubGlobal("fetch", mockFetch);

    const result = await syncSingleGoatBarEvent(mockSupabase, "evt-100");

    expect(result.success).toBe(true);
    expect(result.action).toBe("created");
    expect(result.googleCalendarEventId).toBe("recreated-new-event-id");
    expect(updatedFields.google_calendar_event_id).toBe("recreated-new-event-id");
  });

  it("handles cancelled event by marking [CANCELADO] without deleting history", async () => {
    const mockEvent = {
      id: "evt-100",
      client_name: "Casamento Fernanda",
      event_name: "Casamento Fernanda e Lucas",
      date: "2026-09-12",
      event_time: "19:00 - 01:00",
      status: "cancelado",
      google_calendar_event_id: "gcal-event-999",
      google_calendar_sync_status: "synced",
    };

    const mockIntegration = {
      id: "int-1",
      calendar_id: "primary",
      access_token: "mock_token",
      token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      status: "connected",
    };

    const updatedFields: any = {};

    const mockSupabase: any = {
      from: (table: string) => {
        if (table === "events") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: mockEvent, error: null }),
              }),
            }),
            update: (payload: any) => ({
              eq: () => {
                Object.assign(updatedFields, payload);
                return Promise.resolve({ data: { ...mockEvent, ...payload }, error: null });
              },
            }),
          };
        }
        if (table === "google_calendar_integrations") {
          return {
            select: () => ({
              neq: () => ({
                order: () => ({
                  limit: async () => ({ data: [mockIntegration], error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "gcal-event-999",
        summary: "[CANCELADO] Casamento Fernanda e Lucas",
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await syncSingleGoatBarEvent(mockSupabase, "evt-100");

    expect(result.success).toBe(true);
    expect(result.action).toBe("cancelled");
    expect(updatedFields.google_calendar_sync_status).toBe("cancelled");

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("gcal-event-999");
    const sentBody = JSON.parse(opts.body);
    expect(sentBody.summary).toBe("[CANCELADO] Casamento Fernanda e Lucas");
  });

  it("handles Google API errors gracefully by recording error on event without failing caller", async () => {
    const mockEvent = {
      id: "evt-100",
      client_name: "Casamento Fernanda",
      event_name: "Casamento Fernanda e Lucas",
      date: "2026-09-12",
      event_time: "19:00 - 01:00",
      status: "confirmado",
      google_calendar_event_id: null,
      google_calendar_sync_status: "not_synced",
    };

    const mockIntegration = {
      id: "int-1",
      calendar_id: "primary",
      access_token: "mock_token",
      token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      status: "connected",
    };

    const updatedFields: any = {};

    const mockSupabase: any = {
      from: (table: string) => {
        if (table === "events") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: mockEvent, error: null }),
              }),
            }),
            update: (payload: any) => ({
              eq: () => {
                Object.assign(updatedFields, payload);
                return Promise.resolve({ data: { ...mockEvent, ...payload }, error: null });
              },
            }),
          };
        }
        if (table === "google_calendar_integrations") {
          return {
            select: () => ({
              neq: () => ({
                order: () => ({
                  limit: async () => ({ data: [mockIntegration], error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: async () => "Google Service Temporarily Unavailable",
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await syncSingleGoatBarEvent(mockSupabase, "evt-100");

    expect(result.success).toBe(false);
    expect(result.action).toBe("error");
    expect(updatedFields.google_calendar_sync_status).toBe("error");
    expect(updatedFields.google_calendar_sync_error).toContain("503");
  });
});
