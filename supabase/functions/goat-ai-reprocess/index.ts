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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Cabeçalho de autorização ausente" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { item_id } = body;

    if (!item_id) {
      return new Response(JSON.stringify({ error: "item_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: existingItem, error: fetchErr } = await adminClient
      .from("ai_inbox_items")
      .select("*")
      .eq("id", item_id)
      .single();

    if (fetchErr || !existingItem) {
      return new Response(JSON.stringify({ error: "Item não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reprocess with preserved original raw text / attachments
    const reprocessed = await runGoatAIPipeline(adminClient, {
      existingItemId: existingItem.id,
      source: existingItem.source,
      source_message_id: existingItem.source_message_id,
      source_conversation_id: existingItem.source_conversation_id,
      source_sender_id: existingItem.source_sender_id,
      source_sender_name: existingItem.source_sender_name,
      message_type: existingItem.message_type,
      raw_text: existingItem.raw_text,
      transcribed_text: existingItem.transcribed_text,
      performed_by: user.id,
    });

    return new Response(JSON.stringify({ success: true, item: reprocessed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[goat-ai-reprocess] failure", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Erro ao reprocessar item" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
