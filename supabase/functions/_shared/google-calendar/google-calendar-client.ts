import {
  GoogleCalendarEventPayload,
  GoogleCalendarEventResponse,
  GoogleCalendarListEntry,
} from "./types.ts";

export const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

export class GoogleCalendarApiError extends Error {
  status: number;
  statusText: string;
  errorData: any;

  constructor(message: string, status: number, statusText: string, errorData?: any) {
    super(message);
    this.name = "GoogleCalendarApiError";
    this.status = status;
    this.statusText = statusText;
    this.errorData = errorData;
  }
}

export async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  payload: GoogleCalendarEventPayload
): Promise<GoogleCalendarEventResponse> {
  const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsed: any;
    try {
      parsed = JSON.parse(errorText);
    } catch {
      parsed = errorText;
    }
    const msg = parsed?.error?.message || `Google Calendar API error (HTTP ${response.status})`;
    throw new GoogleCalendarApiError(msg, response.status, response.statusText, parsed);
  }

  return response.json();
}

export async function updateGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  payload: Partial<GoogleCalendarEventPayload>
): Promise<{ event?: GoogleCalendarEventResponse; notFound?: boolean }> {
  const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 404) {
    return { notFound: true };
  }

  if (!response.ok) {
    const errorText = await response.text();
    let parsed: any;
    try {
      parsed = JSON.parse(errorText);
    } catch {
      parsed = errorText;
    }
    const msg = parsed?.error?.message || `Google Calendar API error (HTTP ${response.status})`;
    throw new GoogleCalendarApiError(msg, response.status, response.statusText, parsed);
  }

  const data = await response.json();
  return { event: data };
}

export async function getGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<GoogleCalendarEventResponse | null> {
  const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new GoogleCalendarApiError(
      `Failed to fetch calendar event: ${errorText}`,
      response.status,
      response.statusText
    );
  }

  return response.json();
}

export async function listUserGoogleCalendars(
  accessToken: string
): Promise<GoogleCalendarListEntry[]> {
  const url = `${GOOGLE_CALENDAR_API_BASE}/users/me/calendarList?minAccessRole=writer`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new GoogleCalendarApiError(
      `Failed to list calendars: ${errorText}`,
      response.status,
      response.statusText
    );
  }

  const data = await response.json();
  const items = (data.items || []) as any[];

  return items.map((item) => ({
    id: item.id,
    summary: item.summary,
    description: item.description,
    primary: Boolean(item.primary),
    timeZone: item.timeZone,
    accessRole: item.accessRole,
  }));
}
