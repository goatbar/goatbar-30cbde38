import { cancelDocument } from "../_shared/assinafy-client.ts";

const CANCELABLE_STATUSES = [
  "pending_signature",
  "partially_signed",
  "assignment_created",
  "active",
  "idle",
];

/**
 * O cancelamento só libera a regeneração depois da confirmação remota.
 * Preserva a solicitação e os IDs da Assinafy para auditoria.
 */
export async function processCancellation(
  contractId: string,
  supabaseAdmin: any,
): Promise<{ success: boolean; status?: string; error?: string }> {
  const { data: contract, error: contractError } = await supabaseAdmin
    .from("event_contracts")
    .select("id, status, signed_file_url, signature_certificate_url, fully_signed_at")
    .eq("id", contractId)
    .maybeSingle();

  if (contractError || !contract) {
    return { success: false, error: "Contrato não encontrado para cancelamento." };
  }
  if (
    contract.status === "signed" ||
    contract.signed_file_url ||
    contract.signature_certificate_url ||
    contract.fully_signed_at
  ) {
    return {
      success: false,
      error: "O contrato já está assinado. Para alterações, utilize um Termo Aditivo.",
    };
  }

  const restoreDraft = async () => {
    const { data, error } = await supabaseAdmin
      .from("event_contracts")
      .update({
        status: "draft",
        sent_for_signature_at: null,
        provider_document_id: null,
        legal_snapshot: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contractId)
      .in("status", ["sent", "draft"])
      .is("fully_signed_at", null)
      .is("signed_file_url", null)
      .is("signature_certificate_url", null)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return "O envio foi cancelado na Assinafy, mas não foi possível liberar o rascunho no sistema. Tente novamente para reconciliar.";
    }
    return null;
  };

  const { data: currentReq, error: requestError } = await supabaseAdmin
    .from("contract_signature_requests")
    .select("*")
    .eq("contract_id", contractId)
    .eq("signature_provider", "assinafy")
    .eq("document_kind", "contract")
    .is("addendum_id", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (requestError || !currentReq) {
    return { success: false, error: "Solicitação de assinatura não encontrada." };
  }

  // Retentativa idempotente: a API já cancelou, mas o contrato local ainda
  // pode estar com status antigo em razão de erro de rede ou de banco.
  if (currentReq.dispatch_status === "canceled") {
    const restoreError = await restoreDraft();
    return restoreError
      ? { success: false, status: "canceled", error: restoreError }
      : { success: true, status: "canceled" };
  }

  if (!CANCELABLE_STATUSES.includes(currentReq.dispatch_status)) {
    return {
      success: false,
      error: "Não é possível cancelar um envio concluído ou com outra operação em andamento.",
    };
  }

  // Lock condicional em UM request, sem update indiscriminado do histórico.
  const { data: lockedReq, error: lockError } = await supabaseAdmin
    .from("contract_signature_requests")
    .update({ dispatch_status: "canceling", updated_at: new Date().toISOString() })
    .eq("id", currentReq.id)
    .in("dispatch_status", CANCELABLE_STATUSES)
    .select("*")
    .maybeSingle();

  if (lockError || !lockedReq) {
    return {
      success: false,
      error: "Cancelamento já em andamento. Atualize o status antes de tentar novamente.",
    };
  }

  try {
    if (lockedReq.external_document_id) {
      await cancelDocument(lockedReq.external_document_id);
    }
  } catch (error: any) {
    const message =
      error?.providerStatus === 404 || error?.message?.includes("404")
        ? "A Assinafy retornou 404. Não foi possível confirmar o cancelamento; é necessária reconciliação."
        : `Falha ao cancelar na Assinafy: ${error?.message || "erro desconhecido"}`;

    await supabaseAdmin
      .from("contract_signature_requests")
      .update({
        dispatch_status: "reconciliation_required",
        internal_status: "pending_signature",
        last_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lockedReq.id);

    return { success: false, status: "reconciliation_required", error: message };
  }

  const { error: saveError } = await supabaseAdmin
    .from("contract_signature_requests")
    .update({
      dispatch_status: "canceled",
      internal_status: "cancelled",
      last_error: null,
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", lockedReq.id);

  if (saveError) {
    return {
      success: false,
      status: "reconciliation_required",
      error: "A Assinafy confirmou o cancelamento, mas o sistema não conseguiu registrar o resultado. Reconciliação necessária.",
    };
  }

  const restoreError = await restoreDraft();
  if (restoreError) {
    return { success: false, status: "canceled", error: restoreError };
  }

  return { success: true, status: "canceled" };
}
