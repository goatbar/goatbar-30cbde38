// supabase/functions/canva-oauth-callback/index.ts
// Handles Canva OAuth 2.0 PKCE redirect callback, exchanges code for tokens, and persists integration

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  CANVA_SCOPES,
  exchangeCodeForToken,
  fetchCanvaUserProfile,
  getCanvaConfig,
  sanitizeLog,
} from "../_shared/canva-auth.ts";

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

function buildRedirectResponse(baseUrl: string, status: "success" | "error"): Response {
  const url = new URL(baseUrl);
  url.searchParams.set("integration", "canva");
  url.searchParams.set("status", status);

  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
    },
  });
}

serve(async (req: Request) => {
  const reqUrl = new URL(req.url);
  const code = reqUrl.searchParams.get("code")?.trim();
  const state = reqUrl.searchParams.get("state")?.trim();
  const errorParam = reqUrl.searchParams.get("error");

  let config: ReturnType<typeof getCanvaConfig> | null = null;
  try {
    config = getCanvaConfig();
  } catch (err: any) {
    console.error("[canva-oauth-callback] Missing Canva config:", sanitizeLog(err));
  }

  const successBaseUrl = config?.successRedirectUrl || getRedirectBaseUrl(req);
  const errorBaseUrl = config?.errorRedirectUrl || getRedirectBaseUrl(req);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Handle OAuth denial or errors from Canva
  if (errorParam) {
    console.warn("[canva-oauth-callback] Canva returned error:", {
      error: errorParam,
      stage: "oauth_callback_denied",
    });

    if (state) {
      try {
        await supabaseAdmin.from("canva_oauth_sessions").delete().eq("state", state);
      } catch {
        // Non-blocking cleanup
      }
    }
    return buildRedirectResponse(errorBaseUrl, "error");
  }

  // 2. Validate mandatory parameters
  if (!code || !state) {
    console.warn("[canva-oauth-callback] Missing code or state parameters.");
    return buildRedirectResponse(errorBaseUrl, "error");
  }

  if (!config) {
    return buildRedirectResponse(errorBaseUrl, "error");
  }

  try {
    // 3. Look up OAuth session by state
    const { data: session, error: sessionQueryError } = await supabaseAdmin
      .from("canva_oauth_sessions")
      .select("id, user_id, state, code_verifier, expires_at")
      .eq("state", state)
      .maybeSingle();

    if (sessionQueryError || !session) {
      console.warn("[canva-oauth-callback] OAuth session not found for state.");
      return buildRedirectResponse(errorBaseUrl, "error");
    }

    // 4. Validate session expiration
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    if (expiresAt < now) {
      console.warn("[canva-oauth-callback] OAuth session expired.");
      await supabaseAdmin.from("canva_oauth_sessions").delete().eq("id", session.id);
      return buildRedirectResponse(errorBaseUrl, "error");
    }

    // 5. Exchange code for access & refresh tokens
    const tokenData = await exchangeCodeForToken(code, session.code_verifier, config);

    // 6. Fetch user profile (best effort)
    const profile = await fetchCanvaUserProfile(tokenData.access_token);

    // 7. Calculate token expiration timestamp
    const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
    const scopes = tokenData.scope ? tokenData.scope.split(" ") : Array.from(CANVA_SCOPES);

    // 8. Persist integration securely in database
    const { error: upsertError } = await supabaseAdmin.from("canva_integrations").upsert(
      {
        user_id: session.user_id,
        canva_user_id: profile.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        access_token_expires_at: tokenExpiresAt,
        scopes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (upsertError) {
      console.error("[canva-oauth-callback] Failed to persist Canva integration:", upsertError.message);
      return buildRedirectResponse(errorBaseUrl, "error");
    }

    // 9. Consume and delete single-use OAuth session
    await supabaseAdmin.from("canva_oauth_sessions").delete().eq("id", session.id);

    console.info("[canva-oauth-callback] Successfully linked Canva for user:", session.user_id);
    return buildRedirectResponse(successBaseUrl, "success");
  } catch (err: any) {
    console.error("[canva-oauth-callback] Unexpected callback error:", sanitizeLog(err));
    return buildRedirectResponse(errorBaseUrl, "error");
  }
});
