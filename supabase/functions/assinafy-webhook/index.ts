import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  canonicalStringify,
  extractProvidedToken,
  redactSensitive,
  secureTokenMatches,
} from "./logic.ts";
import { archiveAssinafyDocument } from "../_shared/archive-assinafy-document.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-token, x-webhook-secret, authorization",
};
const response = (body: string, status = 200) =>
  new Response(body, { status, headers: corsHeaders });

serve(async (req) => {
  if (req.method === "OPTIONS") return response("ok");
  if (req.method !== "POST") return response("Method Not Allowed", 405);
  const correlationId = crypto.randomUUID();
  try {
    const expectedToken = Deno.env.get("ASSINAFY_WEBHOOK_TOKEN");
    if (!expectedToken) {
      console.error("[assinafy-webhook] configuration_error", { correlationId });
      return response("Webhook unavailable", 503);
    }
    if (!(await secureTokenMatches(extractProvidedToken(req), expectedToken))) {
      console.warn("[assinafy-webhook] authentication_rejected", { correlationId });
      return response("Unauthorized", 401);
    }
    const payload = await req.json();
    const rawEventId = payload.id || payload.event?.id;
    const externalEventId =
      rawEventId ||
      (await crypto.subtle
        .digest("SHA-256", new TextEncoder().encode(canonicalStringify(payload)))
        .then((hash) =>
          Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join(""),
        ));
    const documentId =
      payload.data?.document?.id ||
      payload.document_id ||
      payload.data?.id ||
      payload.object?.document?.id ||
      null;
    const eventType = payload.event_type || payload.type || payload.event?.type || "unknown";
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Processamento rápido no banco (transição de status + insert de pending document)
    const { data, error } = await admin.rpc("process_assinafy_webhook_event", {
      p_external_event_id: String(externalEventId),
      p_event_type: String(eventType),
      p_external_document_id: documentId,
      p_payload: redactSensitive(payload),
      p_request_id: correlationId,
    });
    if (error) throw error;

    // 2. Se for conclusão integral do documento por todos os signatários, agenda o arquivador via EdgeRuntime.waitUntil
    if (["document_completed", "completed"].includes(normType) && documentId) {
      const archivingPromise = (async () => {
        try {
          const { data: docRecord } = await admin
            .from("contract_documents")
            .select("id")
            .eq("external_document_id", documentId)
            .maybeSingle();

          if (docRecord?.id) {
            await archiveAssinafyDocument(admin, docRecord.id);
            console.info("[assinafy-webhook] archiving_completed", { documentId, docRecordId: docRecord.id });
          }
        } catch (archErr: any) {
          console.error("[assinafy-webhook] background_archiving_failed", {
            documentId,
            error: archErr?.message || String(archErr),
          });
        }
      })();

      // Garante que o Supabase Edge Runtime mantém o contexto ativo até a conclusão da promessa
      if (typeof (globalThis as any).EdgeRuntime?.waitUntil === "function") {
        (globalThis as any).EdgeRuntime.waitUntil(archivingPromise);
      }
    }

    console.info("[assinafy-webhook] processed", {
      correlationId,
      eventType,
      documentMatched: data?.reason !== "document_not_found",
      duplicate: Boolean(data?.duplicate),
      processed: Boolean(data?.processed),
    });

    // 3. Retorno imediato HTTP 200 para a Assinafy
    return new Response(JSON.stringify({ received: true, ...data }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "x-request-id": correlationId,
      },
    });
  } catch (error) {
    console.error("[assinafy-webhook] failure", {
      correlationId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return response("Internal Server Error", 500);
  }
});
