import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getValidGoogleAccessToken } from "../_shared/google-calendar/token-manager.ts";
import { listUserGoogleCalendars } from "../_shared/google-calendar/google-calendar-client.ts";
import {
  syncAllConfirmedEvents,
  syncSingleGoatBarEvent,
} from "../_shared/google-calendar/calendar-sync.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Não autorizado. Token de autenticação ausente." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // Authenticate user
  const { data: { user }, error: authError } = await supabaseAuthClient.auth.getUser();
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Usuário não autenticado." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    let body: any = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const action = body.action || "status";
    const appUrl = Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || "https://goatbar.com.br";

    // ------------------------------------------------------------------------
    // 1. ACTION: status
    // ------------------------------------------------------------------------
    if (action === "status") {
      const { data: integrations, error } = await supabaseAdmin
        .from("google_calendar_integrations")
        .select("id, google_account_email, google_account_name, google_account_avatar, calendar_id, calendar_name, status, last_sync_at, last_sync_error, created_at, updated_at")
        .neq("status", "disconnected")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error || !integrations || integrations.length === 0) {
        return new Response(
          JSON.stringify({
            connected: false,
            status: "disconnected",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const item = integrations[0];
      return new Response(
        JSON.stringify({
          connected: item.status === "connected",
          status: item.status,
          email: item.google_account_email,
          name: item.google_account_name,
          avatar: item.google_account_avatar,
          calendarId: item.calendar_id,
          calendarName: item.calendar_name,
          lastSyncAt: item.last_sync_at,
          lastSyncError: item.last_sync_error,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------------
    // 2. ACTION: sync_event (Single Event)
    // ------------------------------------------------------------------------
    if (action === "sync_event") {
      const { eventId } = body;
      if (!eventId) {
        return new Response(
          JSON.stringify({ error: "Campo 'eventId' é obrigatório." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const syncResult = await syncSingleGoatBarEvent(supabaseAdmin, eventId, appUrl);

      return new Response(
        JSON.stringify({
          success: syncResult.success,
          result: syncResult,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------------
    // 3. ACTION: sync_all (Reconciliation of All Confirmed Events)
    // ------------------------------------------------------------------------
    if (action === "sync_all") {
      const result = await syncAllConfirmedEvents(supabaseAdmin, appUrl);

      return new Response(
        JSON.stringify({
          success: result.errors === 0,
          summary: result,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------------
    // 4. ACTION: list_calendars
    // ------------------------------------------------------------------------
    if (action === "list_calendars") {
      const { accessToken } = await getValidGoogleAccessToken(supabaseAdmin);
      const calendars = await listUserGoogleCalendars(accessToken);

      return new Response(
        JSON.stringify({
          success: true,
          calendars,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------------
    // 5. ACTION: select_calendar
    // ------------------------------------------------------------------------
    if (action === "select_calendar") {
      const { calendarId, calendarName } = body;
      if (!calendarId) {
        return new Response(
          JSON.stringify({ error: "Campo 'calendarId' é obrigatório." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateError } = await supabaseAdmin
        .from("google_calendar_integrations")
        .update({
          calendar_id: calendarId,
          calendar_name: calendarName || "Google Calendar",
          updated_at: new Date().toISOString(),
        })
        .neq("status", "disconnected");

      if (updateError) {
        throw updateError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          calendarId,
          calendarName: calendarName || "Google Calendar",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------------
    // 6. ACTION: disconnect
    // ------------------------------------------------------------------------
    if (action === "disconnect") {
      const { error: discError } = await supabaseAdmin
        .from("google_calendar_integrations")
        .update({
          status: "disconnected",
          updated_at: new Date().toISOString(),
        })
        .neq("status", "disconnected");

      if (discError) {
        throw discError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Integração Google Calendar desconectada com sucesso.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Ação desconhecida: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[google-calendar-sync] Error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Erro interno no serviço de sincronização do Google Calendar" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
