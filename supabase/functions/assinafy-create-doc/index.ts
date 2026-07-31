import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  uploadDocument,
  findSigner,
  createSigner,
  createAssignment,
} from "../_shared/assinafy-client.ts";
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado. Missing Auth Header");

    const supabaseAuthClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { contractId, pdfBase64, pdfUrl } = await req.json();
    if (!contractId) throw new Error("contractId obrigatório");

    await requireContractSignatureAccess(supabaseAuthClient, "create", contractId);

    const { data: contract } = await supabaseAuthClient
      .from("event_contracts")
      .select("*, event:events(client_name, email)")
      .eq("id", contractId)
      .single();

    // A partir daqui, sabemos que o usuário logado tem acesso ao contrato.
    // Usamos o supabaseAdmin para garantir inserts independentes de políticas parciais.
    let { data: sigReq } = await supabaseAdmin
      .from("contract_signature_requests")
      .select("*")
      .eq("contract_id", contractId)
      .eq("signature_provider", "assinafy")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sigReq && ["pending_signature", "signed", "completed"].includes(sigReq.dispatch_status)) {
      return new Response(
        JSON.stringify({
          success: true,
          externalDocumentId: sigReq.external_document_id,
          externalAssignmentId: sigReq.external_assignment_id,
          signatureUrl: sigReq.signature_url,
          status: sigReq.dispatch_status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (sigReq && sigReq.dispatch_status === "processing") {
      const diffMs = new Date().getTime() - new Date(sigReq.updated_at).getTime();
      // Se travado há mais de 10 min, pode ter sido crash
      if (diffMs > 10 * 60 * 1000) {
        await supabaseAdmin
          .from("contract_signature_requests")
          .update({
            dispatch_status: "reconciliation_required",
            last_error: "Timeout na tentativa anterior. Reconciliação manual necessária.",
          })
          .eq("id", sigReq.id);
        throw new Error(
          "Falha opaca no envio anterior. Por segurança o envio automático foi bloqueado (reconciliation_required).",
        );
      } else {
        throw new Error("Contrato já está sendo processado. Aguarde.");
      }
    }

    if (sigReq && sigReq.dispatch_status === "reconciliation_required") {
      throw new Error(
        "Envio bloqueado por segurança devido a falha opaca anterior. Reconciliação manual necessária.",
      );
    }

    if (!sigReq || sigReq.dispatch_status === "failed") {
      const { data: newReq } = await supabaseAdmin
        .from("contract_signature_requests")
        .insert({
          event_id: contract.event_id,
          contract_id: contractId,
          contract_version_id: contract.version || 1,
          signature_provider: "assinafy",
          dispatch_status: "idle",
          internal_status: "pending_signature",
        })
        .select()
        .single();
      sigReq = newReq;
    }

    const { data: lockedReq, error: lockErr } = await supabaseAdmin
      .from("contract_signature_requests")
      .update({ dispatch_status: "processing", updated_at: new Date().toISOString() })
      .eq("id", sigReq.id)
      .in("dispatch_status", ["idle"])
      .select()
      .single();

    if (lockErr || !lockedReq) {
      throw new Error("Falha ao adquirir lock no request. Concorrência evitada.");
    }

    let externalDocId = lockedReq.external_document_id;
    let externalAssignId = lockedReq.external_assignment_id;

    try {
      const clientEmail = contract.event?.email;
      const clientName = contract.event?.client_name || "Cliente";

      if (!clientEmail) throw new Error("E-mail do cliente não informado no evento.");

      if (!externalDocId) {
        let buffer: Uint8Array;
        if (pdfBase64) {
          const bstr = atob(pdfBase64);
          buffer = new Uint8Array(bstr.length);
          for (let i = 0; i < bstr.length; i++) buffer[i] = bstr.charCodeAt(i);
        } else if (pdfUrl) {
          const fileRes = await fetch(pdfUrl);
          if (!fileRes.ok) throw new Error("Falha ao baixar PDF do URL");
          buffer = new Uint8Array(await fileRes.arrayBuffer());
        } else {
          throw new Error("Nenhum PDF fornecido");
        }

        const fileName = `Contrato_${contract.event_id}.pdf`;
        const docResult = await uploadDocument(fileName, buffer);
        externalDocId = docResult?.data?.id || docResult?.id;

        if (!externalDocId) throw new Error("API não retornou o ID do documento");

        await supabaseAdmin
          .from("contract_signature_requests")
          .update({ external_document_id: externalDocId })
          .eq("id", lockedReq.id);
      }

      let extSignerId: string | null = null;
      const { data: existingSigner } = await supabaseAdmin
        .from("contract_signature_signers")
        .select("external_signer_id")
        .eq("signature_request_id", lockedReq.id)
        .eq("email", clientEmail)
        .maybeSingle();

      if (existingSigner?.external_signer_id) {
        extSignerId = existingSigner.external_signer_id;
      } else {
        const found = await findSigner(clientEmail);
        if (found && found.id) {
          extSignerId = found.id;
        } else {
          const created = await createSigner(clientName, clientEmail);
          extSignerId = created?.data?.id || created?.id;
        }

        if (extSignerId) {
          await supabaseAdmin.from("contract_signature_signers").insert({
            signature_request_id: lockedReq.id,
            role: "client",
            full_name: clientName,
            email: clientEmail,
            external_signer_id: extSignerId,
          });
        }
      }

      if (!extSignerId) throw new Error("Não foi possível criar/recuperar Signer.");

      if (!externalAssignId) {
        const assignRes = await createAssignment(externalDocId, [{ id: extSignerId }]);
        externalAssignId = assignRes?.data?.id || assignRes?.id;
        const assignment = assignRes?.data || assignRes;
        const signingEntry = assignment?.signing_urls?.find(
          (entry: any) => entry.signer_id === extSignerId,
        );
        const assignedSigner = assignment?.signers?.find(
          (signer: any) => signer.id === extSignerId,
        );
        const sigUrl = signingEntry?.url || assignment?.signature_url;

        if (!externalAssignId) throw new Error("API não retornou o ID do Assignment");

        await supabaseAdmin
          .from("contract_signature_requests")
          .update({
            external_assignment_id: externalAssignId,
            signature_url: sigUrl,
          })
          .eq("id", lockedReq.id);

        await supabaseAdmin
          .from("contract_signature_signers")
          .update({
            signature_url: sigUrl,
            notification_status: assignedSigner?.notified ? "sent" : "pending",
            notified_at: assignedSigner?.notified ? new Date().toISOString() : null,
          })
          .eq("signature_request_id", lockedReq.id)
          .eq("external_signer_id", extSignerId);
      }

      await supabaseAdmin
        .from("contract_signature_requests")
        .update({
          dispatch_status: "pending_signature",
          sent_at: new Date().toISOString(),
        })
        .eq("id", lockedReq.id);

      await supabaseAdmin
        .from("event_contracts")
        .update({
          status: "sent",
          sent_for_signature_at: new Date().toISOString(),
        })
        .eq("id", contractId);

      return new Response(
        JSON.stringify({
          success: true,
          externalDocumentId: externalDocId,
          externalAssignmentId: externalAssignId,
          signatureUrl: (
            await supabaseAdmin
              .from("contract_signature_requests")
              .select("signature_url")
              .eq("id", lockedReq.id)
              .single()
          ).data?.signature_url,
          status: "pending_signature",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (e: any) {
      // Se houve erro antes de salvar doc id, bloqueia pra reconciliação.
      // Se salvou o doc id, apenas falha pra tentar novamente o assignment
      const failState = externalDocId ? "failed" : "reconciliation_required";
      await supabaseAdmin
        .from("contract_signature_requests")
        .update({
          dispatch_status: failState,
          last_error: e.message,
        })
        .eq("id", lockedReq.id);

      throw e;
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
