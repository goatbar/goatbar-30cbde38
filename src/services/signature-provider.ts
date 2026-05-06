/**
 * Interface genérica para provedores de assinatura digital.
 * Permite que o sistema seja agnóstico ao fornecedor (Clicksign, ZapSign, DocuSign, etc).
 */
export interface SignatureProvider {
  name: string;
  createDocument(payload: {
    name: string;
    fileUrl: string;
    signers: Array<{ name: string; email: string; role: 'client' | 'company' }>;
  }): Promise<{ providerDocumentId: string; status: string }>;
  
  getSignatureLink(providerDocumentId: string, signerEmail: string): Promise<string>;
  
  syncStatus(providerDocumentId: string): Promise<{ status: string; fullySigned: boolean }>;
  
  downloadSigned(providerDocumentId: string): Promise<{ fileUrl: string }>;
}

/**
 * Implementação Mock/Base para desenvolvimento.
 * Esta classe será substituída pela integração real (ex: ClickSignProvider).
 */
export const mockSignatureProvider: SignatureProvider = {
  name: "MockSignature",
  
  async createDocument(payload) {
    console.log("[Signature] Criando documento no provedor:", payload.name);
    return {
      providerDocumentId: `mock_doc_${Date.now()}`,
      status: "pending"
    };
  },

  async getSignatureLink(id, email) {
    return `https://signature-provider.com/sign/${id}?email=${email}`;
  },

  async syncStatus(id) {
    return { status: "sent", fullySigned: false };
  },

  async downloadSigned(id) {
    return { fileUrl: "https://example.com/signed-contract.pdf" };
  }
};

// Hook/Service para obter o provedor ativo baseado em ENV
export const getActiveSignatureProvider = (): SignatureProvider => {
  return mockSignatureProvider;
};

/**
 * Handler de Webhooks para processar retornos de plataformas de assinatura.
 */
export const handleSignatureWebhook = async (provider: string, payload: any) => {
  console.log(`[Webhook] Recebido evento do provedor ${provider}:`, payload);
  
  // Lógica genérica de atualização baseada no providerDocumentId
  let externalId = "";
  let newStatus = "";

  if (provider === "clicksign") {
    externalId = payload.document?.key;
    const eventType = payload.event?.name;
    if (eventType === "finish") newStatus = "signed";
    else if (eventType === "sign") newStatus = "partially_signed";
  }

  if (externalId && newStatus) {
    // 1. Busca o contrato pelo ID externo
    const { data: contract, error: findError } = await supabase
      .from("event_contracts")
      .select("id, event_id")
      .eq("external_id", externalId) // Precisamos adicionar essa coluna
      .single();

    if (contract) {
      // 2. Atualiza o status
      const { error: updateError } = await supabase
        .from("event_contracts")
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", contract.id);
        
      return { success: true, contractId: contract.id };
    }
  }
  
  return { success: false };
};
