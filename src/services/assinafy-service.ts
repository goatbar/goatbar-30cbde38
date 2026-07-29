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
}

export async function dispatchContractToAssinafy(
  contractId: string,
  pdfBase64?: string,
  pdfUrl?: string,
): Promise<AssinafyRequestResponse> {
  const { data, error } = await supabase.functions.invoke("assinafy-create-doc", {
    body: { contractId, pdfBase64, pdfUrl },
  });

  if (error) {
    throw new Error(`Falha ao invocar assinafy-create-doc: ${error.message}`);
  }

  if (!data?.success) {
    throw new Error(data?.error || "Erro desconhecido na criação do documento Assinafy");
  }

  return data as AssinafyRequestResponse;
}

export async function syncAssinafyStatus(contractId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke(`assinafy-status`, {
    method: "POST",
    body: { action: "sync", contractId },
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
