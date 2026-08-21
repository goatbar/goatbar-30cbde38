export interface GoogleCalendarIntegration {
  id: string;
  user_id?: string | null;
  google_account_email: string;
  google_account_name?: string | null;
  google_account_avatar?: string | null;
  calendar_id: string;
  calendar_name: string;
  access_token: string;
  refresh_token?: string | null;
  token_expires_at: string;
  scope?: string | null;
  status: "connected" | "disconnected" | "reauthorization_required" | "error";
  last_sync_at?: string | null;
  last_sync_error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoogleCalendarOAuthSession {
  id: string;
  user_id: string;
  state: string;
  created_at: string;
  expires_at: string;
}

export interface GoogleCalendarEventPayload {
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status?: "confirmed" | "tentative" | "cancelled";
  reminders?: {
    useDefault: boolean;
  };
}

export interface GoogleCalendarEventResponse {
  id: string;
  htmlLink?: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  created?: string;
  updated?: string;
}

export interface GoogleCalendarListEntry {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  timeZone?: string;
  accessRole?: string;
}

export interface GoatBarEventRecord {
  id: string;
  client_name: string;
  groom_name?: string | null;
  bride_name?: string | null;
  event_name?: string | null;
  date: string;
  event_time?: string | null;
  event_location?: string | null;
  city?: string | null;
  event_type?: string | null;
  guests?: number | null;
  drinks?: string[] | null;
  notes?: string | null;
  status: string;
  google_calendar_event_id?: string | null;
  google_calendar_sync_status?: "not_synced" | "pending" | "synced" | "error" | "cancelled";
  google_calendar_synced_at?: string | null;
  google_calendar_sync_error?: string | null;
  google_calendar_html_link?: string | null;
}

export interface SyncEventResult {
  success: boolean;
  action: "created" | "updated" | "cancelled" | "skipped" | "error";
  eventId: string;
  googleCalendarEventId?: string;
  htmlLink?: string;
  error?: string;
}
