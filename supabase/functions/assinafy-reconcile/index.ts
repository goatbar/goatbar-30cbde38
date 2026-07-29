import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocumentStatus } from "../_shared/assinafy-client.ts";
import { requireContractSignatureAccess } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Não autorizado. Missing Auth Header");

    const supabaseAuthClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Valida admin antes de prosseguir
    const { user } = await requireContractSignatureAccess(supabaseAuthClient, "reconcile");

    if (req.method !== "POST") throw new Error("Use POST");

    const { action, requestId, externalDocumentId, reason } = await req.json();

    if (!requestId || !reason) throw new Error("requestId e reason são obrigatórios");

    const { data: reqToReconcile, error: fetchErr } = await supabaseAdmin
        .from("contract_signature_requests")
        .select("*")
        .eq("id", requestId)
        .single();
    
    if (fetchErr || !reqToReconcile) throw new Error("Request não encontrado");
    if (reqToReconcile.dispatch_status !== "reconciliation_required") {
        throw new Error("O request não está em modo reconciliation_required");
    }

    if (action === "associate_document") {
        if (!externalDocumentId) throw new Error("externalDocumentId obrigatório para associar");
        
        // Valida na API
        const docRes = await getDocumentStatus(externalDocumentId);
        const docData = docRes.data || docRes;
        
        if (!docData || (!docData.id && !docData.document_status)) {
            throw new Error("Documento não existe na Assinafy com esse ID");
        }

        const newStatus = docData.status || docData.document_status || "pending";

        // Salva auditoria
        await supabaseAdmin.from("contract_signature_reconciliations").insert({
            request_id: requestId,
            admin_user_id: user.id,
            action: action,
            reason: reason,
            previous_status: reqToReconcile.dispatch_status,
            new_status: newStatus,
            associated_external_id: externalDocumentId
        });

        // Atualiza request
        await supabaseAdmin.from("contract_signature_requests").update({
            dispatch_status: newStatus,
            external_document_id: externalDocumentId,
            internal_status: "pending_signature"
        }).eq("id", requestId);

        return new Response(JSON.stringify({ success: true, message: "Associado com sucesso" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } else if (action === "confirm_not_created") {
        
        await supabaseAdmin.from("contract_signature_reconciliations").insert({
            request_id: requestId,
            admin_user_id: user.id,
            action: action,
            reason: reason,
            previous_status: reqToReconcile.dispatch_status,
            new_status: "failed",
            associated_external_id: null
        });

        // Passa de reconciliation_required para failed, permitindo que o frontend crie outro envio limpo
        await supabaseAdmin.from("contract_signature_requests").update({
            dispatch_status: "failed"
        }).eq("id", requestId);

        return new Response(JSON.stringify({ success: true, message: "Confirmado não criado. Pronto para reenvio." }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    throw new Error("Ação de reconciliação inválida");

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
