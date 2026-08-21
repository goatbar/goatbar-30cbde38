import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { GoatAIGeminiAgent } from "../_shared/goat-ai/agent/gemini-agent.ts";
import { ConversationManager } from "../_shared/goat-ai/conversation/manager.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Optional user identification via auth header
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let userName = "Sócio";

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) {
        userId = user.id;
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("display_name, email")
          .eq("user_id", user.id)
          .maybeSingle();
        userName = profile?.display_name || profile?.email?.split("@")[0] || "Sócio";
      }
    }

    const body = await req.json();
    const action = body.action || "chat";

    if (action === "list_conversations") {
      const { data: convs } = await supabaseAdmin
        .from("ai_conversations")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(30);
      return new Response(JSON.stringify({ success: true, conversations: convs || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_messages") {
      const convManager = new ConversationManager(supabaseAdmin);
      const messages = await convManager.getRecentMessages(body.conversationId, 50);
      return new Response(JSON.stringify({ success: true, messages }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_audit_tool_calls") {
      const { data: calls } = await supabaseAdmin
        .from("ai_tool_calls")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);
      return new Response(JSON.stringify({ success: true, tool_calls: calls || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default chat turn
    const agent = new GoatAIGeminiAgent(supabaseAdmin);
    const turnResult = await agent.processTurn({
      conversationId: body.conversationId,
      message: body.message || "",
      channel: "web",
      userId,
      userName,
      attachments: body.attachments || [],
      pageContext: body.pageContext,
    });

    return new Response(JSON.stringify({ success: true, ...turnResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Erro no processamento da Goat AI Chat:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
