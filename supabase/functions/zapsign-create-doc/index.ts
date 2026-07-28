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

    const body = await req.json();
    const { contractId, pdfBase64, pdfUrl } = body;

    if (!contractId) {
      return new Response(
        JSON.stringify({ success: false, error: "contractId é obrigatório" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 1. Busca contrato no banco
    const { data: contract, error: contractError } = await supabase
      .from("event_contracts")
      .select("*, template:contract_templates(*), signer:contract_signers(*)")
      .eq("id", contractId)
      .single();

    if (contractError || !contract) {
      return new Response(
        JSON.stringify({ success: false, error: "Contrato não encontrado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // 2. Busca dados do evento e do cliente
    const { data: evento, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", contract.event_id)
      .single();

    if (eventError || !evento) {
      return new Response(
        JSON.stringify({ success: false, error: "Evento relacionado não encontrado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    const { data: clientData } = await supabase
      .from("event_contract_client_data")
      .select("*")
      .eq("event_id", contract.event_id)
      .maybeSingle();

    const clientName = clientData?.client_name || evento.client_name || "Contratante";
    const clientEmail = clientData?.email || evento.email || "";
    const clientCpf = clientData?.cpf || "";

    if (!clientEmail) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "E-mail do contratante não informado. Atualize os Dados do Contratante.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 3. Verifica Idempotência: solicitação ativa existente
    const { data: existingReq } = await supabase
      .from("contract_signature_requests")
      .select("*")
      .eq("contract_id", contractId)
      .eq("contract_version_id", contract.version || 1)
      .in("internal_status", ["pending_signature", "signed", "completed"])
      .maybeSingle();

    if (existingReq) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Já existe uma solicitação ativa para este contrato.",
          signatureRequestId: existingReq.id,
          status: existingReq.internal_status,
          externalRequestId: existingReq.external_request_id,
          signers: existingReq.provider_response?.signers || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // 4. Prepara URL / PDF do documento
    let finalPdfUrl = pdfUrl || contract.generated_file_url;
    let fileHash = "";

    // Se recebemos pdfBase64 no body, fazemos upload para o bucket público/privado
    if (pdfBase64 && !finalPdfUrl) {
      const fileName = `contracts/${contract.event_id}_v${contract.version || 1}_${Date.now()}.pdf`;
      const pdfBuffer = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));

      // Calcula SHA-256 do PDF
      const hashBuffer = await crypto.subtle.digest("SHA-256", pdfBuffer);
      fileHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const { error: uploadError } = await supabase.storage
        .from("signed-contracts")
        .upload(fileName, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (!uploadError) {
        const { data: pubUrlData } = supabase.storage
          .from("signed-contracts")
          .getPublicUrl(fileName);
        finalPdfUrl = pubUrlData.publicUrl;

        // Atualiza a URL gerada no contrato
        await supabase
          .from("event_contracts")
          .update({ generated_file_url: finalPdfUrl })
          .eq("id", contractId);
      }
    }

    // 5. Monta a lista de signatários para a ZapSign
    const signersPayload: any[] = [
      {
        name: clientName,
        email: clientEmail,
        send_automatic_email: true,
        qualification: "Contratante",
      },
    ];

    if (contract.signer?.name && contract.signer?.email) {
      signersPayload.push({
        name: contract.signer.name,
        email: contract.signer.email,
        send_automatic_email: true,
        qualification: "Contratada (GOAT Bar)",
      });
    }

    const docName = `Contrato - ${evento.event_name || clientName} (v${contract.version || 1})`;

    // 6. Chamada à API da ZapSign
    let providerResponse: any = null;
    let externalDocToken = "";
    let providerStatus = "pending";

    if (zapsignApiToken) {
      const zapsignUrl = "https://api.zapsign.com.br/api/v1/docs/";
      const payload: any = {
        name: docName,
        signers: signersPayload,
        lang: "pt-br",
      };

      if (finalPdfUrl) {
        payload.url_pdf = finalPdfUrl;
      } else if (pdfBase64) {
        payload.base64_pdf = pdfBase64;
      }

      const zapsignRes = await fetch(zapsignUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${zapsignApiToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!zapsignRes.ok) {
        const errText = await zapsignRes.text();
        console.error("Erro na API da ZapSign:", errText);
        throw new Error(`Erro na API ZapSign (${zapsignRes.status}): ${errText}`);
      }

      providerResponse = await zapsignRes.json();
      externalDocToken = providerResponse.token || providerResponse.open_id?.toString() || "";
      providerStatus = providerResponse.status || "pending";
    } else {
      // Sandbox / Modo de demonstração gracioso caso a chave ainda não esteja configurada no ambiente
      console.warn("ZAPSIGN_API_TOKEN não configurado no Supabase. Gerando registro mock para teste.");
      externalDocToken = `zapsign_mock_${Date.now()}`;
      providerResponse = {
        token: externalDocToken,
        status: "pending",
        signers: signersPayload.map((s, idx) => ({
          ...s,
          token: `signer_token_${idx + 1}`,
          sign_url: `https://app.zapsign.com.br/verificar/${externalDocToken}?signer=${idx + 1}`,
          status: "pending",
        })),
      };
    }

    // 7. Registra solicitação no banco public.contract_signature_requests
    const { data: sigReq, error: sigReqError } = await supabase
      .from("contract_signature_requests")
      .insert({
        event_id: contract.event_id,
        contract_id: contractId,
        contract_version_id: contract.version || 1,
        provider: "zapsign",
        external_request_id: externalDocToken,
        signer_name: clientName,
        signer_document: clientCpf,
        signer_email: clientEmail,
        original_file_path: finalPdfUrl,
        original_file_hash: fileHash,
        internal_status: "pending_signature",
        provider_status: providerStatus,
        provider_response: providerResponse,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (sigReqError) {
      console.error("Erro ao inserir contract_signature_requests:", sigReqError);
    }

    // 8. Atualiza status no contrato principal
    await supabase
      .from("event_contracts")
      .update({
        status: "sent",
        external_id: externalDocToken,
        sent_for_signature_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", contractId);

    return new Response(
      JSON.stringify({
        success: true,
        signatureRequestId: sigReq?.id || externalDocToken,
        externalDocToken,
        status: "pending_signature",
        signers: providerResponse.signers || [],
        docUrl: finalPdfUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Exceção na Edge Function zapsign-create-doc:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno do servidor" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
