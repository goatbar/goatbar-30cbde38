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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log("[ZapSign Webhook] Payload recebido:", JSON.stringify(payload));

    const externalDocToken = payload.token || payload.doc_token || payload.open_id?.toString();
    const eventType = payload.event_type || payload.status;
    const signedFileUrl = payload.signed_file || payload.signed_file_url || payload.doc_url;

    if (!externalDocToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Identificador external_request_id não encontrado no payload" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 1. Localiza a solicitação no banco
    const { data: sigReq, error: reqError } = await supabase
      .from("contract_signature_requests")
      .select("*")
      .eq("external_request_id", externalDocToken)
      .maybeSingle();

    if (reqError || !sigReq) {
      console.warn(`[ZapSign Webhook] Nenhuma solicitação encontrada para o token ${externalDocToken}`);
      return new Response(
        JSON.stringify({ success: false, error: "Solicitação de assinatura não localizada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Mapeamento de Status
    let newInternalStatus = sigReq.internal_status;
    let isFullySigned = false;

    if (eventType === "doc_signed" || eventType === "signed" || payload.status === "signed") {
      newInternalStatus = "signed";
      isFullySigned = true;
    } else if (eventType === "doc_completed" || eventType === "completed") {
      newInternalStatus = "completed";
      isFullySigned = true;
    } else if (eventType === "doc_cancelled" || eventType === "cancelled") {
      newInternalStatus = "cancelled";
    }

    let localSignedFilePath = sigReq.signed_file_path;
    let signedFileHash = sigReq.signed_file_hash;

    // 2. Se o documento foi concluído/assinado e há URL do PDF assinado
    if (isFullySigned && signedFileUrl) {
      try {
        const fileRes = await fetch(signedFileUrl);
        if (fileRes.ok) {
          const pdfArrayBuffer = await fileRes.arrayBuffer();
          const pdfBytes = new Uint8Array(pdfArrayBuffer);

          // Calcula SHA-256 do arquivo assinado
          const hashBuffer = await crypto.subtle.digest("SHA-256", pdfBytes);
          signedFileHash = Array.from(new Uint8Array(hashBuffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

          const storagePath = `signed/zapsign_${sigReq.event_id}_${Date.now()}.pdf`;

          const { error: uploadErr } = await supabase.storage
            .from("signed-contracts")
            .upload(storagePath, pdfBytes, {
              contentType: "application/pdf",
              upsert: true,
            });

          if (!uploadErr) {
            const { data: pubData } = supabase.storage
              .from("signed-contracts")
              .getPublicUrl(storagePath);
            localSignedFilePath = pubData.publicUrl;
          } else {
            localSignedFilePath = signedFileUrl;
          }
        }
      } catch (err) {
        console.error("Erro ao baixar/armazenar PDF assinado no Supabase Storage:", err);
        localSignedFilePath = signedFileUrl;
      }
    }

    // 3. Atualiza o registro em contract_signature_requests
    await supabase
      .from("contract_signature_requests")
      .update({
        internal_status: newInternalStatus,
        provider_status: payload.status || eventType,
        callback_payload: payload,
        signed_file_path: localSignedFilePath || signedFileUrl,
        signed_file_hash: signedFileHash,
        signed_at: isFullySigned ? new Date().toISOString() : sigReq.signed_at,
        completed_at: isFullySigned ? new Date().toISOString() : sigReq.completed_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sigReq.id);

    // 4. Atualiza a tabela event_contracts
    const eventContractUpdate: any = {
      status: isFullySigned ? "signed" : newInternalStatus,
      updated_at: new Date().toISOString(),
    };

    if (localSignedFilePath || signedFileUrl) {
      eventContractUpdate.signed_file_url = localSignedFilePath || signedFileUrl;
    }

    if (isFullySigned) {
      eventContractUpdate.fully_signed_at = new Date().toISOString();
    }

    await supabase
      .from("event_contracts")
      .update(eventContractUpdate)
      .eq("id", sigReq.contract_id);

    return new Response(
      JSON.stringify({
        success: true,
        contractId: sigReq.contract_id,
        status: newInternalStatus,
        signedFileUrl: localSignedFilePath || signedFileUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Exceção na Edge Function zapsign-webhook:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno no webhook" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
