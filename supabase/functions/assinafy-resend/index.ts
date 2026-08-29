import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AssinafyApiError, resendAssignment } from "../_shared/assinafy-client.ts";
import { requireContractSignatureAccess } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const timestamp = new Date().toISOString();
  let contractId: string | undefined;
  let internalDocumentId: string | undefined;
  let documentId: string | undefined;
  try {
    if (req.method !== "POST")
      throw Object.assign(new Error("Método não permitido."), { status: 405 });
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw Object.assign(new Error("Não autorizado."), { status: 401 });

    const auth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
      },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const body = await req.json();
    const action = typeof body.action === "string" ? body.action : "resend";
    documentId = typeof body.documentId === "string" ? body.documentId : undefined;
    const assignmentId = typeof body.assignmentId === "string" ? body.assignmentId : undefined;
    const signerId = typeof body.signerId === "string" ? body.signerId : undefined;
    if (!documentId || !assignmentId || !signerId)
      throw Object.assign(new Error("documentId, assignmentId e signerId são obrigatórios."), {
        status: 422,
      });

    const { data: signatureRequest, error: lookupError } = await admin
      .from("contract_signature_requests")
      .select("id,contract_id,dispatch_status,external_document_id,external_assignment_id")
      .eq("external_document_id", documentId)
      .eq("signature_provider", "assinafy")
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!signatureRequest)
      throw Object.assign(new Error("Documento Assinafy não encontrado no registro local."), {
        status: 404,
      });
    contractId = signatureRequest.contract_id;
    internalDocumentId = signatureRequest.id;
    await requireContractSignatureAccess(auth, "admin", contractId);

    if (signatureRequest.external_assignment_id !== assignmentId)
      throw Object.assign(new Error("O assignment não pertence à solicitação armazenada."), {
        status: 409,
      });
    if (["signed", "completed", "canceled", "cancelled"].includes(signatureRequest.dispatch_status))
      throw Object.assign(
        new Error(`Não é possível reenviar uma solicitação ${signatureRequest.dispatch_status}.`),
        { status: 409 },
      );

    const { data: signer } = await admin
      .from("contract_signature_signers")
      .select("id, status")
      .eq("signature_request_id", signatureRequest.id)
      .eq("external_signer_id", signerId)
      .maybeSingle();

    if (signer && signer.status === "signed") {
      throw Object.assign(new Error("Este signatário já concluiu a assinatura do documento."), {
        status: 409,
      });
    }

    if (action === "estimate") {
      const estimateResult = await estimateResendCost(documentId, assignmentId, signerId);
      const costData = (estimateResult as any)?.data || estimateResult;
      const cost = Number(costData?.cost || costData?.amount || 0);
      return new Response(
        JSON.stringify({
          success: true,
          action: "estimate",
          cost,
          currency: costData?.currency || "BRL",
          diagnostic: estimateResult.diagnostic,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.info("[assinafy-resend] validated", {
      timestamp,
      contractId,
      internalDocumentId,
      documentId,
      assignmentId,
      signerId,
    });
    const providerResult = await resendAssignment(documentId, assignmentId, signerId);

    // Verify activity from Assinafy activities trail
    let activityVerified = false;
    try {
      const activitiesResult = await getDocumentActivities(documentId);
      const activities = (activitiesResult as any)?.data || activitiesResult;
      activityVerified = Array.isArray(activities) && activities.length > 0;
    } catch (e) {
      console.warn("[assinafy-resend] activities_verification_warn", e);
    }

    if (signer) {
      const { error: updateError } = await admin
        .from("contract_signature_signers")
        .update({
          notification_status: "sent",
          notified_at: new Date().toISOString(),
          status: "pending",
        })
        .eq("id", signer.id);
      if (updateError) throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        action: "resend",
        activityVerified,
        diagnostic: {
          requestStarted: true,
          backendReached: true,
          assinafyRequestSent: true,
          httpStatus: providerResult.diagnostic.httpStatus,
          assinafyResponse: providerResult.diagnostic.responseBody,
          internalContractId: contractId,
          internalDocumentId,
          assinafyDocumentId: documentId,
          databaseUpdated: true,
          ...providerResult.diagnostic,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const providerDiagnostic = error instanceof AssinafyApiError ? error.diagnostic : undefined;
    const status =
      Number((error as { status?: number })?.status) || (providerDiagnostic ? 502 : 500);
    const message = error instanceof Error ? error.message : String(error);
    const diagnostic = {
      requestStarted: true,
      backendReached: true,
      assinafyRequestSent: Boolean(providerDiagnostic?.assinafyRequestSent),
      httpStatus: providerDiagnostic?.httpStatus ?? null,
      assinafyResponse: providerDiagnostic?.responseBody ?? null,
      errorMessage: providerDiagnostic?.errorMessage || message,
      internalContractId: contractId,
      internalDocumentId,
      assinafyDocumentId: documentId,
      databaseUpdated: false,
      endpoint: providerDiagnostic?.endpoint,
      method: providerDiagnostic?.method,
      timestamp: providerDiagnostic?.timestamp || timestamp,
      timedOut: Boolean(providerDiagnostic?.timedOut),
      authenticationRejected: Boolean(providerDiagnostic?.authenticationRejected),
    };
    console.error("[assinafy-resend] failure", diagnostic);
    return new Response(JSON.stringify({ success: false, error: message, diagnostic }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
