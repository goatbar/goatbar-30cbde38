import { describe, it, expect } from "vitest";
import {
  buildGoogleCalendarDateTimeRange,
  parseEventTimeString,
  TIMEZONE_OFFSET_BRT,
  TIMEZONE_SAO_PAULO,
} from "../supabase/functions/_shared/google-calendar/time-utils";

describe("Google Calendar - Time & Date Utilities", () => {
  it("parses various event time string formats", () => {
    expect(parseEventTimeString("19:00 - 01:00")).toEqual({
      startTime: "19:00",
      endTime: "01:00",
    });

    expect(parseEventTimeString("19:00 às 02:30")).toEqual({
      startTime: "19:00",
      endTime: "02:30",
    });

    expect(parseEventTimeString("19h as 01h")).toEqual({
      startTime: "19:00",
      endTime: "01:00",
    });

    expect(parseEventTimeString("18:30")).toEqual({
      startTime: "18:30",
      endTime: null,
    });

    expect(parseEventTimeString("")).toEqual({
      startTime: null,
      endTime: null,
    });
  });

  it("builds correct RFC3339 datetime in America/Sao_Paulo timezone for same-day events", () => {
    const range = buildGoogleCalendarDateTimeRange("2026-09-12", "14:00 - 18:00");

    expect(range.start.timeZone).toBe(TIMEZONE_SAO_PAULO);
    expect(range.end.timeZone).toBe(TIMEZONE_SAO_PAULO);
    expect(range.start.dateTime).toBe(`2026-09-12T14:00:00${TIMEZONE_OFFSET_BRT}`);
    expect(range.end.dateTime).toBe(`2026-09-12T18:00:00${TIMEZONE_OFFSET_BRT}`);
  });

  it("handles events that cross midnight by advancing the end date by 1 day", () => {
    // 19:00 on 12/09/2026 ending at 01:00 on 13/09/2026
    const range = buildGoogleCalendarDateTimeRange("2026-09-12", "19:00 - 01:00");

    expect(range.start.dateTime).toBe(`2026-09-12T19:00:00${TIMEZONE_OFFSET_BRT}`);
    expect(range.end.dateTime).toBe(`2026-09-13T01:00:00${TIMEZONE_OFFSET_BRT}`);
  });

  it("handles late-night events that cross midnight with only start time (default +5h)", () => {
    // 21:00 + 5h -> 02:00 next day
    const range = buildGoogleCalendarDateTimeRange("2026-09-12", "21:00", 5);

    expect(range.start.dateTime).toBe(`2026-09-12T21:00:00${TIMEZONE_OFFSET_BRT}`);
    expect(range.end.dateTime).toBe(`2026-09-13T02:00:00${TIMEZONE_OFFSET_BRT}`);
  });

  it("handles month transition when crossing midnight on the last day of month", () => {
    // 30/09/2026 22:00 -> 01/10/2026 03:00
    const range = buildGoogleCalendarDateTimeRange("2026-09-30", "22:00 às 03:00");

    expect(range.start.dateTime).toBe(`2026-09-30T22:00:00${TIMEZONE_OFFSET_BRT}`);
    expect(range.end.dateTime).toBe(`2026-10-01T03:00:00${TIMEZONE_OFFSET_BRT}`);
  });

  it("generates an all-day date range when no time string is provided", () => {
    const range = buildGoogleCalendarDateTimeRange("2026-09-12", null);

    expect(range.start.dateTime).toBeUndefined();
    expect(range.start.date).toBe("2026-09-12");
    expect(range.end.date).toBe("2026-09-12");
  });
});
