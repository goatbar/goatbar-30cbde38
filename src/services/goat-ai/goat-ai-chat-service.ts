import { supabase } from "@/integrations/supabase/client";

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  message_type: "text" | "image" | "document" | "audio" | "action_prompt" | "action_result";
  attachment_url?: string | null;
  sender_name?: string | null;
  created_at: string;
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
}

export interface SendMessageResponse {
  success: boolean;
  conversationId: string;
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
  error?: string;
}

export const goatAIChatService = {
  async sendMessage(payload: SendMessagePayload): Promise<SendMessageResponse> {
    const { data, error } = await supabase.functions.invoke("goat-ai-chat", {
      body: {
        action: "chat",
        conversationId: payload.conversationId,
        message: payload.message,
        attachments: payload.attachments || [],
        pageContext: payload.pageContext,
      },
    });

    if (error) {
      throw new Error(error.message || "Erro na comunicação com a GIA");
    }

    return data as SendMessageResponse;
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
