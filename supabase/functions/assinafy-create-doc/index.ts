import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  uploadDocument,
  findSigner,
  createSigner,
  createAssignment,
  getDocumentStatus,
  AssinafyApiError,
  ASSINAFY_ACCOUNT_ID,
  ASSINAFY_API_KEY,
} from "../_shared/assinafy-client.ts";
import { requireContractSignatureAccess } from "../_shared/auth-helper.ts";
import { resolveContractAccess } from "./contract-access.ts";
import {
  CreateDocHttpError,
  authenticatedClientOptions,
  buildRequiredAssignment,
  decodePdfBase64,
  decideDispatch,
  validateCreateDocPayload,
  validatePdfHash,
  validateRequiredSigners,
  type RequiredSigner,
} from "./logic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id",
};
const json = (body: unknown, status: number, correlationId: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": correlationId },
  });

type ProviderState = {
  called: boolean;
  documentId: string | null;
  assignmentId: string | null;
  diagnostic?: Record<string, unknown>;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const correlationId = req.headers.get("x-request-id") || crypto.randomUUID();
  let stage = "received";
  let contractId: string | undefined;
  let signatureRequestId: string | undefined;
  const provider: ProviderState = { called: false, documentId: null, assignmentId: null };

  try {
    if (req.method !== "POST")
      throw new CreateDocHttpError(405, "method_not_allowed", "Método não permitido.");
    stage = "authenticating";
    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      throw new CreateDocHttpError(401, "authentication_required", "Usuário não autenticado.");
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const auth = createClient(
      url,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      authenticatedClientOptions(authHeader),
    );
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const access = await requireContractSignatureAccess(auth, "create");

    stage = "validating_payload";
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new CreateDocHttpError(400, "invalid_json", "JSON malformado.");
    }
    const payload = validateCreateDocPayload(body);
    contractId = payload.contractId;

    stage = "loading_contract";
    const existenceLookup = () =>
      admin.from("event_contracts").select("id").eq("id", contractId!).maybeSingle();
    const authorizedLookup = async () => {
      const result = await auth
        .from("event_contracts")
        .select("*")
        .eq("id", contractId!)
        .maybeSingle();
      if (result.error || !result.data) return result;
      const event = await auth
        .from("events")
        .select("client_name,email,event_name,date")
        .eq("id", result.data.event_id)
        .maybeSingle();
      if (event.error) return { data: null, error: event.error };
      let companySigner = null;
      if (result.data.signer_id) {
        const company = await auth
          .from("contract_signers")
          .select("name,email")
          .eq("id", result.data.signer_id)
          .eq("is_active", true)
          .maybeSingle();
        if (company.error) return { data: null, error: company.error };
        companySigner = company.data;
      }
      return { data: { ...result.data, event: event.data, companySigner }, error: null };
    };
    const contract = await resolveContractAccess(existenceLookup, authorizedLookup);
    if (!contract)
      throw new CreateDocHttpError(404, "contract_not_found", "Contrato não encontrado.");
    const requiredSigners = validateRequiredSigners(
      { name: contract.event?.client_name, email: contract.event?.email },
      contract.companySigner,
    );
    console.info("[assinafy-create-doc] validated", {
      stage,
      correlationId,
      contractId,
      userId: access.user.id,
      signerRoles: requiredSigners.map((s) => s.role),
    });

    stage = "resolving_idempotency";
    const { data: foundRequest, error: lookupError } = await admin
      .from("contract_signature_requests")
      .select("*")
      .eq("contract_id", contractId)
      .eq("signature_provider", "assinafy")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lookupError) throw lookupError;
    let sigReq = foundRequest;
    const decision = decideDispatch(sigReq, payload.pdfHash);
    if (
      decision.action === "reuse" ||
      decision.action === "reconcile_local_persistence" ||
      decision.action === "reconcile"
    ) {
      // ── Remote existence check ──────────────────────────────────────────────
      // Before trusting the local state, verify that the document still exists
      // on the Assinafy side. A 404 here means the remote was deleted/expired.
      if (sigReq.external_document_id) {
        stage = "verifying_remote_document";
        let remoteExists = true;
        try {
          await getDocumentStatus(sigReq.external_document_id);
        } catch (remoteErr) {
          if (
            remoteErr instanceof AssinafyApiError &&
            remoteErr.providerStatus === 404
          ) {
            remoteExists = false;
          } else {
            // Non-404 upstream errors (5xx, network) — log but don't block.
            // We fall back to normal reuse/reconcile so we don't create duplicates.
            console.warn("[assinafy-create-doc] remote_check_warn", {
              documentId: sigReq.external_document_id,
              error: remoteErr instanceof Error ? remoteErr.message : String(remoteErr),
            });
          }
        }

        if (!remoteExists) {
          // Persist the new status so assinafy-status & the UI know immediately.
          // Preserve external_document_id / external_assignment_id for audit — do NOT null them.
          stage = "persisting_remote_document_missing";
          const { error: updateErr } = await admin
            .from("contract_signature_requests")
            .update({
              dispatch_status: "remote_document_missing",
              last_error: `Documento remoto ${sigReq.external_document_id} não encontrado na Assinafy (HTTP 404). Verificado em ${new Date().toISOString()}.`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sigReq.id);
          if (updateErr) throw updateErr;

          console.info("[assinafy-create-doc] remote_document_missing", {
            contractId,
            signatureRequestId: sigReq.id,
            assinafyDocumentId: sigReq.external_document_id,
          });

          return json(
            {
              success: false,
              dispatchOutcome: "remote_document_missing",
              recreationRequired: true,
              message:
                "O documento anterior não existe mais na Assinafy. É necessário gerar um novo envio para assinatura.",
              signatureRequestId: sigReq.id,
              externalDocumentId: sigReq.external_document_id,
              externalAssignmentId: sigReq.external_assignment_id,
              status: "remote_document_missing",
              diagnostic: {
                stage: "verifying_remote_document",
                correlationId,
                assinafyRequestSent: true,
                assinafyDocumentId: sigReq.external_document_id,
                httpStatus: 404,
                databaseUpdated: true,
              },
            },
            404,
            correlationId,
          );
        }
      }
      // ── End remote existence check ──────────────────────────────────────────

      const needsReconciliation = decision.action !== "reuse";

      // Inspect local signers to determine if reconciliation is required
      const { data: existingSigners } = await admin
        .from("contract_signature_signers")
        .select("id, role, full_name, email, signature_url, notification_status")
        .eq("signature_request_id", sigReq.id);

      const clientReq = requiredSigners.find((s) => s.role === "client");
      const companyReq = requiredSigners.find((s) => s.role === "company");
      const hasClient = existingSigners?.some(
        (s) => s.role === "client" || (clientReq && s.email.toLowerCase() === clientReq.email.toLowerCase()),
      );
      const hasCompany = companyReq
        ? existingSigners?.some(
            (s) => s.role === "company" || s.email.toLowerCase() === companyReq.email.toLowerCase(),
          )
        : true;
      const isMissingSigners =
        !hasClient || !hasCompany || (existingSigners?.length || 0) < (companyReq ? 2 : 1);

      const outcome =
        decision.action === "reuse"
          ? sigReq.dispatch_status === "signed" || sigReq.dispatch_status === "completed"
            ? "already_signed"
            : isMissingSigners
              ? "reconciliation_required"
              : "reuse_healthy"
          : "reconciliation_required";

      if (contract.status === "draft" && sigReq.dispatch_status === "pending_signature") {
        await admin
          .from("event_contracts")
          .update({ status: "sent", sent_for_signature_at: sigReq.sent_at || new Date().toISOString() })
          .eq("id", contractId);
      }

      return json(
        {
          success: true,
          dispatchOutcome: outcome,
          message:
            outcome === "already_signed"
              ? "Este contrato já foi assinado por todas as partes."
              : outcome === "reconciliation_required"
                ? "Este contrato já havia sido enviado, mas possui pendências de conciliação de signatários/notificações."
                : "Este contrato já está aguardando assinatura. O documento existente foi reaproveitado.",
          remoteCreated: Boolean(sigReq.external_document_id),
          reconciliationRequired: outcome === "reconciliation_required",
          signatureRequestId: sigReq.id,
          externalDocumentId: sigReq.external_document_id,
          externalAssignmentId: sigReq.external_assignment_id,
          status: sigReq.dispatch_status,
          diagnostic: {
            stage: outcome === "reconciliation_required"
              ? "remote_created_local_reconciliation_required"
              : "idempotent_reuse",
            correlationId,
            assinafyRequestSent: false,
            assinafyDocumentId: sigReq.external_document_id,
            databaseUpdated: false,
          },
        },
        outcome === "reconciliation_required" ? 202 : 200,
        correlationId,
      );
    }

    // Remote document has been confirmed deleted; retire old request preserving IDs for audit,
    // then fall through to create a fresh document/assignment.
    if (decision.action === "recreate") {
      const retireErr = await admin
        .from("contract_signature_requests")
        .update({
          dispatch_status: "obsolete",
          last_error: "Documento remoto ausente na Assinafy. Substituído por nova criação explícita.",
          updated_at: new Date().toISOString(),
          // preserve external_document_id / external_assignment_id for audit — do NOT null them
        })
        .eq("id", sigReq.id);
      if (retireErr.error) throw retireErr.error;
      sigReq = null; // force insert of new row below
    }

    if (["processing", "hash_conflict"].includes(decision.action))
      throw new CreateDocHttpError(
        409,
        decision.action,
        decision.action === "processing"
          ? "Contrato já está sendo processado."
          : "Já existe envio com conteúdo ou estado incompatível; reconcilie antes de reenviar.",
      );
    if (decision.action === "obsolete_failed_without_external_ids") {
      const obsolete = await admin
        .from("contract_signature_requests")
        .update({
          dispatch_status: "obsolete",
          last_error: "Substituído por nova tentativa limpa.",
        })
        .eq("id", sigReq.id)
        .eq("dispatch_status", "failed");
      if (obsolete.error) throw obsolete.error;
      sigReq = null;
    }
    if (!sigReq) {
      const inserted = await admin
        .from("contract_signature_requests")
        .insert({
          event_id: contract.event_id,
          contract_id: contractId,
          contract_version_id: contract.version || 1,
          signature_provider: "assinafy",
          dispatch_status: "idle",
          internal_status: "pending_signature",
          original_file_hash: payload.pdfHash,
        })
        .select()
        .single();
      if (inserted.error || !inserted.data)
        throw inserted.error || new Error("Falha ao criar solicitação local.");
      sigReq = inserted.data;
    } else if (sigReq.dispatch_status === "failed") {
      const retried = await admin
        .from("contract_signature_requests")
        .update({ dispatch_status: "idle", last_error: null })
        .eq("id", sigReq.id)
        .eq("dispatch_status", "failed")
        .select()
        .single();
      if (retried.error || !retried.data)
        throw new CreateDocHttpError(
          409,
          "retry_conflict",
          "Não foi possível preparar nova tentativa.",
        );
      sigReq = retried.data;
    }
    signatureRequestId = sigReq.id;
    const locked = await admin
      .from("contract_signature_requests")
      .update({ dispatch_status: "processing", updated_at: new Date().toISOString() })
      .eq("id", sigReq.id)
      .eq("dispatch_status", "idle")
      .select()
      .single();
    if (locked.error || !locked.data)
      throw new CreateDocHttpError(
        409,
        "dispatch_lock_conflict",
        "Outro envio já está em andamento.",
      );
    provider.documentId = locked.data.external_document_id;
    provider.assignmentId = locked.data.external_assignment_id;

    try {
      if (!provider.documentId) {
        stage = "validating_pdf";
        let bytes: Uint8Array;
        if (payload.pdfBase64) bytes = decodePdfBase64(payload.pdfBase64);
        else {
          const fetched = await fetch(payload.pdfUrl!);
          if (!fetched.ok)
            throw new CreateDocHttpError(
              422,
              "pdf_url_unreadable",
              "Não foi possível baixar o PDF.",
            );
          bytes = new Uint8Array(await fetched.arrayBuffer());
        }
        await validatePdfHash(bytes, payload.pdfHash);
        if (!ASSINAFY_API_KEY || !ASSINAFY_ACCOUNT_ID)
          throw new CreateDocHttpError(
            503,
            "assinafy_not_configured",
            "Serviço de assinatura indisponível.",
          );
        stage = "creating_remote_document";
        provider.called = true;
        // Build human-readable filename: prefer title passed by the frontend, fall back to
        // constructing it from event data. Preserve accents, strip filesystem-illegal chars.
        const buildDocumentFilename = (title?: string): string => {
          if (title) return title.endsWith(".pdf") ? title : `${title}.pdf`;
          const rawName = (contract.event?.event_name || contract.event?.client_name || "Evento").trim();
          const safeName = rawName.replace(/[/\\:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
          const rawDate = (contract.event?.date || "").slice(0, 10);
          const datePart = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
            ? `${rawDate.slice(8, 10)}-${rawDate.slice(5, 7)}-${rawDate.slice(0, 4)}`
            : "";
          const parts = ["Contrato Goat Bar", safeName || "Evento"];
          if (datePart) parts.push(datePart);
          return `${parts.join(" - ")}.pdf`;
        };
        const documentFilename = buildDocumentFilename(payload.documentTitle);
        const uploaded = await uploadDocument(documentFilename, bytes);
        provider.diagnostic = uploaded.diagnostic;
        provider.documentId = uploaded?.data?.id || uploaded?.id || null;
        if (!provider.documentId) throw new Error("API não retornou o ID do documento.");

        stage = "persisting_remote_document_id";
        const persisted = await admin
          .from("contract_signature_requests")
          .update({
            external_document_id: provider.documentId,
            dispatch_status: "processing",
            updated_at: new Date().toISOString(),
          })
          .eq("id", sigReq.id)
          .select("id")
          .single();
        if (persisted.error || !persisted.data)
          throw persisted.error || new Error("ID remoto não pôde ser persistido.");
      }

      const externalSignerIds: Array<{
        role: RequiredSigner["role"];
        externalSignerId: string;
      }> = [];
      for (const party of requiredSigners) {
        stage = `resolving_${party.role}_signer`;
        const local = await admin
          .from("contract_signature_signers")
          .select("id,external_signer_id")
          .eq("signature_request_id", sigReq.id)
          .eq("role", party.role)
          .maybeSingle();
        if (local.error) throw local.error;
        let externalSignerId = local.data?.external_signer_id || null;
        if (!externalSignerId) {
          provider.called = true;
          const found = await findSigner(party.email);
          const created = found?.id ? found : await createSigner(party.name, party.email);
          provider.diagnostic = created?.diagnostic || provider.diagnostic;
          externalSignerId = created?.data?.id || created?.id || null;
          if (!externalSignerId)
            throw new Error(`Assinafy não retornou o signatário ${party.role}.`);
          const signerRow = {
            role: party.role,
            full_name: party.name,
            email: party.email,
            external_signer_id: externalSignerId,
          };
          const saved = local.data
            ? await admin
                .from("contract_signature_signers")
                .update(signerRow)
                .eq("id", local.data.id)
            : await admin
                .from("contract_signature_signers")
                .insert({ signature_request_id: sigReq.id, ...signerRow });
          if (saved.error) throw saved.error;
        }
        externalSignerIds.push({ role: party.role, externalSignerId });
      }
      const assignmentSigners = buildRequiredAssignment(externalSignerIds);

      if (!provider.assignmentId) {
        stage = "creating_remote_assignment";
        provider.called = true;
        const assigned = await createAssignment(provider.documentId!, assignmentSigners);
        provider.diagnostic = assigned?.diagnostic || provider.diagnostic;
        const assignment = assigned?.data || assigned;
        provider.assignmentId = assignment?.id || null;
        if (!provider.assignmentId) throw new Error("API não retornou o ID do Assignment.");
        stage = "persisting_remote_assignment";

        const returnedSigners = Array.isArray(assignment?.signers) ? assignment.signers : [];
        const returnedSigningUrls = Array.isArray(assignment?.signing_urls) ? assignment.signing_urls : [];

        // Atualiza cada signatário com seu link de assinatura individual e status de notificação
        for (const party of requiredSigners) {
          const externalSignerObj = externalSignerIds.find((s) => s.role === party.role);
          const extId = externalSignerObj?.externalSignerId;
          const assignedSigner = returnedSigners.find(
            (s: any) => s.id === extId || s.email?.trim().toLowerCase() === party.email.trim().toLowerCase(),
          );
          const signingUrlObj = returnedSigningUrls.find(
            (u: any) => u.signer_id === extId || u.signer_id === assignedSigner?.id,
          );
          const signerUrl = signingUrlObj?.url || null;
          const isNotified = assignedSigner?.notified !== false;

          await admin
            .from("contract_signature_signers")
            .update({
              signature_url: signerUrl,
              notification_status: isNotified ? "sent" : "pending",
              notified_at: isNotified ? new Date().toISOString() : null,
              status: isNotified ? "sent" : "pending",
              updated_at: new Date().toISOString(),
            })
            .eq("signature_request_id", sigReq.id)
            .eq("role", party.role);
        }

        const clientSigningUrl =
          returnedSigningUrls.find(
            (u: any) => u.signer_id === externalSignerIds.find((s) => s.role === "client")?.externalSignerId,
          )?.url ||
          returnedSigningUrls[0]?.url ||
          assignment?.signature_url ||
          null;

        const anyNotified = returnedSigners.length === 0 || returnedSigners.some((s: any) => s.notified !== false);

        const saved = await admin
          .from("contract_signature_requests")
          .update({
            external_assignment_id: provider.assignmentId,
            signature_url: clientSigningUrl,
            dispatch_status: anyNotified ? "pending_signature" : "assignment_created",
            sent_at: new Date().toISOString(),
          })
          .eq("id", sigReq.id)
          .select("id")
          .single();
        if (saved.error || !saved.data)
          throw saved.error || new Error("Assignment remoto não pôde ser persistido.");

        console.info("[assinafy-create-doc] assignment_created", {
          requestId: correlationId,
          documentId: provider.documentId,
          assignmentId: provider.assignmentId,
          signersSummary: requiredSigners.map((party) => {
            const extId = externalSignerIds.find((s) => s.role === party.role)?.externalSignerId;
            const assignedSigner = returnedSigners.find((s: any) => s.id === extId);
            return {
              role: party.role,
              email: party.email,
              externalSignerId: extId,
              notified: assignedSigner?.notified ?? true,
            };
          }),
        });
      }

      stage = "persisting_contract_status";
      const contractSaved = await admin
        .from("event_contracts")
        .update({ status: "sent", sent_for_signature_at: new Date().toISOString() })
        .eq("id", contractId)
        .select("id")
        .single();
      if (contractSaved.error || !contractSaved.data)
        throw contractSaved.error || new Error("Status do contrato não pôde ser persistido.");
      stage = "complete";
      return json(
        {
          success: true,
          dispatchOutcome: "new_dispatch",
          message: "Contrato enviado para assinatura com sucesso.",
          remoteCreated: true,
          reconciliationRequired: false,
          signatureRequestId: sigReq.id,
          externalDocumentId: provider.documentId,
          externalAssignmentId: provider.assignmentId,
          status: "pending_signature",
          diagnostic: {
            stage,
            correlationId,
            assinafyRequestSent: provider.called,
            assinafyDocumentId: provider.documentId,
            databaseUpdated: true,
            httpStatus: provider.diagnostic?.httpStatus ?? null,
          },
        },
        200,
        correlationId,
      );
    } catch (caught: unknown) {
      const error = caught as { message?: string };
      const remoteCreated = Boolean(provider.documentId);
      const state = remoteCreated
        ? "reconciliation_required"
        : provider.called
          ? "reconciliation_required"
          : "failed";
      await admin
        .from("contract_signature_requests")
        .update({ dispatch_status: state, last_error: String(error?.message || "Falha no envio.") })
        .eq("id", sigReq.id);
      if (remoteCreated) {
        return json(
          {
            success: true,
            remoteCreated: true,
            reconciliationRequired: true,
            message:
              "Documento criado na Assinafy; a persistência local requer reconciliação. Não reenvie.",
            signatureRequestId: sigReq.id,
            externalDocumentId: provider.documentId,
            externalAssignmentId: provider.assignmentId,
            status: "reconciliation_required",
            diagnostic: {
              stage: "remote_created_local_reconciliation_required",
              failedStage: stage,
              correlationId,
              assinafyRequestSent: provider.called,
              assinafyDocumentId: provider.documentId,
              databaseUpdated: false,
              errorMessage: String(error?.message || error),
            },
          },
          202,
          correlationId,
        );
      }
      throw error;
    }
  } catch (caught: unknown) {
    const error = caught as {
      status?: number;
      name?: string;
      message?: string;
      code?: string;
      diagnostic?: Record<string, unknown>;
    };
    const status = Number(error?.status) || (error?.name === "AssinafyApiError" ? 502 : 500);
    const safeMessage =
      status >= 500
        ? error?.name === "AssinafyApiError"
          ? "A Assinafy rejeitou a operação."
          : "Falha interna antes da confirmação de criação remota."
        : error.message;
    console.error("[assinafy-create-doc] failure", {
      stage,
      correlationId,
      contractId,
      signatureRequestId,
      status,
      code: error?.code || (error?.name === "AssinafyApiError" ? "assinafy_upstream_error" : "internal_error"),
      errorMessage: error?.message || String(caught),
      providerCalled: provider.called,
      remoteCreated: Boolean(provider.documentId),
      externalDocumentId: provider.documentId,
      externalAssignmentId: provider.assignmentId,
      upstreamStatus: error?.diagnostic?.httpStatus ?? null,
    });
    return json(
      {
        success: false,
        remoteCreated: Boolean(provider.documentId),
        reconciliationRequired: provider.called,
        message: safeMessage,
        error: safeMessage,
        code:
          error?.code ||
          (error?.name === "AssinafyApiError" ? "assinafy_upstream_error" : "internal_error"),
        requestId: correlationId,
        diagnostic: {
          stage,
          correlationId,
          assinafyRequestSent: provider.called || Boolean(error?.diagnostic?.assinafyRequestSent),
          assinafyDocumentId: provider.documentId,
          internalContractId: contractId,
          internalDocumentId: signatureRequestId,
          databaseUpdated: Boolean(signatureRequestId),
          httpStatus: error?.diagnostic?.httpStatus ?? null,
          timedOut: Boolean(error?.diagnostic?.timedOut),
          technicalError: error?.message || undefined,
        },
      },
      status,
      correlationId,
    );
  }
});
