// supabase/functions/canva-get-brand-template-fields/index.ts
// Retrieves Dataset (Data Fields) of a Canva Brand Template for mapping

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  CanvaApiError,
  getCanvaBrandTemplateDataset,
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

    // 1. Extract brandTemplateId from query param or body
    const reqUrl = new URL(req.url);
    let brandTemplateId = reqUrl.searchParams.get("brandTemplateId") || reqUrl.searchParams.get("brand_template_id");

    if (!brandTemplateId && req.method === "POST") {
      try {
        const body = await req.json();
        brandTemplateId = body.brandTemplateId || body.brand_template_id;
      } catch {
        // ignore
      }
    }

    if (!brandTemplateId) {
      return new Response(
        JSON.stringify({
          error_code: "brand_template_id_required",
          error: "Identificador do Brand Template (brandTemplateId) é obrigatório.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Get valid access token
    let accessToken: string;
    try {
      accessToken = await getValidCanvaAccessToken(user.id, supabaseAdmin);
    } catch (err: any) {
      console.warn("[canva-get-brand-template-fields] Failed to get valid token:", sanitizeLog(err));
      const code = err instanceof CanvaApiError ? err.code : "integration_not_found";
      return new Response(
        JSON.stringify({
          error_code: code,
          error: "Conexão com Canva inativa ou expirada. Por favor, reconecte sua conta.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Fetch Data Fields dataset from Canva Connect API
    const result = await getCanvaBrandTemplateDataset(accessToken, brandTemplateId);

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[canva-get-brand-template-fields] Unexpected error:", sanitizeLog(err));
    const code = err instanceof CanvaApiError ? err.code : "canva_api_error";
    return new Response(
      JSON.stringify({
        error_code: code,
        error: err?.message || "Erro ao consultar campos do template Canva.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
