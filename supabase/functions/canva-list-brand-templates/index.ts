// supabase/functions/canva-list-brand-templates/index.ts
// Lists Brand Templates from Canva Connect API for the authenticated user

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  CanvaApiError,
  getValidCanvaAccessToken,
  listCanvaBrandTemplates,
  sanitizeLog,
} from "../_shared/canva-auth.ts";

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
      return new Response(
        JSON.stringify({
          error_code: "unauthenticated",
          error: "Não autorizado. Token de autenticação ausente.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error_code: "unauthenticated",
          error: "Usuário não autenticado ou sessão expirada.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 1. Get valid access token
    let accessToken: string;
    try {
      accessToken = await getValidCanvaAccessToken(user.id, supabaseAdmin);
    } catch (err: any) {
      console.warn("[canva-list-brand-templates] Failed to get valid token:", sanitizeLog(err));
      const code = err instanceof CanvaApiError ? err.code : "integration_not_found";
      return new Response(
        JSON.stringify({
          error_code: code,
          error: "Conexão com Canva inativa ou expirada. Por favor, reconecte sua conta em Configurações > Integrações.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Parse pagination query param
    const reqUrl = new URL(req.url);
    const continuation = reqUrl.searchParams.get("continuation") || undefined;

    // 3. Fetch templates from Canva Connect API
    const result = await listCanvaBrandTemplates(accessToken, continuation);

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[canva-list-brand-templates] Unexpected error:", sanitizeLog(err));
    const code = err instanceof CanvaApiError ? err.code : "canva_api_error";
    return new Response(
      JSON.stringify({
        error_code: code,
        error: err?.message || "Erro ao listar templates do Canva.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
