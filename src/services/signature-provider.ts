import { supabase } from "@/integrations/supabase/client";
import { dispatchContractToZapSign, getZapSignStatus } from "./zapsign-service";

/**
 * Interface genérica para provedores de assinatura digital.
 */
export interface SignatureProvider {
  name: string;
  createDocument(payload: {
    contractId: string;
    pdfBase64?: string;
    pdfUrl?: string;
  }): Promise<{ providerDocumentId: string; status: string; signers?: any[] }>;

  getSignatureLink(providerDocumentId: string, signerEmail: string): Promise<string>;

  syncStatus(contractId: string): Promise<{ status: string; fullySigned: boolean; signedFileUrl?: string }>;

  downloadSigned(providerDocumentId: string): Promise<{ fileUrl: string }>;
}

/**
 * Provedor Oficial ZapSign.
 */
export const zapSignSignatureProvider: SignatureProvider = {
  name: "ZapSign",

  async createDocument(payload) {
    console.log("[ZapSign Provider] Iniciando criação do documento para contractId:", payload.contractId);
    const res = await dispatchContractToZapSign(payload.contractId, payload.pdfBase64, payload.pdfUrl);

    if (!res.success) {
      throw new Error(res.error || "Falha ao disparar contrato para a ZapSign.");
    }

    return {
      providerDocumentId: res.externalDocToken || res.signatureRequestId || "",
      status: res.status || "pending",
      signers: res.signers || [],
    };
  },

  async getSignatureLink(providerDocumentId, signerEmail) {
    const { data } = await (supabase as any)
      .from("contract_signature_requests")
      .select("provider_response")
      .eq("external_request_id", providerDocumentId)
      .maybeSingle();

    const signers = data?.provider_response?.signers || [];
    const match = signers.find((s: any) => s.email?.toLowerCase() === signerEmail.toLowerCase());
    return match?.sign_url || `https://app.zapsign.com.br/verificar/${providerDocumentId}`;
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

  async downloadSigned(providerDocumentId) {
    const { data } = await (supabase as any)
      .from("contract_signature_requests")
      .select("signed_file_path")
      .eq("external_request_id", providerDocumentId)
      .maybeSingle();

    return { fileUrl: data?.signed_file_path || "" };
  },
};


export const getActiveSignatureProvider = (): SignatureProvider => {
  return zapSignSignatureProvider;
};

/**
 * Handler de Webhooks para ZapSign / Provedores de assinatura.
 */
export const handleSignatureWebhook = async (provider: string, payload: any) => {
  console.log(`[Webhook Handler] Evento do provedor ${provider}:`, payload);
  if (provider === "zapsign") {
    const externalId = payload.token || payload.doc_token;
    const eventType = payload.event_type || payload.status;
    const isSigned = eventType === "doc_signed" || eventType === "signed" || eventType === "doc_completed";

    if (externalId) {
      const { data: contract } = await supabase
        .from("event_contracts")
        .select("id, event_id")
        .eq("external_id", externalId)
        .maybeSingle();

      if (contract) {
        await supabase
          .from("event_contracts")
          .update({
            status: isSigned ? "signed" : "sent",
            signed_file_url: payload.signed_file || payload.signed_file_url,
            updated_at: new Date().toISOString(),
          })
          .eq("id", contract.id);

        return { success: true, contractId: contract.id };
      }
    }
  }
  return { success: false };
};

