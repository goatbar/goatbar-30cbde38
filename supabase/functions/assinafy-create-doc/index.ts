import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  uploadDocument,
  findSigner,
  createSigner,
  createAssignment,
} from "../_shared/assinafy-client.ts";
import { requireContractSignatureAccess } from "../_shared/auth-helper.ts";
import { resolveContractAccess } from "./contract-access.ts";
import {
  CreateDocHttpError,
  decodePdfBase64,
  decideDispatch,
  validateCreateDocPayload,
  validatePdfHash,
  validateSigner,
  authenticatedClientOptions,
} from "./logic.ts";
import { ASSINAFY_ACCOUNT_ID, ASSINAFY_API_KEY } from "../_shared/assinafy-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const correlationId = req.headers.get("x-request-id") || crypto.randomUUID();
  let requestContractId: string | undefined;
  let requestId: string | undefined;
  let stage = "01_auth";
  console.info("[assinafy-create-doc] request received", { method: req.method, correlationId });
  try {
    if (req.method !== "POST")
      throw Object.assign(new Error("Método não permitido."), {
        status: 405,
        code: "method_not_allowed",
      });
    stage = "01_auth";
    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      throw new CreateDocHttpError(401, "authentication_required", "Usuário não autenticado");

    const supabaseAuthClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      authenticatedClientOptions(authHeader),
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const access = await requireContractSignatureAccess(supabaseAuthClient, "create");
    console.info("[assinafy-create-doc] authenticated", {
      userId: access.user.id,
      correlationId,
    });

    stage = "02_parse_payload";
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new CreateDocHttpError(400, "invalid_json", "JSON malformado.");
    }
    const fieldNames =
      rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
        ? Object.keys(rawBody as object)
        : [];
    stage = "03_validate_payload";
    const { contractId, pdfBase64, pdfUrl, pdfHash } = validateCreateDocPayload(rawBody);
    requestContractId = contractId;
    console.info("[assinafy-create-doc] payload", {
      fieldNames,
      contractId,
      pdfBase64Present: Boolean(pdfBase64),
      pdfBase64Length: pdfBase64?.length || 0,
      originalFileHash: pdfHash,
      correlationId,
    });
    stage = "04_load_contract";

    const existenceLookup = async () => {
      const result = await supabaseAdmin
        .from("event_contracts")
        .select("id")
        .eq("id", contractId)
        .maybeSingle();
      if (result.error) {
        console.error("[assinafy-create-doc]", {
          stage: "contract_existence_lookup",
          contractId,
          code: result.error.code,
          message: result.error.message,
          correlationId,
        });
      } else {
        console.info("[assinafy-create-doc] contract existence", {
          stage,
          userId: access.user.id,
          contractId,
          queryTable: "event_contracts",
          queryErrorCode: null,
          contractExists: Boolean(result.data),
          correlationId,
        });
      }
      return result;
    };

    const authorizedLookup = async () => {
      const contractResult = await supabaseAuthClient
        .from("event_contracts")
        .select("*")
        .eq("id", contractId)
        .maybeSingle();

      if (contractResult.error) {
        console.error("[assinafy-create-doc]", {
          stage: "authorized_contract_lookup",
          contractId,
          code: contractResult.error.code,
          message: contractResult.error.message,
          correlationId,
        });
        return { data: null, error: contractResult.error };
      }

      if (!contractResult.data) {
        console.info("[assinafy-create-doc] contract access", {
          stage: "05_authorize_event",
          userId: access.user.id,
          contractId,
          queryTable: "event_contracts",
          queryErrorCode: null,
          rowFound: false,
          accessGranted: false,
          eventId: null,
          correlationId,
        });
        return { data: null, error: null };
      }

      const eventResult = await supabaseAuthClient
        .from("events")
        .select("client_name, email")
        .eq("id", contractResult.data.event_id)
        .maybeSingle();

      if (eventResult.error) {
        console.error("[assinafy-create-doc]", {
          stage: "authorized_event_lookup",
          contractId,
          eventId: contractResult.data.event_id,
          code: eventResult.error.code,
          message: eventResult.error.message,
          correlationId,
        });
        return { data: null, error: eventResult.error };
      }

      console.info("[assinafy-create-doc] contract access", {
        stage: "05_authorize_event",
        userId: access.user.id,
        contractId,
        queryTable: "event_contracts",
        queryErrorCode: null,
        rowFound: true,
        accessGranted: true,
        eventId: contractResult.data.event_id,
        correlationId,
      });

      return {
        data: {
          ...contractResult.data,
          event: eventResult.data || null,
        },
        error: null,
      };
    };
    stage = "05_authorize_event";
    const contract = await resolveContractAccess(existenceLookup, authorizedLookup);
    if (!contract)
      throw new CreateDocHttpError(404, "contract_not_found", "Contrato não encontrado.");
    stage = "05_authorize_event";
    const signer = validateSigner(contract.event?.client_name, contract.event?.email);

    // A partir daqui, sabemos que o usuário logado tem acesso ao contrato.
    // Usamos o supabaseAdmin para garantir inserts independentes de políticas parciais.
    stage = "06_find_or_create_request";
    let { data: sigReq } = await supabaseAdmin
      .from("contract_signature_requests")
      .select("*")
      .eq("contract_id", contractId)
      .eq("signature_provider", "assinafy")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    console.info("[assinafy-create-doc] local request", {
      exists: Boolean(sigReq),
      requestId: sigReq?.id,
      localStatus: sigReq?.dispatch_status,
      contractId,
      correlationId,
    });
    const dispatchDecision = decideDispatch(sigReq, pdfHash);
    if (dispatchDecision.action === "hash_conflict") {
      throw new CreateDocHttpError(
        409,
        "pdf_hash_mismatch",
        "O PDF atual diverge do documento associado à solicitação existente.",
      );
    }

    if (sigReq && dispatchDecision.action === "reuse") {
      stage = "14_complete";
      return new Response(
        JSON.stringify({
          success: true,
          signatureRequestId: sigReq.id,
          externalDocumentId: sigReq.external_document_id,
          externalAssignmentId: sigReq.external_assignment_id,
          signatureUrl: sigReq.signature_url,
          status: sigReq.dispatch_status,
          diagnostic: {
            requestStarted: true,
            backendReached: true,
            assinafyRequestSent: false,
            httpStatus: null,
            assinafyResponse: "Existing active request reused; no new provider request was sent.",
            internalContractId: contractId,
            internalDocumentId: sigReq.id,
            assinafyDocumentId: sigReq.external_document_id,
            databaseUpdated: false,
            timestamp: new Date().toISOString(),
            timedOut: false,
            authenticationRejected: false,
          },
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "x-request-id": correlationId,
          },
        },
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

    if (!sigReq) {
      const { data: newReq } = await supabaseAdmin
        .from("contract_signature_requests")
        .insert({
          event_id: contract.event_id,
          contract_id: contractId,
          contract_version_id: contract.version || 1,
          signature_provider: "assinafy",
          dispatch_status: "idle",
          internal_status: "pending_signature",
          original_file_hash: pdfHash,
        })
        .select()
        .single();
      if (!newReq)
        throw new CreateDocHttpError(
          500,
          "request_persist_failed",
          "Não foi possível criar a solicitação de assinatura.",
        );
      sigReq = newReq;
    } else if (sigReq.dispatch_status === "failed") {
      const { data: retryReq, error: retryError } = await supabaseAdmin
        .from("contract_signature_requests")
        .update({ dispatch_status: "idle", last_error: null, original_file_hash: pdfHash })
        .eq("id", sigReq.id)
        .eq("dispatch_status", "failed")
        .select()
        .single();
      if (retryError || !retryReq)
        throw Object.assign(new Error("Não foi possível preparar a nova tentativa."), {
          status: 409,
          code: "retry_conflict",
        });
      sigReq = retryReq;
    }

    requestId = sigReq.id;
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

    requestId = lockedReq.id;
    let externalDocId = lockedReq.external_document_id;
    let externalAssignId = lockedReq.external_assignment_id;
    let lastProviderDiagnostic: Record<string, unknown> | undefined;

    try {
      const clientEmail = signer.email;
      const clientName = signer.name;

      if (!externalDocId) {
        stage = "07_validate_hash";
        let buffer: Uint8Array;
        if (pdfBase64) {
          stage = "08_decode_pdf";
          buffer = decodePdfBase64(pdfBase64);
        } else {
          const fileRes = await fetch(pdfUrl!);
          if (!fileRes.ok)
            throw new CreateDocHttpError(
              422,
              "pdf_url_unreadable",
              "Não foi possível baixar o PDF informado.",
            );
          buffer = new Uint8Array(await fileRes.arrayBuffer());
          if (new TextDecoder().decode(buffer.slice(0, 5)) !== "%PDF-")
            throw new CreateDocHttpError(
              422,
              "pdf_signature_invalid",
              "O arquivo recebido não possui assinatura PDF válida.",
            );
        }
        await validatePdfHash(buffer, pdfHash);
        if (!ASSINAFY_API_KEY || !ASSINAFY_ACCOUNT_ID)
          throw new CreateDocHttpError(
            503,
            "assinafy_not_configured",
            "Serviço de assinatura indisponível.",
          );
        console.info("[assinafy-create-doc] provider configuration", {
          configured: true,
          environment: Deno.env.get("ASSINAFY_ENVIRONMENT") || "sandbox",
          apiKeyEnvironmentVariable: "ASSINAFY_API_KEY",
          apiKeyPresent: Boolean(ASSINAFY_API_KEY),
          accountIdEnvironmentVariable: "ASSINAFY_ACCOUNT_ID",
          accountIdPresent: Boolean(ASSINAFY_ACCOUNT_ID),
          authenticationHeader: "X-Api-Key",
          correlationId,
        });
        stage = "09_provider_document";
        const fileName = `Contrato_${contract.event_id}.pdf`;
        stage = "10_provider_upload";
        const docResult = await uploadDocument(fileName, buffer);
        lastProviderDiagnostic = docResult?.diagnostic;
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
        stage = "11_provider_signer";
        const found = await findSigner(clientEmail);
        lastProviderDiagnostic = found?.diagnostic || lastProviderDiagnostic;
        if (found && found.id) {
          extSignerId = found.id;
        } else {
          const created = await createSigner(clientName, clientEmail);
          lastProviderDiagnostic = created?.diagnostic || lastProviderDiagnostic;
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
        stage = "12_provider_assignment";
        const assignRes = await createAssignment(externalDocId, [{ id: extSignerId }]);
        lastProviderDiagnostic = assignRes?.diagnostic || lastProviderDiagnostic;
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

      stage = "13_persist";
      const { error: requestUpdateError } = await supabaseAdmin
        .from("contract_signature_requests")
        .update({
          dispatch_status: "pending_signature",
          sent_at: new Date().toISOString(),
        })
        .eq("id", lockedReq.id);
      if (requestUpdateError) throw requestUpdateError;

      const { error: contractUpdateError } = await supabaseAdmin
        .from("event_contracts")
        .update({
          status: "sent",
          sent_for_signature_at: new Date().toISOString(),
        })
        .eq("id", contractId);
      if (contractUpdateError) throw contractUpdateError;

      stage = "14_complete";
      return new Response(
        JSON.stringify({
          success: true,
          signatureRequestId: lockedReq.id,
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
          diagnostic: {
            requestStarted: true,
            backendReached: true,
            assinafyRequestSent: Boolean(lastProviderDiagnostic?.assinafyRequestSent),
            httpStatus: lastProviderDiagnostic?.httpStatus ?? null,
            assinafyResponse: lastProviderDiagnostic?.responseBody ?? null,
            internalContractId: contractId,
            internalDocumentId: lockedReq.id,
            assinafyDocumentId: externalDocId,
            databaseUpdated: true,
            endpoint: lastProviderDiagnostic?.endpoint,
            method: lastProviderDiagnostic?.method,
            timestamp: lastProviderDiagnostic?.timestamp,
            timedOut: false,
            authenticationRejected: false,
          },
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "x-request-id": correlationId,
          },
        },
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
    const message = String(error?.message || "Falha interna ao enviar para assinatura.");
    const isProviderError =
      error?.name === "AssinafyApiError" || message.includes("Assinafy API Error");
    const status =
      Number(error?.status) ||
      (message.includes("não autenticado")
        ? 401
        : message.includes("não encontrado")
          ? 404
          : message.includes("acesso negado") || message.includes("acesso ao contrato")
            ? 403
            : isProviderError
              ? 502
              : 500);
    const code =
      error?.code ||
      (isProviderError
        ? "assinafy_upstream_error"
        : status === 401
          ? "authentication_required"
          : status === 403
            ? "forbidden"
            : status === 404
              ? "contract_not_found"
              : "internal_error");
    const safeMessage = isProviderError
      ? "A Assinafy rejeitou a operação."
      : status >= 500 && !(error instanceof CreateDocHttpError)
        ? "Falha interna ao enviar para assinatura."
        : message;
    console.error("[assinafy-create-doc] failure", {
      stage,
      status,
      code,
      safeMessage,
      contractId: requestContractId,
      requestId,
      providerCalled:
        stage.startsWith("09_") ||
        stage.startsWith("10_") ||
        stage.startsWith("11_") ||
        stage.startsWith("12_"),
      providerStatus: isProviderError ? error?.providerStatus : undefined,
      correlationId,
      providerDiagnostic: error?.diagnostic,
    });
    const authenticationRejected =
      status === 401 ||
      code === "authentication_required" ||
      Boolean(error?.diagnostic?.authenticationRejected);

    return new Response(
      JSON.stringify({
        success: false,
        message: safeMessage,
        error: safeMessage,
        code,
        requestId: correlationId,
        diagnostic: {
          requestStarted: true,
          backendReached: true,
          assinafyRequestSent: Boolean(error?.diagnostic?.assinafyRequestSent),
          httpStatus: error?.diagnostic?.httpStatus ?? null,
          assinafyResponse: error?.diagnostic?.responseBody ?? null,
          errorMessage: error?.diagnostic?.errorMessage || message,
          internalContractId: requestContractId,
          internalDocumentId: requestId,
          assinafyDocumentId: null,
          databaseUpdated: Boolean(requestId),
          endpoint: error?.diagnostic?.endpoint,
          method: error?.diagnostic?.method,
          timestamp: error?.diagnostic?.timestamp || new Date().toISOString(),
          timedOut: Boolean(error?.diagnostic?.timedOut),
          authenticationRejected,
        },
      }),
      {
        status,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "x-request-id": correlationId,
        },
      },
    );
  }
});
