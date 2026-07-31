export type DispatchRecord = { id: string; dispatch_status: string; original_file_hash?: string | null; external_document_id?: string | null };

export function decideDispatch(existing: DispatchRecord | null, pdfHash: string) {
  if (existing?.original_file_hash && existing.original_file_hash !== pdfHash) return { action: "hash_conflict" as const, request: existing };
  if (existing && ["pending_signature", "signed", "completed"].includes(existing.dispatch_status)) return { action: "reuse" as const, request: existing };
  if (existing?.dispatch_status === "processing") return { action: "processing" as const, request: existing };
  if (existing?.dispatch_status === "reconciliation_required") return { action: "reconcile" as const, request: existing };
  if (existing?.dispatch_status === "failed") return { action: "retry" as const, request: existing };
  return existing ? { action: "continue" as const, request: existing } : { action: "create" as const, request: null };
}
