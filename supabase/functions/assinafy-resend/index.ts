import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resendAssignment } from "../_shared/assinafy-client.ts";
import { requireContractSignatureAccess } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Não autorizado. Missing Auth Header");

    const supabaseAuthClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { documentId, assignmentId, signerId } = await req.json();

    if (!documentId || !assignmentId || !signerId) {
        throw new Error("Parâmetros incompletos");
    }

    // Valida acesso ao contrato
    const { data: sigReq } = await supabaseAdmin.from("contract_signature_requests")
        .select("contract_id").eq("external_document_id", documentId).eq("signature_provider", "assinafy").maybeSingle();
    
    if (!sigReq) throw new Error("Documento não encontrado");

    await requireContractSignatureAccess(supabaseAuthClient, "admin", sigReq.contract_id);

    await resendAssignment(documentId, assignmentId, signerId);

    return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
