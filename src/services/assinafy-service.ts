import { supabase } from "@/integrations/supabase/client";

export interface AssinafyRequestResponse {
  success: boolean;
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
}

export async function formatAssinafyInvokeError(error: unknown): Promise<string> {
  const candidate = error as {
    message?: string;
    context?: Response | { status?: number; json?: () => Promise<unknown>; headers?: Headers };
  };
  const response = candidate?.context;
  const status =
    response && typeof response === "object" && "status" in response ? response.status : undefined;
  let body: { code?: string; message?: string; error?: string; requestId?: string } = {};
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
  const headerRequestId =
    response &&
    typeof response === "object" &&
    "headers" in response &&
    response.headers instanceof Headers
      ? response.headers.get("x-request-id")
      : null;
  const details = [
    status ? `HTTP ${status}` : undefined,
    body.code ? `code: ${body.code}` : undefined,
    `message: ${body.message || body.error || candidate?.message || "Falha desconhecida"}`,
    body.requestId || headerRequestId
      ? `requestId: ${body.requestId || headerRequestId}`
      : undefined,
  ].filter(Boolean);
  return `assinafy-create-doc failed:\n${details.join("\n")}`;
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
    throw new Error(await formatAssinafyInvokeError(error));
  }

  if (!data?.success) {
    throw new Error(data?.error || "Erro desconhecido na criação do documento Assinafy");
  }

  return data as AssinafyRequestResponse;
}

export async function syncAssinafyStatus(contractId: string): Promise<Record<string, unknown>> {
  const { data: request, error: requestError } = await (supabase as any)
    .from("contract_signature_requests")
    .select("id")
    .eq("contract_id", contractId)
    .eq("signature_provider", "assinafy")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (requestError) throw new Error(`Falha ao localizar solicitação: ${requestError.message}`);
  if (!request) return { status: "not_sent", dispatch_status: "idle" };

  const { data, error } = await supabase.functions.invoke(`assinafy-status`, {
    method: "POST",
    body: { action: "sync", signatureRequestId: request.id },
  });

  if (error) {
    throw new Error(`Falha ao invocar assinafy-status: ${error.message}`);
  }

  return data;
}

export async function resendAssinafySignature(
  documentId: string,
  assignmentId: string,
  signerId: string,
): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke("assinafy-resend", {
    body: { documentId, assignmentId, signerId },
  });

  if (error || !data?.success) {
    throw new Error(`Falha ao reenviar assinatura: ${error?.message || data?.error}`);
  }
  return true;
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
