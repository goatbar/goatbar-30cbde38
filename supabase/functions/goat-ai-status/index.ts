import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  const whatsappToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const whatsappPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const whatsappVerifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
  const allowHeuristic = Deno.env.get("GOAT_AI_ALLOW_HEURISTIC_FALLBACK") === "true";

  const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;

  const status = {
    gemini: {
      provider: "Google Gemini",
      googleProject: "321790958376",
      configured: Boolean(geminiApiKey && geminiApiKey.length > 5),
      model: Deno.env.get("GEMINI_MODEL") || "gemini-1.5-flash",
      heuristicFallbackAllowed: allowHeuristic,
    },
    whatsapp: {
      configured: Boolean(whatsappToken && whatsappPhoneId),
      hasVerifyToken: Boolean(whatsappVerifyToken),
      webhookUrl,
    },
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(status), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
