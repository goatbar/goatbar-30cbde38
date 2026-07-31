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
    if (!sigReq.external_document_id || ["failed", "reconciliation_required", "canceled"].includes(sigReq.dispatch_status)) return json({ ...local, status: sigReq.dispatch_status });

    let provider;
    try { provider = await getDocumentStatus(sigReq.external_document_id); }
    catch (e) {
      console.error("[assinafy-status] provider_error", { ...context, endpoint: "get_document_status", providerError: e instanceof Error ? e.message.replace(/\([^)]*\):.*/, "$1") : "unknown" });
      throw new StatusHttpError(502, "assinafy_upstream_error", "Falha ao consultar status na Assinafy.");
    }
    const doc = provider.data || provider;
    const status = normalizeAssinafyStatus(doc.status || doc.document_status);
    if (status !== sigReq.dispatch_status) await admin.from("contract_signature_requests").update({ dispatch_status: status, internal_status: status === "signed" ? "signed" : "pending_signature", last_synced_at: new Date().toISOString() }).eq("id", sigReq.id);
    return json({ ...local, status, dispatch_status: status, artifacts: doc.artifacts });
  } catch (e) {
    const err = e instanceof StatusHttpError ? e : new StatusHttpError(500, "internal_error", "Erro interno ao consultar assinatura.");
    console.error(`[assinafy-status] ${err.status}`, { ...context, reason: err.code });
    return json({ success: false, error: err.message, code: err.code }, err.status);
  }
});
