import { supabase } from "@/integrations/supabase/client";

export interface AssinafyRequestResponse {
  success: boolean;
  dispatchOutcome?: "new_dispatch" | "reuse_healthy" | "reuse" | "reconciliation_required" | "already_signed" | "remote_document_missing";
  signatureRequestId?: string;
  externalDocumentId?: string;
  externalAssignmentId?: string;
  externalSignerId?: string;
  signatureUrl?: string;
  status?: string;
  error?: string;
  code?: string;
  message?: string;
  requestId?: string;
  diagnostic?: AssinafyDiagnostic;
  recreationRequired?: boolean;
}

export interface AssinafyDiagnostic {
  requestStarted: boolean;
  backendReached: boolean;
  assinafyRequestSent: boolean;
  httpStatus: number | null;
  assinafyResponse: unknown;
  errorMessage?: string | null;
  internalContractId?: string;
  internalDocumentId?: string;
  assinafyDocumentId?: string | null;
  databaseUpdated: boolean;
  endpoint?: string;
  method?: string;
  timestamp?: string;
  timedOut?: boolean;
  authenticationRejected?: boolean;
}

export class AssinafyDiagnosticError extends Error {
  constructor(
    message: string,
    public diagnostic?: AssinafyDiagnostic,
  ) {
    super(message);
    this.name = "AssinafyDiagnosticError";
  }
}

type AssinafyErrorBody = {
  code?: string;
  message?: string;
  error?: string;
  requestId?: string;
  diagnostic?: AssinafyDiagnostic;
};

type ParsedInvokeError = {
  status?: number;
  body: AssinafyErrorBody;
  requestId?: string | null;
  message?: string;
};

async function parseInvokeError(error: unknown): Promise<ParsedInvokeError> {
  const candidate = error as {
    message?: string;
    context?: Response | { status?: number; json?: () => Promise<unknown>; headers?: Headers };
  };
  const response = candidate?.context;
  const status =
    response && typeof response === "object" && "status" in response ? response.status : undefined;
  let body: AssinafyErrorBody = {};
  if (
    response &&
    typeof response === "object" &&
    "json" in response &&
    typeof response.json === "function"
  ) {
    try {
      body = (await response.json()) as typeof body;
    } catch {
      /* A resposta pode não ser JSON. */
    }
  }
  const headers =
    response && typeof response === "object" && "headers" in response
      ? response.headers
      : undefined;
  const headerRequestId =
    headers && typeof headers.get === "function" ? headers.get("x-request-id") : null;
  return {
    status,
    body,
    requestId: body.requestId || headerRequestId,
    message: candidate?.message,
  };
}

function formatParsedInvokeError(parsed: ParsedInvokeError): string {
  const details = [
    parsed.status ? `HTTP ${parsed.status}` : undefined,
    parsed.body.code ? `code: ${parsed.body.code}` : undefined,
    `message: ${parsed.body.message || parsed.body.error || parsed.message || "Falha desconhecida"}`,
    parsed.requestId ? `requestId: ${parsed.requestId}` : undefined,
  ].filter(Boolean);
  return `assinafy-create-doc failed:\n${details.join("\n")}`;
}

export async function formatAssinafyInvokeError(error: unknown): Promise<string> {
  return formatParsedInvokeError(await parseInvokeError(error));
}

/** Distinguishes an HTTP response from the Edge Function from a transport failure. */
export async function normalizeAssinafyInvokeError(
  error: unknown,
  contractId: string,
): Promise<{ message: string; diagnostic: AssinafyDiagnostic }> {
  const parsed = await parseInvokeError(error);
  const backendReached = typeof parsed.status === "number";
  const backendDiagnostic = parsed.body.diagnostic;
  return {
    message: formatParsedInvokeError(parsed),
    diagnostic: backendReached
      ? {
          requestStarted: true,
          backendReached: true,
          assinafyRequestSent: Boolean(backendDiagnostic?.assinafyRequestSent),
          httpStatus: parsed.status!,
          assinafyResponse: parsed.body,
          errorMessage:
            parsed.body.message ||
            parsed.body.error ||
            parsed.message ||
            "Edge Function rejeitou a solicitação",
          internalContractId: backendDiagnostic?.internalContractId || contractId,
          internalDocumentId: backendDiagnostic?.internalDocumentId,
          assinafyDocumentId: backendDiagnostic?.assinafyDocumentId ?? null,
          databaseUpdated: Boolean(backendDiagnostic?.databaseUpdated),
          timestamp: backendDiagnostic?.timestamp || new Date().toISOString(),
          timedOut: Boolean(backendDiagnostic?.timedOut),
          authenticationRejected:
            parsed.status === 401 || Boolean(backendDiagnostic?.authenticationRejected),
        }
      : {
          requestStarted: true,
          backendReached: false,
          assinafyRequestSent: false,
          httpStatus: null,
          assinafyResponse: null,
          errorMessage: parsed.message || "Edge Function indisponível",
          internalContractId: contractId,
          assinafyDocumentId: null,
          databaseUpdated: false,
          timestamp: new Date().toISOString(),
          timedOut: false,
          authenticationRejected: false,
        },
  };
}

