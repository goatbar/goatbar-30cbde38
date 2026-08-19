// supabase/functions/canva-test-connection/index.ts
// Tests Canva Connect API connectivity and validates access token / profile

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
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

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabaseAuthClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get valid access token (refreshes atomically if needed)
    let accessToken: string;
    try {
      accessToken = await getValidCanvaAccessToken(user.id, supabaseAdmin);
    } catch (err: any) {
      console.warn("[canva-test-connection] Failed to get valid token:", sanitizeLog(err));
      return new Response(
        JSON.stringify({
          connected: false,
          error: "Conexão com Canva inativa ou expirada. Por favor, conecte novamente.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Test API call by fetching user profile
    const profile = await fetchCanvaUserProfile(accessToken);

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
          id: profile.id ?? "unknown",
          display_name: profile.display_name ?? "Usuário Canva",
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
        error: "Falha ao testar conexão com o Canva.",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
