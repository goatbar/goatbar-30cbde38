import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  verifyWebhookChallenge,
  verifyMetaSignature,
  parseWhatsAppPayload,
} from "./logic.ts";
import { runGoatAIPipeline } from "../_shared/goat-ai/processor.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // 1. WhatsApp GET Verification (Meta Challenge)
  if (req.method === "GET") {
    const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "goatbar_verify_token";
    const challenge = verifyWebhookChallenge(url, verifyToken);

    if (challenge) {
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // 2. WhatsApp POST Events
  if (req.method === "POST") {
    try {
      const rawBody = await req.text();
      const signatureHeader = req.headers.get("x-hub-signature-256");
      const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");

      const isValidSignature = await verifyMetaSignature(rawBody, signatureHeader, appSecret);
      if (!isValidSignature) {
        console.warn("[whatsapp-webhook] Invalid Meta signature");
        return new Response("Invalid signature", { status: 401 });
      }

      let payload: any;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }

      const messages = parseWhatsAppPayload(payload);
      if (messages.length === 0) {
        return new Response(JSON.stringify({ received: true, count: 0 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const adminClient = createClient(supabaseUrl, serviceRoleKey);

      const processedResults = [];

      for (const msg of messages) {
        // Idempotency check
        const { data: existing } = await adminClient
          .from("ai_inbox_items")
          .select("id, processing_status, approval_status")
          .eq("source", "whatsapp")
          .eq("source_message_id", msg.messageId)
          .maybeSingle();

        if (existing) {
          console.info("[whatsapp-webhook] Duplicate message ignored", { messageId: msg.messageId });
          processedResults.push({ messageId: msg.messageId, status: "duplicate", id: existing.id });
          continue;
        }

        // Process message through central pipeline
        const result = await runGoatAIPipeline(adminClient, {
          source: "whatsapp",
          source_message_id: msg.messageId,
          source_sender_id: msg.senderPhone,
          source_sender_name: msg.senderName,
          message_type: msg.type,
          raw_text: msg.text || `[Mídia recebida: ${msg.type}]`,
        });

        processedResults.push({ messageId: msg.messageId, status: "processed", id: result.id });
      }

      return new Response(JSON.stringify({ received: true, results: processedResults }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err: any) {
      console.error("[whatsapp-webhook] Error processing webhook", err);
      return new Response(JSON.stringify({ error: err?.message || "Internal server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
