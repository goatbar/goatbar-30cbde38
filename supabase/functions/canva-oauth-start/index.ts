// supabase/functions/canva-oauth-start/index.ts
// Initiates Canva OAuth 2.0 PKCE flow for authenticated users

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateCodeVerifier, generateCodeChallenge, generateState } from "../_shared/canva-crypto.ts";
import { CANVA_AUTH_URL, CANVA_SCOPES, getCanvaConfig, sanitizeLog } from "../_shared/canva-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado. Token de autenticação ausente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Authenticate requesting user
    const { data: { user }, error: authError } = await supabaseAuthClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Validate configuration secrets
    const config = getCanvaConfig();

    // 3. Opportunistic cleanup of expired sessions
    try {
      await supabaseAdmin
        .from("canva_oauth_sessions")
        .delete()
        .lt("expires_at", new Date().toISOString());
    } catch {
      // Non-blocking cleanup
    }

    // 4. Generate PKCE verifier, challenge and state
    const codeVerifier = generateCodeVerifier(96);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState(32);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // 5. Store OAuth session in database
    const { error: sessionError } = await supabaseAdmin.from("canva_oauth_sessions").insert({
      user_id: user.id,
      state,
      code_verifier: codeVerifier,
      expires_at: expiresAt,
    });

    if (sessionError) {
      console.error("[canva-oauth-start] Failed to save session:", sessionError.message);
      return new Response(JSON.stringify({ error: "Falha ao iniciar sessão de autorização." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Build Canva Authorization URL
    const authUrl = new URL(CANVA_AUTH_URL);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("client_id", config.clientId);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("redirect_uri", config.redirectUri);
    authUrl.searchParams.set("scope", CANVA_SCOPES.join(" "));

    return new Response(
      JSON.stringify({
        authorization_url: authUrl.toString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[canva-oauth-start] Error:", sanitizeLog(err));
    return new Response(
      JSON.stringify({ error: err?.message || "Erro interno ao iniciar OAuth com Canva." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
