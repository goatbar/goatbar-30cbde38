import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { WhatsAppChannelAdapter } from "../_shared/goat-ai/channel/whatsapp-adapter.ts";
import { verifyWebhookChallenge, verifyMetaSignature } from "./logic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 1. WhatsApp Webhook Verification Challenge (GET)
  if (req.method === "GET") {
    const expectedToken =
      Deno.env.get("WHATSAPP_VERIFY_TOKEN") ||
      Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN") ||
      "goatbar_verify_token";

    const challenge = verifyWebhookChallenge(url, expectedToken);
    if (challenge) {
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // 2. Incoming WhatsApp Message Event (POST)
  try {
    const rawBody = await req.text();
    const sigHeader = req.headers.get("x-hub-signature-256");
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");

    if (appSecret) {
      const isValid = await verifyMetaSignature(rawBody, sigHeader, appSecret);
      if (!isValid) {
        console.warn("[whatsapp-webhook] Rejeitado: assinatura HMAC inválida.");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = JSON.parse(rawBody || "{}");

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const adapter = new WhatsAppChannelAdapter(supabaseAdmin);
    const result = await adapter.processIncomingWebhook(body);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Erro ao processar webhook do WhatsApp:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
