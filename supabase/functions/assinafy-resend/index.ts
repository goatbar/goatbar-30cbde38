import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AssinafyApiError,
  resendAssignment,
  estimateResendCost,
  getDocumentActivities,
} from "../_shared/assinafy-client.ts";
import { requireContractSignatureAccess } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const timestamp = new Date().toISOString();
  let stage = "validating_input";
  let contractId: string | undefined;
  let internalDocumentId: string | undefined;
  let documentId: string | undefined;
  let assignmentId: string | undefined;
  let signerId: string | undefined;
  let action = "resend";
  let providerCalled = false;

  try {
    if (req.method !== "POST") {
      throw Object.assign(new Error("Método não permitido."), { status: 405, code: "validation_error" });
    }
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw Object.assign(new Error("Não autorizado."), { status: 401, code: "validation_error" });
    }

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
    action = typeof body.action === "string" ? body.action : "resend";
    documentId = typeof body.documentId === "string" ? body.documentId : undefined;
    assignmentId = typeof body.assignmentId === "string" ? body.assignmentId : undefined;
    signerId = typeof body.signerId === "string" ? body.signerId : undefined;

    if (!documentId || !assignmentId || !signerId) {
      throw Object.assign(new Error("documentId, assignmentId e signerId são obrigatórios."), {
        status: 422,
        code: "validation_error",
      });
    }

    stage = "lookup_request";
    const { data: signatureRequest, error: lookupError } = await admin
      .from("contract_signature_requests")
      .select("id,contract_id,dispatch_status,external_document_id,external_assignment_id")
      .eq("external_document_id", documentId)
      .eq("signature_provider", "assinafy")
      .maybeSingle();

    if (lookupError) {
      throw Object.assign(lookupError, { status: 500, code: "database_sync_failed", stage: "lookup_request" });
    }
    if (!signatureRequest) {
      throw Object.assign(new Error("Documento Assinafy não encontrado no registro local."), {
        status: 404,
        code: "validation_error",
        stage: "lookup_request",
      });
    }

    contractId = signatureRequest.contract_id;
    internalDocumentId = signatureRequest.id;

    stage = "authorization";
    await requireContractSignatureAccess(auth, "admin", contractId);

    if (signatureRequest.external_assignment_id !== assignmentId) {
      throw Object.assign(new Error("O assignment não pertence à solicitação armazenada."), {
        status: 409,
        code: "validation_error",
        stage: "validating_input",
      });
    }

    if (["signed", "completed", "canceled", "cancelled"].includes(signatureRequest.dispatch_status)) {
      throw Object.assign(
        new Error(`Não é possível reenviar uma solicitação com status ${signatureRequest.dispatch_status}.`),
        { status: 409, code: "validation_error", stage: "validating_input" },
      );
    }

    stage = "verifying_signer";
    const { data: signer } = await admin
      .from("contract_signature_signers")
      .select("id, status")
      .eq("signature_request_id", signatureRequest.id)
      .eq("external_signer_id", signerId)
      .maybeSingle();

    if (signer && signer.status === "signed") {
      throw Object.assign(new Error("Este signatário já concluiu a assinatura do documento."), {
        status: 409,
        code: "signer_already_signed",
        stage: "verifying_signer",
      });
    }

    if (action === "estimate") {
      stage = "estimating_cost";
      let estimateResult;
      try {
        estimateResult = await estimateResendCost(documentId, assignmentId, signerId);
      } catch (err) {
        throw Object.assign(err, { code: "estimate_failed" });
      }
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

    stage = "calling_resend_api";
    console.info("[assinafy-resend] dispatching_resend", {
      timestamp,
      contractId,
      internalDocumentId,
      documentId,
      assignmentId,
      signerId,
    });

    providerCalled = true;
    let providerResult;
    try {
      providerResult = await resendAssignment(documentId, assignmentId, signerId);
    } catch (err) {
      throw Object.assign(err, { code: "resend_failed" });
    }

    stage = "verifying_activity";
    let activityVerified = false;
    try {
      const activitiesResult = await getDocumentActivities(documentId);
      const activities = (activitiesResult as any)?.data || activitiesResult;
      activityVerified = Array.isArray(activities) && activities.length > 0;
    } catch (e) {
      console.warn("[assinafy-resend] activities_verification_warn", e);
    }

    stage = "updating_database";
    if (signer) {
      const { error: updateError } = await admin
        .from("contract_signature_signers")
        .update({
          notification_status: "sent",
          notified_at: new Date().toISOString(),
          status: "pending",
        })
        .eq("id", signer.id);
      if (updateError) {
        throw Object.assign(updateError, { status: 500, code: "database_sync_failed" });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        action: "resend",
        activityVerified,
        diagnostic: {
          stage: "completed",
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
  } catch (error: any) {
    const providerDiagnostic = error instanceof AssinafyApiError ? error.diagnostic : undefined;
    const status =
      Number(error?.status) || (providerDiagnostic ? (providerDiagnostic.httpStatus ?? 502) : 500);
    const code = error?.code || (providerDiagnostic ? "upstream_error" : "internal_error");
    const message = error instanceof Error ? error.message : String(error);

    const diagnostic = {
      stage: error?.stage || stage,
      code,
      requestStarted: true,
      backendReached: true,
      assinafyRequestSent: providerCalled || Boolean(providerDiagnostic?.assinafyRequestSent),
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
    return new Response(
      JSON.stringify({
        success: false,
        code,
        error: message,
        diagnostic,
      }),
      {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
