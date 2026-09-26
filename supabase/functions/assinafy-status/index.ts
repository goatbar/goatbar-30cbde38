import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocumentStatus, downloadArtifact } from "../_shared/assinafy-client.ts";
import { requireContractSignatureAccess } from "../_shared/auth-helper.ts";
import { StatusHttpError, normalizeAssinafyStatus, validateStatusPayload } from "./logic.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let context: Record<string, unknown> = { method: req.method };
  try {
    if (req.method !== "POST") throw new StatusHttpError(405, "method_not_allowed", "Método HTTP inválido. Use POST.");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new StatusHttpError(401, "unauthenticated", "Usuário não autenticado.");

    const auth = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: { user } } = await auth.auth.getUser();
    if (!user) throw new StatusHttpError(401, "unauthenticated", "Usuário não autenticado.");

    let raw: Record<string, unknown>;
    try { raw = await req.json(); } catch { throw new StatusHttpError(400, "invalid_json", "Body JSON inválido."); }
    const input = validateStatusPayload(raw);
    context = { ...context, userId: user.id, receivedFields: Object.keys(raw).sort(), signatureRequestId: input.signatureRequestId, documentId: input.documentId };
    console.info("[assinafy-status] request", context);

    const query = admin.from("contract_signature_requests").select("*").eq("signature_provider", "assinafy");
    const { data: sigReq, error } = input.action === "sync"
      ? await query.eq("id", input.signatureRequestId!).maybeSingle()
      : await query.eq("external_document_id", input.documentId!).maybeSingle();
    if (error) throw new StatusHttpError(500, "database_error", "Falha ao consultar solicitação de assinatura.");
    if (!sigReq) throw new StatusHttpError(404, "signature_request_not_found", "Solicitação de assinatura não encontrada.");

    context = { ...context, contractId: sigReq.contract_id, eventId: sigReq.event_id, requestExists: true, currentStatus: sigReq.dispatch_status, hasExternalDocumentId: Boolean(sigReq.external_document_id) };
    try { await requireContractSignatureAccess(auth, "read", sigReq.contract_id); }
    catch (e) {
      const message = e instanceof Error ? e.message : "Acesso negado";
      if (message.includes("não autenticado")) throw new StatusHttpError(401, "unauthenticated", "Usuário não autenticado.");
      throw new StatusHttpError(403, "forbidden", "Usuário sem acesso ao contrato.");
    }

    if (input.action === "download") {
      const valid = ["original", "certificated", "certificate-page", "bundle"];
      if (!input.artifact || !valid.includes(input.artifact)) throw new StatusHttpError(400, "invalid_artifact", `Artefato inválido. Aceitos: ${valid.join(", ")}`);
      const res = await downloadArtifact(input.documentId!, input.artifact);
      if (!res.buffer) throw new StatusHttpError(502, "invalid_provider_response", "Resposta inválida da Assinafy.");
      return new Response(res.buffer, { headers: { ...corsHeaders, "Content-Type": res.headers?.get("Content-Type") || "application/pdf" } });
    }

    const { data: signers } = await admin.from("contract_signature_signers").select("full_name,email,status,signature_url,notification_status,notified_at,signed_at").eq("signature_request_id", sigReq.id);
    const local = { ...sigReq, externalDocumentId: sigReq.external_document_id, externalAssignmentId: sigReq.external_assignment_id, signers: signers || [] };
    if (!sigReq.external_document_id || ["failed", "remote_document_missing", "canceled"].includes(sigReq.dispatch_status)) return json({ ...local, status: sigReq.dispatch_status });

    let provider;
    try {
      provider = await getDocumentStatus(sigReq.external_document_id, "assignment");
    } catch (e: any) {
      const is404 = e?.providerStatus === 404 || e?.status === 404 || String(e?.message || "").includes("404");
      if (is404) {
        console.info("[assinafy-status] remote_document_missing_404_detected", {
          ...context,
          documentId: sigReq.external_document_id,
        });
        await admin
          .from("contract_signature_requests")
          .update({
            dispatch_status: "remote_document_missing",
            last_error: `Documento remoto ${sigReq.external_document_id} não encontrado na Assinafy (HTTP 404). Sincronizado em ${new Date().toISOString()}.`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sigReq.id);

        return json({
          ...local,
          status: "remote_document_missing",
          dispatch_status: "remote_document_missing",
          upstream_synced: true,
          message: "O documento anterior não existe mais na Assinafy. É necessário gerar um novo envio para assinatura.",
        });
      }

      console.warn("[assinafy-status] provider_unavailable_fallback", {
        ...context,
        endpoint: "get_document_status",
        providerError: e instanceof Error ? e.message : "unknown",
      });
      return json({
        ...local,
        status: sigReq.dispatch_status,
        dispatch_status: sigReq.dispatch_status,
        upstream_synced: false,
        upstream_error: e instanceof Error ? e.message : "unknown",
      });
    }
    const doc = provider.data || provider;
    const remoteAssignment = doc.assignment || doc.assignments?.[0] || null;
    const remoteSigners = Array.isArray(remoteAssignment?.signers)
      ? remoteAssignment.signers
      : Array.isArray(doc.signers)
        ? doc.signers
        : [];

    const localSigners = signers || [];
    const now = new Date().toISOString();

    const isRemoteSigned = (remote: any) => {
      const raw = String(
        remote?.status ||
        remote?.signer_status ||
        remote?.signature_status ||
        "",
      ).toLowerCase();
      return Boolean(
        remote?.signed === true ||
        remote?.signed_at ||
        remote?.completed_at ||
        raw === "signed" ||
        raw === "completed" ||
        raw.includes("assinado")
      );
    };

    for (const localSigner of localSigners) {
      const remoteSigner = remoteSigners.find(
        (remote: any) =>
          remote?.id === localSigner.external_signer_id ||
          (
            remote?.email &&
            localSigner.email &&
            String(remote.email).trim().toLowerCase() === String(localSigner.email).trim().toLowerCase()
          ),
      );

      if (!remoteSigner) continue;

      const signed = isRemoteSigned(remoteSigner);
      const notified =
        remoteSigner?.notified === true ||
        Boolean(remoteSigner?.notified_at) ||
        localSigner.notification_status === "sent";

      const signerPatch: Record<string, unknown> = {
        status: signed ? "signed" : (notified ? "sent" : "pending"),
        notification_status: notified ? "sent" : (localSigner.notification_status || "pending"),
        updated_at: now,
      };
      if (signed && !localSigner.signed_at) signerPatch.signed_at = remoteSigner?.signed_at || remoteSigner?.completed_at || now;
      if (notified && !localSigner.notified_at) signerPatch.notified_at = remoteSigner?.notified_at || now;

      await admin
        .from("contract_signature_signers")
        .update(signerPatch)
        .eq("id", localSigner.id);
    }

    const refreshed = await admin
      .from("contract_signature_signers")
      .select("id,full_name,email,status,signature_url,notification_status,notified_at,signed_at,external_signer_id")
      .eq("signature_request_id", sigReq.id);
    const syncedSigners = refreshed.data || localSigners;
    const signedCount = syncedSigners.filter((s: any) => s.status === "signed" || Boolean(s.signed_at)).length;
    const allSigned = syncedSigners.length > 0 && signedCount === syncedSigners.length;
    const anySigned = signedCount > 0;

    const providerStatus = normalizeAssinafyStatus(doc.status || doc.document_status);
    const status = allSigned
      ? "completed"
      : anySigned
        ? "partially_signed"
        : providerStatus === "signed" || providerStatus === "completed"
          ? "completed"
          : providerStatus === "reconciliation_required"
            ? "pending_signature"
            : providerStatus;

    const requestPatch: Record<string, unknown> = {
      dispatch_status: status,
      internal_status: status === "completed" ? "signed" : "pending_signature",
      last_synced_at: now,
      updated_at: now,
    };
    if (status === "completed") requestPatch.completed_at = sigReq.completed_at || now;

    await admin
      .from("contract_signature_requests")
      .update(requestPatch)
      .eq("id", sigReq.id);

    if (sigReq.document_kind === "contract") {
      await admin
        .from("event_contracts")
        .update(
          status === "completed"
            ? { status: "signed", fully_signed_at: now, updated_at: now }
            : { status: "sent", sent_for_signature_at: sigReq.sent_at || now, updated_at: now },
        )
        .eq("id", sigReq.contract_id);
    }

    return json({
      ...local,
      signers: syncedSigners,
      status,
      dispatch_status: status,
      sent_at: sigReq.sent_at,
      signed_count: signedCount,
      signer_count: syncedSigners.length,
      artifacts: doc.artifacts,
      upstream_synced: true,
    });
  } catch (e) {
    const err = e instanceof StatusHttpError ? e : new StatusHttpError(500, "internal_error", "Erro interno ao consultar assinatura.");
    console.error(`[assinafy-status] ${err.status}`, { ...context, reason: err.code });
    return json({ success: false, error: err.message, code: err.code }, err.status);
  }
});
