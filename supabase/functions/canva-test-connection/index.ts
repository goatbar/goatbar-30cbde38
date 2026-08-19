// supabase/functions/canva-test-connection/index.ts
// Tests Canva Connect API connectivity and validates user profile with fine-grained error diagnostics

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  CanvaApiError,
  fetchCanvaUserProfile,
  getValidCanvaAccessToken,
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
          connected: false,
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

    // 1. Authenticate user extracting JWT from header
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          connected: false,
          error_code: "unauthenticated",
          error: "Usuário não autenticado ou sessão expirada.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Get valid access token (refreshes atomically if needed)
    let accessToken: string;
    try {
      accessToken = await getValidCanvaAccessToken(user.id, supabaseAdmin);
    } catch (err: any) {
      console.warn("[canva-test-connection] Failed to get valid token:", sanitizeLog(err));
      if (err instanceof CanvaApiError) {
        return new Response(
          JSON.stringify({
            connected: false,
            error_code: err.code,
            error: err.message,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      return new Response(
        JSON.stringify({
          connected: false,
          error_code: "integration_not_found",
          error: "Conexão com Canva inativa ou expirada. Por favor, conecte novamente.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Test API call by fetching user profile from official endpoint
    let profile: { id: string | null; display_name: string | null };
    try {
      profile = await fetchCanvaUserProfile(accessToken);
    } catch (err: any) {
      console.warn("[canva-test-connection] Failed to fetch profile:", sanitizeLog(err));
      if (err instanceof CanvaApiError) {
        return new Response(
          JSON.stringify({
            connected: false,
            error_code: err.code,
            error: err.message,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      return new Response(
        JSON.stringify({
          connected: false,
          error_code: "canva_api_error",
          error: "Falha na comunicação com a API do Canva.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Update canva_user_id if available and not set
    if (profile.id) {
      try {
        await supabaseAdmin
          .from("canva_integrations")
          .update({
            canva_user_id: profile.id,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
      } catch {
        // Non-critical
      }
    }

    return new Response(
      JSON.stringify({
        connected: true,
        canva_user: {
          id: profile.id ?? "user_authenticated",
          display_name: profile.display_name ?? "Conta Canva Conectada",
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[canva-test-connection] Unexpected error:", sanitizeLog(err));
    return new Response(
      JSON.stringify({
        connected: false,
        error_code: "canva_api_error",
        error: "Erro inesperado ao testar conexão com o Canva.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
