import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const zapsignApiToken = Deno.env.get("ZAPSIGN_API_TOKEN") ?? "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const contractId = url.searchParams.get("contractId");

    if (!contractId) {
      return new Response(
        JSON.stringify({ success: false, error: "contractId é obrigatório" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Busca a solicitação no banco
    const { data: sigReq, error } = await supabase
      .from("contract_signature_requests")
      .select("*")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !sigReq) {
      return new Response(
        JSON.stringify({ success: true, status: "draft", signatureRequest: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Se temos token da ZapSign e token do documento externo, consulta a ZapSign diretamente para sincronizar
    if (zapsignApiToken && sigReq.external_request_id && sigReq.internal_status === "pending_signature") {
      try {
        const zapsignRes = await fetch(
          `https://api.zapsign.com.br/api/v1/docs/${sigReq.external_request_id}/`,
          {
            headers: {
              Authorization: `Bearer ${zapsignApiToken}`,
            },
          }
        );

        if (zapsignRes.ok) {
          const docData = await zapsignRes.json();
          const docStatus = docData.status;

          if (docStatus === "signed" || docStatus === "completed") {
            // Atualiza status local
            await supabase
              .from("contract_signature_requests")
              .update({
                internal_status: "signed",
                provider_status: docStatus,
                provider_response: docData,
                signed_file_path: docData.signed_file || sigReq.signed_file_path,
                signed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", sigReq.id);

            await supabase
              .from("event_contracts")
              .update({
                status: "signed",
                signed_file_url: docData.signed_file || sigReq.signed_file_path,
                fully_signed_at: new Date().toISOString(),
              })
              .eq("id", contractId);

            sigReq.internal_status = "signed";
            sigReq.provider_response = docData;
            sigReq.signed_file_path = docData.signed_file || sigReq.signed_file_path;
          }
        }
      } catch (err) {
        console.warn("Aviso ao sincronizar ZapSign status:", err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        signatureRequest: sigReq,
        status: sigReq.internal_status,
        signers: sigReq.provider_response?.signers || [],
        externalRequestId: sigReq.external_request_id,
        signedFileUrl: sigReq.signed_file_path,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
