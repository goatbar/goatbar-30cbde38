export class StatusHttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function validateStatusPayload(body: Record<string, unknown>) {
  if (body.action !== "sync" && body.action !== "download") {
    throw new StatusHttpError(400, "invalid_action", "Ação inválida.");
  }
  if (body.action === "sync" && !body.signatureRequestId) {
    throw new StatusHttpError(400, "signature_request_id_required", "signatureRequestId é obrigatório para sync.");
  }
  if (body.action === "download" && !body.documentId) {
    throw new StatusHttpError(400, "document_id_required", "documentId é obrigatório para download.");
  }
  return body as { action: "sync" | "download"; signatureRequestId?: string; documentId?: string; artifact?: string };
}

export function normalizeAssinafyStatus(value?: string) {
  const status = (value || "pending").toLowerCase();
  if (["completed", "signed"].includes(status)) return "signed";
  if (["canceled", "cancelled", "voided", "rejected_by_user"].includes(status)) return "canceled";
  if (["pending", "created", "sent", "processing", "pending_signature"].includes(status)) return "pending_signature";
  return status;
}
