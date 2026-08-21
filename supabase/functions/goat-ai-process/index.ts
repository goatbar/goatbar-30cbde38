import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runGoatAIPipeline } from "../_shared/goat-ai/processor.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const {
      source = "manual",
      source_message_id,
      source_conversation_id,
      source_sender_id,
      source_sender_name = "Desenvolvedor / Sócio",
      message_type = "text",
      raw_text,
      transcribed_text,
      performed_by,
    } = body;

    if (!raw_text && !transcribed_text) {
      return new Response(
        JSON.stringify({ error: "Texto da mensagem ou transcrição é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const processedItem = await runGoatAIPipeline(adminClient, {
      source,
      source_message_id,
      source_conversation_id,
      source_sender_id,
      source_sender_name,
      message_type,
      raw_text,
      transcribed_text,
      performed_by,
    });

    return new Response(JSON.stringify({ success: true, item: processedItem }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[goat-ai-process] failure", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
