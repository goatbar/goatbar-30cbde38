import { describe, it, expect } from "vitest";
import {
  buildGoogleCalendarPayload,
  formatEventDescription,
  formatEventSummary,
} from "../supabase/functions/_shared/google-calendar/event-formatter";
import { GoatBarEventRecord } from "../supabase/functions/_shared/google-calendar/types";

describe("Google Calendar - Event Formatter", () => {
  const sampleEvent: GoatBarEventRecord = {
    id: "evt-12345",
    client_name: "Fernanda Silva",
    groom_name: "Lucas",
    bride_name: "Fernanda",
    event_name: "Casamento Fernanda e Lucas",
    date: "2026-09-12",
    event_time: "19:00 - 01:00",
    event_location: "Espaço Villa Véneto",
    city: "Belo Horizonte",
    event_type: "Casamento",
    guests: 150,
    drinks: ["Gin Tônica", "Moscow Mule", "Negroni"],
    notes: "Noivos solicitaram taças de cristal para brinde.",
    status: "confirmado",
  };

  it("formats normal event summary using event_name", () => {
    const summary = formatEventSummary(sampleEvent, false);
    expect(summary).toBe("Casamento Fernanda e Lucas");
  });

  it("formats cancelled event summary with [CANCELADO] prefix", () => {
    const summary = formatEventSummary(sampleEvent, true);
    expect(summary).toBe("[CANCELADO] Casamento Fernanda e Lucas");
  });

  it("prevents duplicate [CANCELADO] prefix if already present", () => {
    const alreadyCancelled: GoatBarEventRecord = {
      ...sampleEvent,
      event_name: "[CANCELADO] Casamento Fernanda e Lucas",
    };
    const summary = formatEventSummary(alreadyCancelled, true);
    expect(summary).toBe("[CANCELADO] Casamento Fernanda e Lucas");
  });

  it("restores original title when un-cancelling an event", () => {
    const alreadyCancelled: GoatBarEventRecord = {
      ...sampleEvent,
      event_name: "[CANCELADO] Casamento Fernanda e Lucas",
    };
    const summary = formatEventSummary(alreadyCancelled, false);
    expect(summary).toBe("Casamento Fernanda e Lucas");
  });

  it("formats complete event description with operational details and deep link", () => {
    const desc = formatEventDescription(sampleEvent, false, "https://app.goatbar.com.br");

    expect(desc).toContain("Cliente: Fernanda Silva");
    expect(desc).toContain("Evento: Casamento Fernanda e Lucas");
    expect(desc).toContain("Convidados: 150");
    expect(desc).toContain("Local: Espaço Villa Véneto - Belo Horizonte");
    expect(desc).toContain("Drinks / Cardápio:");
    expect(desc).toContain("• Gin Tônica");
    expect(desc).toContain("• Moscow Mule");
    expect(desc).toContain("Observações:");
    expect(desc).toContain("Noivos solicitaram taças de cristal para brinde.");
    expect(desc).toContain("https://app.goatbar.com.br/eventos/evt-12345");
  });

  it("builds a full Google Calendar payload structure", () => {
    const payload = buildGoogleCalendarPayload(sampleEvent, false, "https://goatbar.com.br");

    expect(payload.summary).toBe("Casamento Fernanda e Lucas");
    expect(payload.location).toBe("Espaço Villa Véneto, Belo Horizonte");
    expect(payload.status).toBe("confirmed");
    expect(payload.start.dateTime).toBe("2026-09-12T19:00:00-03:00");
    expect(payload.end.dateTime).toBe("2026-09-13T01:00:00-03:00");
    expect(payload.reminders?.useDefault).toBe(true);
  });
});
