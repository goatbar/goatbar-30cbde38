import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildGoogleAuthUrl,
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
  generateOAuthState,
  getGoogleOAuthConfig,
} from "../_shared/google-calendar/oauth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getRedirectBaseUrl(req: Request, configuredUrl?: string): string {
  if (configuredUrl && configuredUrl.startsWith("http")) {
    return configuredUrl;
  }
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const url = new URL(referer);
      return `${url.origin}/configuracoes`;
    } catch {
      // ignore
    }
  }
  const siteUrl = Deno.env.get("SITE_URL") || Deno.env.get("APP_URL");
  if (siteUrl) {
    return `${siteUrl.replace(/\/+$/, "")}/configuracoes`;
  }
  return "https://xdqgglrxidmegujhkygj.supabase.co/configuracoes";
}

function buildRedirectResponse(baseUrl: string, status: "success" | "error", message?: string): Response {
  const url = new URL(baseUrl);
  url.searchParams.set("integration", "google_calendar");
  url.searchParams.set("status", status);
  if (message) {
    url.searchParams.set("message", message);
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
    },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const reqUrl = new URL(req.url);
  const path = reqUrl.pathname;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // --------------------------------------------------------------------------
  // ROUTE 1: /start or action = start (Initiate OAuth)
  // --------------------------------------------------------------------------
  if (path.endsWith("/start") || (req.method === "POST" && !path.endsWith("/callback"))) {
    try {
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

      const { data: { user }, error: authError } = await supabaseAuthClient.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Usuário não autenticado." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const config = getGoogleOAuthConfig();

      // Clean up expired sessions
      try {
        await supabaseAdmin
          .from("google_calendar_oauth_sessions")
          .delete()
          .lt("expires_at", new Date().toISOString());
      } catch {
        // non-blocking
      }

      // Generate State and Expiry (10 minutes)
      const state = generateOAuthState(32);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: sessionError } = await supabaseAdmin
        .from("google_calendar_oauth_sessions")
        .insert({
          user_id: user.id,
          state,
          expires_at: expiresAt,
        });

      if (sessionError) {
        console.error("[google-calendar-oauth] Failed to save session:", sessionError.message);
        return new Response(
          JSON.stringify({ error: "Falha ao registrar sessão de autorização." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const authorizationUrl = buildGoogleAuthUrl(config, state);

      return new Response(
        JSON.stringify({
          authorization_url: authorizationUrl,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err: any) {
      console.error("[google-calendar-oauth] Start error:", err);
      return new Response(
        JSON.stringify({ error: err?.message || "Erro ao iniciar OAuth Google Calendar" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // --------------------------------------------------------------------------
  // ROUTE 2: /callback (Handle Google Redirect)
  // --------------------------------------------------------------------------
  const code = reqUrl.searchParams.get("code")?.trim();
  const state = reqUrl.searchParams.get("state")?.trim();
  const errorParam = reqUrl.searchParams.get("error");

  const config = getGoogleOAuthConfig();
  const successBaseUrl = config.successRedirectUrl || getRedirectBaseUrl(req);
  const errorBaseUrl = config.errorRedirectUrl || getRedirectBaseUrl(req);

  if (errorParam) {
    console.warn("[google-calendar-oauth] Google OAuth error parameter:", errorParam);
    if (state) {
      try {
        await supabaseAdmin.from("google_calendar_oauth_sessions").delete().eq("state", state);
      } catch {
        // non-blocking
      }
    }
    return buildRedirectResponse(errorBaseUrl, "error", errorParam);
  }

  if (!code || !state) {
    console.warn("[google-calendar-oauth] Missing code or state parameters.");
    return buildRedirectResponse(errorBaseUrl, "error", "missing_code_or_state");
  }

  try {
    // 1. Look up session by state
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("google_calendar_oauth_sessions")
      .select("id, user_id, state, expires_at")
      .eq("state", state)
      .maybeSingle();

    if (sessionError || !session) {
      console.error("[google-calendar-oauth] Invalid or unknown OAuth state:", state);
      return buildRedirectResponse(errorBaseUrl, "error", "invalid_state");
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      console.error("[google-calendar-oauth] Expired OAuth state session.");
      await supabaseAdmin.from("google_calendar_oauth_sessions").delete().eq("id", session.id);
      return buildRedirectResponse(errorBaseUrl, "error", "expired_session");
    }

    // 2. Exchange code for tokens
    const tokens = await exchangeCodeForTokens(config, code);

    // 3. Fetch Google User Profile
    const userInfo = await fetchGoogleUserInfo(tokens.access_token);

    const tokenExpiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

    // 4. Upsert integration in database
    // Check if an existing integration for this email exists
    const { data: existingIntegration } = await supabaseAdmin
      .from("google_calendar_integrations")
      .select("id, refresh_token, calendar_id, calendar_name")
      .eq("google_account_email", userInfo.email)
      .maybeSingle();

    const finalRefreshToken = tokens.refresh_token || existingIntegration?.refresh_token || null;

    const payload = {
      user_id: session.user_id,
      google_account_email: userInfo.email,
      google_account_name: userInfo.name || null,
      google_account_avatar: userInfo.picture || null,
      calendar_id: existingIntegration?.calendar_id || "primary",
      calendar_name: existingIntegration?.calendar_name || "Principal (Google Calendar)",
      access_token: tokens.access_token,
      refresh_token: finalRefreshToken,
      token_expires_at: tokenExpiresAt,
      scope: tokens.scope || null,
      status: "connected",
      last_sync_error: null,
      updated_at: new Date().toISOString(),
    };

    if (existingIntegration) {
      await supabaseAdmin
        .from("google_calendar_integrations")
        .update(payload)
        .eq("id", existingIntegration.id);
    } else {
      await supabaseAdmin.from("google_calendar_integrations").insert(payload);
    }

    // 5. Delete used OAuth session
    await supabaseAdmin.from("google_calendar_oauth_sessions").delete().eq("id", session.id);

    console.info(`[google-calendar-oauth] Conta ${userInfo.email} conectada com sucesso!`);
    return buildRedirectResponse(successBaseUrl, "success");
  } catch (callbackErr: any) {
    console.error("[google-calendar-oauth] Callback exception:", callbackErr);
    return buildRedirectResponse(errorBaseUrl, "error", callbackErr?.message || "callback_failed");
  }
});
