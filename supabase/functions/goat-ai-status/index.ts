import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  const whatsappToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const whatsappPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "1260902867106927";
  const whatsappWabaId = Deno.env.get("WHATSAPP_BUSINESS_ACCOUNT_ID") || "1056887710436972";
  const whatsappAppId = Deno.env.get("WHATSAPP_APP_ID") || "1369569495292462";
  const whatsappVerifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN");
  const allowHeuristic = Deno.env.get("GOAT_AI_ALLOW_HEURISTIC_FALLBACK") === "true";

  const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;

  let authorizedCount = 0;
  let lastMessageAt: string | null = null;

  try {
    if (supabaseUrl && supabaseServiceKey) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const { count } = await supabaseAdmin
        .from("user_messaging_accounts")
        .select("*", { count: "exact", head: true })
        .eq("provider", "whatsapp")
        .eq("verified", true);

      authorizedCount = count || 0;

      const { data: lastMsg } = await supabaseAdmin
        .from("ai_messages")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastMsg) {
        lastMessageAt = lastMsg.created_at;
      }
    }
  } catch (e) {
    console.warn("Status check query warning:", e);
  }

  const status = {
    gemini: {
      provider: "Google Gemini",
      googleProject: "321790958376",
      model: (Deno.env.get("GEMINI_MODEL")?.includes("1.5") || Deno.env.get("GEMINI_MODEL")?.includes("2.0") || Deno.env.get("GEMINI_MODEL")?.includes("2.5"))
        ? "gemini-3.6-flash"
        : (Deno.env.get("GEMINI_MODEL") || "gemini-3.6-flash"),
    },
    whatsapp: {
      configured: Boolean(whatsappToken && whatsappPhoneId),
      hasVerifyToken: Boolean(whatsappVerifyToken),
      phoneNumberId: whatsappPhoneId,
      businessAccountId: whatsappWabaId,
      appId: whatsappAppId,
      displayPhoneNumber: "+55 31 9207-4076",
      verifiedName: "GIA - Goat Intelligence Assistant",
      webhookUrl,
      authorizedUsersCount: authorizedCount,
      lastMessageAt,
    },
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(status), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
