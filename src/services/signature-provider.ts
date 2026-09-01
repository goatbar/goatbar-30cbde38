import { supabase } from "@/integrations/supabase/client";
import { dispatchContractToZapSign, getZapSignStatus } from "./zapsign-service";
import {
  dispatchContractToAssinafy,
  syncAssinafyStatus,
  downloadAssinafyArtifact,
  resendAssinafySignature,
  type AssinafyDiagnostic,
} from "./assinafy-service";

export interface SignatureProvider {
  name: string;
  createRequest(payload: {
    contractId: string;
    pdfBase64?: string;
    pdfUrl?: string;
    pdfHash?: string;
    documentTitle?: string;
  }): Promise<{
    success: boolean;
    dispatchOutcome?: "new_dispatch" | "reuse_healthy" | "reuse" | "reconciliation_required" | "already_signed" | "remote_document_missing";
    message?: string;
    externalDocumentId?: string;
    externalAssignmentId?: string;
    status: string;
    signatureUrl?: string;
    diagnostic?: AssinafyDiagnostic;
  }>;

  getSignatureLink(providerDocumentId: string, signerEmail: string): Promise<string>;

  syncStatus(contractId: string): Promise<{
    status: string;
    fullySigned: boolean;
    signedFileUrl?: string;
    artifacts?: Record<string, unknown>;
  }>;

  downloadArtifact(
    providerDocumentId: string,
    artifactName?: string,
  ): Promise<{ fileUrl?: string; blob?: Blob }>;

  resend(
    documentId: string,
    assignmentId: string,
    signerId: string,
  ): Promise<boolean | { success: boolean; activityVerified?: boolean }>;
}

export const zapSignSignatureProvider: SignatureProvider = {
  name: "ZapSign",

  async createRequest(payload) {
    // Para manter compatibilidade de tipo, convertemos a resposta legada
    const res = await dispatchContractToZapSign(
      payload.contractId,
      payload.pdfBase64,
      payload.pdfUrl,
    );
    return {
      success: res.success,
      externalDocumentId: res.externalDocToken,
      status: res.status || "pending",
      signatureUrl: res.docUrl,
    };
  },

  async getSignatureLink(providerDocumentId, signerEmail) {
    const { data } = await (supabase as any)
      .from("contract_signature_requests")
      .select("provider_response")
      .eq("external_request_id", providerDocumentId)
      .eq("signature_provider", "zapsign")
      .maybeSingle();

    const signers =
      ((data?.provider_response as Record<string, unknown>)?.signers as Array<
        Record<string, unknown>
      >) || [];
    const match = signers.find(
      (s) => typeof s.email === "string" && s.email.toLowerCase() === signerEmail.toLowerCase(),
    );
    return (
      (match?.sign_url as string) || `https://app.zapsign.com.br/verificar/${providerDocumentId}`
    );
  },

  async syncStatus(contractId) {
    const res = await getZapSignStatus(contractId);
    const isSigned = res.status === "signed" || res.status === "completed";
    return {
      status: res.status || "pending",
      fullySigned: isSigned,
      signedFileUrl: res.signedFileUrl,
    };
  },

  async downloadArtifact(providerDocumentId, artifactName) {
    const { data } = await (supabase as any)
      .from("contract_signature_requests")
      .select("signed_file_path")
      .eq("external_request_id", providerDocumentId)
      .eq("signature_provider", "zapsign")
      .maybeSingle();

    return { fileUrl: data?.signed_file_path || "" };
  },

  async resend(documentId, assignmentId, signerId) {
    throw new Error("Reenvio não suportado na API legado da ZapSign.");
  },
};

export const assinafySignatureProvider: SignatureProvider = {
  name: "assinafy",

  async createRequest(payload) {
    const res = await dispatchContractToAssinafy(
      payload.contractId,
      payload.pdfBase64,
      payload.pdfUrl,
      payload.pdfHash,
      payload.documentTitle,
    );
    return {
      success: res.success,
      dispatchOutcome: res.dispatchOutcome,
      message: res.message,
      externalDocumentId: res.externalDocumentId,
      externalAssignmentId: res.externalAssignmentId,
      status: res.status || "pending",
      signatureUrl: res.signatureUrl,
      diagnostic: res.diagnostic,
    };
  },

  async getSignatureLink(providerDocumentId, signerEmail) {
    if (!signerEmail) return "";
    const cleanEmail = signerEmail.toLowerCase().trim();
    const { data } = await (supabase as any)
      .from("contract_signature_signers")
      .select("signature_url")
      .ilike("email", cleanEmail)
      .not("signature_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return data?.signature_url || "";
  },

  async syncStatus(contractId) {
    const res = await syncAssinafyStatus(contractId);
    return {
      ...res,
      status: (res.status as string) || "pending",
      fullySigned: res.status === "signed" || res.status === "completed",
      artifacts: (res.artifacts as Record<string, unknown>) || undefined,
    };
  },

  async downloadArtifact(providerDocumentId, artifactName = "original") {
    const blob = await downloadAssinafyArtifact(providerDocumentId, artifactName);
    return { blob };
  },

  async resend(documentId, assignmentId, signerId) {
    return resendAssinafySignature(documentId, assignmentId, signerId);
  },
};

export const getSignatureProvider = (providerName?: string): SignatureProvider => {
  if (providerName === "zapsign") {
    return zapSignSignatureProvider;
  }
  return assinafySignatureProvider;
};
