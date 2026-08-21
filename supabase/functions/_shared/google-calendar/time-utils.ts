export const TIMEZONE_SAO_PAULO = "America/Sao_Paulo";
export const TIMEZONE_OFFSET_BRT = "-03:00";

export interface EventDateTimeRange {
  start: {
    dateTime?: string;
    date?: string;
    timeZone: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone: string;
  };
}

/**
 * Parses time strings like "19:00", "19:00 - 01:00", "19:00 às 01:00", "19:00 as 02:00", "19h"
 */
export function parseEventTimeString(timeStr?: string | null): {
  startTime: string | null;
  endTime: string | null;
} {
  if (!timeStr || typeof timeStr !== "string") {
    return { startTime: null, endTime: null };
  }

  const clean = timeStr.trim().toLowerCase();

  // Pattern: "19:00 - 01:00" or "19:00 às 01:00" or "19:00 as 01:00" or "19:00 a 01:00"
  const rangeMatch = clean.match(/(\d{1,2})[:h](\d{2})?\s*(?:-|às|as|a|ate|até)\s*(\d{1,2})[:h](\d{2})?/);
  if (rangeMatch) {
    const sH = rangeMatch[1].padStart(2, "0");
    const sM = (rangeMatch[2] || "00").padStart(2, "0");
    const eH = rangeMatch[3].padStart(2, "0");
    const eM = (rangeMatch[4] || "00").padStart(2, "0");
    return {
      startTime: `${sH}:${sM}`,
      endTime: `${eH}:${eM}`,
    };
  }

  // Single time pattern: "19:00" or "19h" or "19:30"
  const singleMatch = clean.match(/(\d{1,2})[:h](\d{2})?/);
  if (singleMatch) {
    const sH = singleMatch[1].padStart(2, "0");
    const sM = (singleMatch[2] || "00").padStart(2, "0");
    return {
      startTime: `${sH}:${sM}`,
      endTime: null,
    };
  }

  return { startTime: null, endTime: null };
}

/**
 * Calculates start and end RFC3339 strings in America/Sao_Paulo timezone.
 * Detects and handles midnight-crossing events automatically.
 */
export function buildGoogleCalendarDateTimeRange(
  eventDateStr: string,
  eventTimeStr?: string | null,
  defaultDurationHours: number = 5
): EventDateTimeRange {
  // Normalize date format "YYYY-MM-DD"
  const dateMatch = eventDateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) {
    // If not standard ISO date, treat as all-day string or return as-is
    return {
      start: { date: eventDateStr, timeZone: TIMEZONE_SAO_PAULO },
      end: { date: eventDateStr, timeZone: TIMEZONE_SAO_PAULO },
    };
  }

  const baseYear = parseInt(dateMatch[1], 10);
  const baseMonth = parseInt(dateMatch[2], 10);
  const baseDay = parseInt(dateMatch[3], 10);

  const { startTime, endTime } = parseEventTimeString(eventTimeStr);

  // If no time is specified, return as all-day event
  if (!startTime) {
    return {
      start: { date: `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`, timeZone: TIMEZONE_SAO_PAULO },
      end: { date: `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`, timeZone: TIMEZONE_SAO_PAULO },
    };
  }

  const [startH, startM] = startTime.split(":").map((n) => parseInt(n, 10));
  let endH: number;
  let endM: number;
  let crossesMidnight = false;

  if (endTime) {
    const [eH, eM] = endTime.split(":").map((n) => parseInt(n, 10));
    endH = eH;
    endM = eM;
    // Crosses midnight if end hour is less than start hour (e.g. 19:00 -> 01:00)
    // or same hour with earlier minute
    if (endH < startH || (endH === startH && endM < startM)) {
      crossesMidnight = true;
    }
  } else {
    // Calculate default duration (e.g. +5 hours)
    const totalMinutes = startH * 60 + startM + Math.round(defaultDurationHours * 60);
    endH = Math.floor(totalMinutes / 60) % 24;
    endM = totalMinutes % 60;
    if (Math.floor(totalMinutes / 60) >= 24 || endH < startH) {
      crossesMidnight = true;
    }
  }

  const formatTwo = (n: number) => String(n).padStart(2, "0");

  const startIso = `${formatTwo(baseYear)}-${formatTwo(baseMonth)}-${formatTwo(baseDay)}T${formatTwo(startH)}:${formatTwo(startM)}:00${TIMEZONE_OFFSET_BRT}`;

  let endYear = baseYear;
  let endMonth = baseMonth;
  let endDay = baseDay;

  if (crossesMidnight) {
    // Add 1 day in São Paulo calendar
    const nextDate = new Date(Date.UTC(baseYear, baseMonth - 1, baseDay + 1));
    endYear = nextDate.getUTCFullYear();
    endMonth = nextDate.getUTCMonth() + 1;
    endDay = nextDate.getUTCDate();
  }

  const endIso = `${formatTwo(endYear)}-${formatTwo(endMonth)}-${formatTwo(endDay)}T${formatTwo(endH)}:${formatTwo(endM)}:00${TIMEZONE_OFFSET_BRT}`;

  return {
    start: {
      dateTime: startIso,
      timeZone: TIMEZONE_SAO_PAULO,
    },
    end: {
      dateTime: endIso,
      timeZone: TIMEZONE_SAO_PAULO,
    },
  };
}