export async function dispatchContractToAssinafy(
  contractId: string,
  pdfBase64?: string,
  pdfUrl?: string,
  pdfHash?: string,
): Promise<AssinafyRequestResponse> {
  const { data, error } = await supabase.functions.invoke("assinafy-create-doc", {
    body: { contractId, pdfBase64, pdfUrl, pdfHash },
  });

  if (error) {
    const normalized = await normalizeAssinafyInvokeError(error, contractId);
    throw new AssinafyDiagnosticError(normalized.message, normalized.diagnostic);
  }

  // Remote document confirmed missing — not a crash, return structured result so
  // the frontend can show the "Gerar Novo Envio" banner without an error boundary.
  if (data?.dispatchOutcome === "remote_document_missing") {
    return data as AssinafyRequestResponse;
  }

  if (!data?.success) {
    throw new AssinafyDiagnosticError(
      data?.error || "Erro desconhecido na criação do documento Assinafy",
      data?.diagnostic,
    );
  }

  return data as AssinafyRequestResponse;
}

export async function syncAssinafyStatus(contractId: string): Promise<Record<string, unknown>> {
  const { data: request, error: requestError } = await (supabase as any)
    .from("contract_signature_requests")
    .select("id, dispatch_status, external_document_id, external_assignment_id, signature_url")
    .eq("contract_id", contractId)
    .eq("signature_provider", "assinafy")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (requestError) throw new Error(`Falha ao localizar solicitação: ${requestError.message}`);
  if (!request) return { status: "not_sent", dispatch_status: "idle" };

  try {
    const { data, error } = await supabase.functions.invoke(`assinafy-status`, {
      method: "POST",
      body: { action: "sync", signatureRequestId: request.id },
    });

    if (error) {
      console.warn(`[syncAssinafyStatus] Falha ao invocar assinafy-status, usando estado local:`, error);
      return {
        status: request.dispatch_status || "pending",
        dispatch_status: request.dispatch_status || "pending",
        externalDocumentId: request.external_document_id,
        externalAssignmentId: request.external_assignment_id,
        signature_url: request.signature_url,
      };
    }

    return data || { status: request.dispatch_status };
  } catch (err) {
    console.warn(`[syncAssinafyStatus] Erro na sincronização, usando estado local:`, err);
    return {
      status: request.dispatch_status || "pending",
      dispatch_status: request.dispatch_status || "pending",
      externalDocumentId: request.external_document_id,
      externalAssignmentId: request.external_assignment_id,
      signature_url: request.signature_url,
    };
  }
}

export async function estimateAssinafyResendCost(
  documentId: string,
  assignmentId: string,
  signerId: string,
): Promise<{ cost: number; currency: string }> {
  const { data, error } = await supabase.functions.invoke("assinafy-resend", {
    body: { action: "estimate", documentId, assignmentId, signerId },
  });
  if (data?.code === "remote_document_missing") {
    const err = new Error(data.error || "O documento anterior não existe mais na Assinafy. É necessário gerar um novo envio para assinatura.");
    (err as any).code = "remote_document_missing";
    (err as any).recreationRequired = true;
    throw err;
  }
  if (error || !data?.success) {
    throw new Error(`Falha ao estimar custo de reenvio: ${error?.message || data?.error}`);
  }
  return { cost: data.cost ?? 0, currency: data.currency ?? "BRL" };
}

export async function resendAssinafySignature(
  documentId: string,
  assignmentId: string,
  signerId: string,
): Promise<{ success: boolean; activityVerified?: boolean }> {
  const { data, error } = await supabase.functions.invoke("assinafy-resend", {
    body: { action: "resend", documentId, assignmentId, signerId },
  });

  if (data?.code === "remote_document_missing") {
    const err = new Error(data.error || "O documento anterior não existe mais na Assinafy. É necessário gerar um novo envio para assinatura.");
    (err as any).code = "remote_document_missing";
    (err as any).recreationRequired = true;
    throw err;
  }

  if (error || !data?.success) {
    throw new Error(`Falha ao reenviar assinatura: ${error?.message || data?.error}`);
  }
  return { success: true, activityVerified: data.activityVerified };
}

export async function reconcileAssinafySigners(contractId: string): Promise<any[]> {
  const { data: req } = await (supabase as any)
    .from("contract_signature_requests")
    .select("id, external_document_id, external_assignment_id")
    .eq("contract_id", contractId)
    .eq("signature_provider", "assinafy")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!req) throw new Error("Solicitação de assinatura não encontrada para este contrato.");

  const { data: signers, error } = await (supabase as any)
    .from("contract_signature_signers")
    .select("id, role, full_name, email, status, signature_url, notification_status, notified_at, signed_at, external_signer_id")
    .eq("signature_request_id", req.id);

  if (error) throw error;
  return (signers || []).map((s: any) => ({
    ...s,
    signature_url: s.signature_url || (req.external_document_id && s.email ? `https://app.assinafy.com.br/sign/${req.external_document_id}?email=${encodeURIComponent(s.email)}` : null),
    external_document_id: req.external_document_id,
    external_assignment_id: req.external_assignment_id,
  }));
}

export async function downloadAssinafyArtifact(
  documentId: string,
  artifactName: string,
): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke("assinafy-status", {
    method: "POST",
    body: { action: "download", documentId, artifact: artifactName },
  });

  if (error) {
    throw new Error(`Falha ao baixar artefato: ${error.message}`);
  }

  return data as Blob; // Será retornado o binário diretamente
}

export async function cancelAssinafySignature(contractId: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke("assinafy-cancel", {
    body: { contractId },
  });

  if (error || !data?.success) {
    throw new Error(data?.error || "Falha ao cancelar assinatura");
  }
  return true;
}
