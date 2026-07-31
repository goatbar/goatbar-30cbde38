import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-token",
};

function canonicalStringify(obj: any): string {
    if (obj === null) return "null";
    if (typeof obj !== "object") return JSON.stringify(obj);
    if (Array.isArray(obj)) return "[" + obj.map(canonicalStringify).join(",") + "]";
    const keys = Object.keys(obj).sort();
    return "{" + keys.map(k => JSON.stringify(k) + ":" + canonicalStringify(obj[k])).join(",") + "}";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const expectedToken = Deno.env.get("ASSINAFY_WEBHOOK_TOKEN");
    
    // Verifica header ou query param
    const url = new URL(req.url);
    const providedToken = req.headers.get("x-webhook-token") || url.searchParams.get("token");

    if (expectedToken && providedToken !== expectedToken) {
      return new Response("Unauthorized", { status: 401 });
    }

    const payload = await req.json();
    
    // Tentar extrair ID oficial ou criar deterministico canônico
    let externalEventId = payload.id || payload.event?.id;
    if (!externalEventId) {
        const str = canonicalStringify(payload);
        const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
        externalEventId = encodeHex(hash);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // O id do documento geralmente vem no event.data ou semelhante
    const docId = payload.data?.document?.id || payload.document_id || payload.data?.id; 
    const eventType = payload.event_type || payload.type || payload.event?.type;

    let contractId = null;
    let sigReqId = null;

    if (docId) {
        const { data: sigReq } = await supabaseAdmin
            .from("contract_signature_requests")
            .select("id, contract_id")
            .eq("external_document_id", docId)
            .maybeSingle();
        
        if (sigReq) {
            contractId = sigReq.contract_id;
            sigReqId = sigReq.id;
        }
    }

    // Sanitiza payload antes de inserir
    const safePayload = JSON.parse(JSON.stringify(payload));
    const removeSensitive = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      
      const sensitiveExact = ['email', 'e-mail', 'phone', 'telefone', 'mobile', 'cpf', 'document_number', 'authorization', 'token', 'access_token', 'api_key', 'apikey', 'secret', 'webhook_secret'];
      
      for (const k in obj) {
        const lowerK = k.toLowerCase();
        
        // Se for um campo sensvel conhecido exato
        if (sensitiveExact.includes(lowerK)) {
          obj[k] = '[REDACTED]';
        }
        // Se contiver 'token', 'secret', 'password' mas no for um ID
        else if ((lowerK.includes('token') || lowerK.includes('secret') || lowerK.includes('password')) && !lowerK.includes('id')) {
          obj[k] = '[REDACTED]';
        }
        // Recurso
        else if (typeof obj[k] === 'object') {
          removeSensitive(obj[k]);
        }
      }
    };
    removeSensitive(safePayload);

    // Insert idempotente. O payload sanitizado fica salvo para auditoria
    const { error: insertErr } = await supabaseAdmin
        .from("contract_signature_events")
        .insert({
            external_event_id: externalEventId,
            contract_id: contractId,
            event_type: eventType || "unknown",
            payload: safePayload
        });
    
    if (insertErr && insertErr.code === '23505') { 
        return new Response("Already processed", { status: 200 });
    }

    if (sigReqId && eventType) {
        const finalTypes = ["document.completed", "document.signed", "document_completed", "completed"];
        const failTypes = ["document.declined", "document.canceled", "document_canceled", "declined", "canceled"];
        
        const normType = eventType.toLowerCase();

        let newStatus = null;
        if (finalTypes.some(t => normType.includes(t))) newStatus = "completed";
        else if (failTypes.some(t => normType.includes(t))) newStatus = "cancelled";

        if (newStatus) {
            const { data: curr } = await supabaseAdmin
                .from("contract_signature_requests")
                .select("dispatch_status")
                .eq("id", sigReqId)
                .single();
            
            if (curr) {
                // Impede regressão
                const isCurrentlyFinal = curr.dispatch_status === "completed" || curr.dispatch_status === "signed";
                if (!isCurrentlyFinal || newStatus === "completed") {
                    await supabaseAdmin.from("contract_signature_requests").update({ 
                        dispatch_status: newStatus,
                        internal_status: newStatus === "completed" ? "signed" : "cancelled"
                    }).eq("id", sigReqId);

                    if (contractId) {
                        await supabaseAdmin.from("event_contracts").update({
                            status: newStatus === "completed" ? "signed" : "cancelled",
                            updated_at: new Date().toISOString()
                        }).eq("id", contractId);
                    }
                }
            }
        }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});
