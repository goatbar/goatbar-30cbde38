export type SignatureIntegrationState =
  | "not_sent"
  | "sending"
  | "send_failed"
  | "reconciliation_required"
  | "remote_document_missing"
  | "active"
  | "canceling"
  | "canceled"
  | "completed";

export function getSignatureIntegrationState(
  contractStatus: string,
  providerDetails: any
): SignatureIntegrationState {
  if (!providerDetails) {
    if (contractStatus === "signed") return "completed";
    return "not_sent";
  }

  // The latest request status is returned by provider.syncStatus which queries 
  // contract_signature_requests ordered by created_at DESC, id DESC.
  const status = providerDetails.dispatch_status || providerDetails.status;
  
  if (!status || status === "idle") return "not_sent";
  if (status === "processing") return "sending";
  if (status === "canceling") return "canceling";
  if (status === "reconciliation_required") return "reconciliation_required";
  if (status === "remote_document_missing") return "remote_document_missing";
  if (status === "failed") return "send_failed";
  if (status === "canceled" || status === "voided" || status === "rejected_by_user") return "canceled";
  
  // If the status from the provider is signed/completed, or the local contract status is signed
  if (["signed", "completed"].includes(status) || contractStatus === "signed") {
    return "completed";
  }

  // Se não tem external_document_id retornado pelo provider e está pending_signature, é ambíguo
  // Isso indica que houve uma falha de rede/timeout entre o request e a persistência do ID remoto
  if (!providerDetails.externalDocumentId && status === "pending_signature") {
    return "reconciliation_required";
  }

  return "active"; 
}

export function canDeleteOrRegenerateContract(state: SignatureIntegrationState): boolean {
  return ["not_sent", "send_failed", "canceled"].includes(state);
}

export function canCancelContract(state: SignatureIntegrationState): boolean {
  return state === "active";
}
