import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { GoatAIGeminiAgent } from "../_shared/goat-ai/agent/gemini-agent.ts";
import { ConversationManager } from "../_shared/goat-ai/conversation/manager.ts";

const ALLOWED_ORIGINS = [
  "https://www.goatbar.com.br",
  "https://goatbar.com.br",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:3000",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

serve(async (req) => {
  const origin = req.headers.get("origin") || "none";
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    console.log(`[GOAT-AI-CHAT] method=OPTIONS origin=${origin} stage=preflight status=200`);
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const correlationId = `web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Resolve user if Authorization header is present
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let userName = "Sócio";
    let userRole = "socio";

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      try {
        const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
        if (user && !authErr) {
          userId = user.id;
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("display_name, email, role")
            .eq("user_id", user.id)
            .maybeSingle();
          userName = profile?.display_name || profile?.email?.split("@")[0] || "Sócio";
          userRole = profile?.role || "socio";
        }
      } catch (authErr) {
        console.warn(`[GOAT-AI-CHAT] correlationId=${correlationId} stage=auth_warning error=${String(authErr)}`);
      }
    }

    console.log(`[GOAT-AI-CHAT] correlationId=${correlationId} method=${req.method} origin=${origin} stage=auth_resolved userId=${userId || "anonymous"} userName=${userName}`);

    const body = await req.json();
    const action = body.action || "chat";

    if (action === "list_conversations") {
      const { data: convs, error: cErr } = await supabaseAdmin
        .from("ai_conversations")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(30);

      if (cErr) {
        throw new Error(`Erro ao listar conversas: ${cErr.message}`);
      }

      return new Response(JSON.stringify({ success: true, conversations: convs || [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_messages") {
      const convManager = new ConversationManager(supabaseAdmin);
      const messages = await convManager.getRecentMessages(body.conversationId, 50);
      return new Response(JSON.stringify({ success: true, messages }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_audit_tool_calls") {
      const { data: calls, error: aErr } = await supabaseAdmin
        .from("ai_tool_calls")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);

      if (aErr) {
        throw new Error(`Erro ao listar auditoria de ferramentas: ${aErr.message}`);
      }

      return new Response(JSON.stringify({ success: true, tool_calls: calls || [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default chat turn
    console.log(`[GOAT-AI-CHAT] correlationId=${correlationId} stage=process_turn conversationId=${body.conversationId || "new"} messageLength=${body.message?.length || 0}`);

    const agent = new GoatAIGeminiAgent(supabaseAdmin);
    const turnResult = await agent.processTurn({
      correlationId,
      conversationId: body.conversationId,
      message: body.message || "",
      channel: "web",
      userId,
      userName,
      userRole,
      attachments: body.attachments || [],
      pageContext: body.pageContext,
    });

    console.log(`[GOAT-AI-CHAT] correlationId=${correlationId} stage=agent_complete conversationId=${turnResult.conversationId} toolsCount=${turnResult.toolCallsExecuted?.length || 0}`);

    return new Response(JSON.stringify({ success: true, ...turnResult }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[GOAT-AI-CHAT] Erro no processamento:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
