import { supabase } from "@/integrations/supabase/client";

export type TurnStatus = "processing" | "completed" | "partial" | "failed" | "cancelled";

export interface TurnRecord {
  id: string;
  requestId: string;
  conversationId: string;
  userMessageId?: string;
  assistantMessageId?: string;
  status: TurnStatus;
  currentStage: string;
  providerId?: string;
  modelId?: string;
  toolsExecuted: string[];
  reply?: string;
  errorType?: string;
  errorMessage?: string;
  timings?: Record<string, number>;
  startedAt: string;
  completedAt?: string;
  failedAt?: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  message_type: "text" | "image" | "document" | "audio" | "action_prompt" | "action_result";
  attachment_url?: string | null;
  sender_name?: string | null;
  created_at: string;
  turn_id?: string;
  turn_status?: TurnStatus;
  is_error?: boolean;
}

export interface ChatConversation {
  id: string;
  user_id?: string | null;
  channel: "web" | "whatsapp" | "api";
  title: string;
  status: "active" | "archived" | "closed";
  created_at: string;
  updated_at: string;
}

export interface ToolCallAudit {
  id: string;
  conversation_id: string;
  tool_name: string;
  arguments: Record<string, any>;
  result?: any;
  status: "pending" | "running" | "success" | "error" | "rejected";
  error?: string | null;
  duration_ms: number;
  started_at: string;
}

export interface SendMessagePayload {
  conversationId?: string;
  turnId?: string;
  requestId?: string;
  message: string;
  attachments?: Array<{
    mimeType: string;
    dataBase64?: string;
    url?: string;
    fileName?: string;
  }>;
  pageContext?: {
    currentEventId?: string;
    currentPage?: string;
  };
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface SendMessageResponse {
  success: boolean;
  conversationId: string;
  turnId?: string;
  requestId?: string;
  turnStatus?: TurnStatus;
  messageId: string;
  reply: string;
  toolCallsExecuted?: Array<{
    toolName: string;
    arguments: any;
    result: any;
    status: string;
  }>;
  pendingAction?: {
    id: string;
    toolName: string;
    status: string;
    missingFields: string[];
    summary?: string | null;
  } | null;
  timings?: {
    totalMs: number;
    llmMs: number;
    toolsMs: number;
    dbMs: number;
    retriesMs: number;
    failoverMs: number;
  };
  error?: string;
}

export const goatAIChatService = {
  async sendMessage(payload: SendMessagePayload): Promise<SendMessageResponse> {
    const turnId = payload.turnId || `turn_web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const requestId = payload.requestId || `req_web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    console.log(`[GIA:UI] turn_started turnId=${turnId} reqId=${requestId} convId=${payload.conversationId || "new"}`);

    const timeoutMs = payload.timeoutMs || 50000;
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => {
      controller.abort(new Error(`Timeout de transporte (${timeoutMs / 1000}s) aguardando resposta da GIA`));
    }, timeoutMs);

    if (payload.signal) {
      payload.signal.addEventListener("abort", () => controller.abort(payload.signal?.reason));
    }

    try {
      const { data, error } = await supabase.functions.invoke("goat-ai-chat", {
        body: {
          action: "chat",
          turnId,
          requestId,
          conversationId: payload.conversationId,
          message: payload.message,
          attachments: payload.attachments || [],
          pageContext: payload.pageContext,
        },
      });

      if (error) {
        console.warn(`[GIA:UI] transport_error turnId=${turnId} error=${error.message}`);
        throw new Error(error.message || "Erro na comunicação com a GIA");
      }

      console.log(`[GIA:UI] turn_response turnId=${turnId} status=${data?.turnStatus || "completed"} duration=${data?.timings?.totalMs || 0}ms`);
      return data as SendMessageResponse;
    } finally {
      clearTimeout(timeoutTimer);
    }
  },

  async reconcileTurn(turnId: string, conversationId?: string): Promise<TurnRecord | null> {
    console.log(`[GIA:UI] reconcile_turn_request turnId=${turnId} convId=${conversationId || "none"}`);
    try {
      const { data, error } = await supabase.functions.invoke("goat-ai-chat", {
        body: {
          action: "reconcile_turn",
          turnId,
          conversationId,
        },
      });

      if (error || !data?.success) {
        console.warn(`[GIA:UI] reconcile_turn_failed turnId=${turnId} error=${error?.message || "unknown"}`);
        return null;
      }

      const turn = data.turn as TurnRecord | null;
      console.log(`[GIA:UI] reconcile_turn_result turnId=${turnId} found=${data.found} status=${turn?.status || "null"}`);
      return turn;
    } catch (err: any) {
      console.warn(`[GIA:UI] reconcile_turn_exception turnId=${turnId}:`, err);
      return null;
    }
  },

  async listConversations(): Promise<ChatConversation[]> {
    const { data, error } = await supabase.functions.invoke("goat-ai-chat", {
      body: { action: "list_conversations" },
    });

    if (error || !data?.success) {
      // Fallback direct supabase query
      const { data: dbData } = await (supabase as any)
        .from("ai_conversations")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(30);
      return (dbData || []) as ChatConversation[];
    }

    return data.conversations || [];
  },

  async listMessages(conversationId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase.functions.invoke("goat-ai-chat", {
      body: { action: "list_messages", conversationId },
    });

    if (error || !data?.success) {
      const { data: dbData } = await (supabase as any)
        .from("ai_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(50);
      return (dbData || []) as ChatMessage[];
    }

    return data.messages || [];
  },

  async listAuditToolCalls(): Promise<ToolCallAudit[]> {
    const { data, error } = await supabase.functions.invoke("goat-ai-chat", {
      body: { action: "list_audit_tool_calls" },
    });

    if (error || !data?.success) {
      const { data: dbData } = await (supabase as any)
        .from("ai_tool_calls")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);
      return (dbData || []) as ToolCallAudit[];
    }

    return data.tool_calls || [];
  },

  async uploadMedia(file: File): Promise<{ url: string; base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = reader.result as string;
          const base64Data = result.split(",")[1] || result;

          // Also upload to storage bucket if available
          const fileName = `chat_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "")}`;
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from("ai-inbox-media")
            .upload(fileName, file, { contentType: file.type, upsert: true });

          let publicUrl = "";
          if (!uploadErr && uploadData) {
            const { data: urlData } = supabase.storage.from("ai-inbox-media").getPublicUrl(fileName);
            publicUrl = urlData?.publicUrl || "";
          }

          resolve({
            url: publicUrl,
            base64: base64Data,
            mimeType: file.type || "application/octet-stream",
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
};
