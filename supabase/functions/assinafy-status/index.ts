import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocumentStatus, downloadArtifact } from "../_shared/assinafy-client.ts";
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

    if (req.method !== "POST") throw new Error("Método HTTP inválido. Use POST.");

    const { action, contractId, documentId, artifact } = await req.json();

    if (action === "sync") {
        if (!contractId) throw new Error("contractId obrigatório para sync");
        await requireContractSignatureAccess(supabaseAuthClient, "read", contractId);

        const { data: sigReq } = await supabaseAdmin.from("contract_signature_requests")
            .select("*").eq("contract_id", contractId).eq("signature_provider", "assinafy").order("created_at", { ascending: false }).limit(1).single();

        if (!sigReq || !sigReq.external_document_id) {
            return new Response(JSON.stringify({ status: "pending" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});
        }

        const res = await getDocumentStatus(sigReq.external_document_id);
        const docData = res.data || res;

        const apiStatus = docData.status || docData.document_status || "pending";
        if (apiStatus !== sigReq.dispatch_status) {
            await supabaseAdmin.from("contract_signature_requests").update({ 
                dispatch_status: apiStatus,
                internal_status: (apiStatus === "completed" || apiStatus === "signed") ? "signed" : "pending_signature"
            }).eq("id", sigReq.id);
        }

        return new Response(JSON.stringify({ status: apiStatus, artifacts: docData.artifacts }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else if (action === "download") {
        if (!documentId) throw new Error("documentId obrigatório para download");

        const { data: sigReq } = await supabaseAdmin.from("contract_signature_requests")
            .select("id, contract_id").eq("external_document_id", documentId).eq("signature_provider", "assinafy").maybeSingle();
            
        if (!sigReq) throw new Error("Documento não encontrado");

        await requireContractSignatureAccess(supabaseAuthClient, "read", sigReq.contract_id);

        const validArtifacts = ["original", "certificated", "certificate-page", "bundle"];
        if (!validArtifacts.includes(artifact)) {
            throw new Error(`Artefato inválido. Aceitos: ${validArtifacts.join(', ')}`);
        }

        const res = await downloadArtifact(documentId, artifact);
        if (!res.buffer) throw new Error("Resposta da API não conteve buffer binário");

        const contentType = res.headers?.get("Content-Type") || "application/pdf";
        const contentDisposition = res.headers?.get("Content-Disposition") || `attachment; filename="${artifact}.pdf"`;

        return new Response(res.buffer, {
            headers: {
                ...corsHeaders,
                "Content-Type": contentType,
                "Content-Disposition": contentDisposition
            }
        });
    }

    throw new Error("Ação inválida");

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
