import { cancelDocument } from "../_shared/assinafy-client.ts";

export async function processCancellation(contractId: string, supabaseAdmin: any): Promise<{ success: boolean; status?: string; error?: string }> {
  // Adquire lock mudando para 'canceling'
  const { data: lockedReq, error: lockErr } = await supabaseAdmin
    .from("contract_signature_requests")
    .update({ dispatch_status: "canceling", updated_at: new Date().toISOString() })
    .eq("contract_id", contractId)
    .eq("signature_provider", "assinafy")
    .in("dispatch_status", ["pending_signature", "active", "idle"])
    .select()
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lockErr || !lockedReq) {
    const { data: currentReq } = await supabaseAdmin
      .from("contract_signature_requests")
      .select("dispatch_status")
      .eq("contract_id", contractId)
      .eq("signature_provider", "assinafy")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (currentReq?.dispatch_status === "canceled") {
      return { success: true, status: "canceled" };
    }
    
    return { success: false, error: "Não foi possível iniciar o cancelamento. O envio não está ativo ou há outra operação em andamento." };
  }

  let finalStatus = "canceled";
  let lastError = null;

  try {
    if (lockedReq.external_document_id) {
      await cancelDocument(lockedReq.external_document_id);
    }
  } catch (e: any) {
    if (e.message?.includes("(404)")) {
      finalStatus = "reconciliation_required";
      lastError = "API retornou 404. O documento pode ter sido deletado ou há inconsistência. Reconciliação manual necessária.";
    } else {
      finalStatus = "reconciliation_required";
      lastError = `Falha ao cancelar na Assinafy: ${e.message}`;
    }
  }

  await supabaseAdmin
    .from("contract_signature_requests")
    .update({
      dispatch_status: finalStatus,
      internal_status: finalStatus === "canceled" ? "cancelled" : "pending_signature",
      last_error: lastError,
      cancelled_at: finalStatus === "canceled" ? new Date().toISOString() : null,
    })
    .eq("id", lockedReq.id);

  if (lastError) {
    return { success: false, error: lastError, status: finalStatus };
  }

  return { success: true, status: finalStatus };
}
