import { supabase } from "@/integrations/supabase/client";
import {
  AIInboxItem,
  AIActionLog,
  IntegrationStatus,
  UserMessagingAccountItem,
} from "./types";

export const goatAIService = {
  async listInboxItems(filters?: {
    status?: string;
    approvalStatus?: string;
    classification?: string;
    source?: string;
  }): Promise<AIInboxItem[]> {
    let query = (supabase as any)
      .from("ai_inbox_items")
      .select(`
        *,
        events:matched_event_id (
          id,
          client_name,
          event_name,
          date,
          event_location
        )
      `)
      .order("created_at", { ascending: false });

    if (filters?.status && filters.status !== "all") {
      query = query.eq("processing_status", filters.status);
    }
    if (filters?.approvalStatus && filters.approvalStatus !== "all") {
      query = query.eq("approval_status", filters.approvalStatus);
    }
    if (filters?.classification && filters.classification !== "all") {
      query = query.eq("classification", filters.classification);
    }
    if (filters?.source && filters.source !== "all") {
      query = query.eq("source", filters.source);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as AIInboxItem[];
  },

  async getPendingCount(): Promise<number> {
    const { count, error } = await (supabase as any)
      .from("ai_inbox_items")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "pending");

    if (error) {
      console.warn("Erro ao buscar contagem de itens pendentes na Goat AI:", error);
      return 0;
    }
    return count || 0;
  },

  async getItemDetails(id: string): Promise<{
    item: AIInboxItem;
    logs: AIActionLog[];
  }> {
    const { data: item, error: itemError } = await (supabase as any)
      .from("ai_inbox_items")
      .select(`
        *,
        events:matched_event_id (
          id,
          client_name,
          event_name,
          date,
          event_location
        ),
        attachments:ai_inbox_attachments (*)
      `)
      .eq("id", id)
      .single();

    if (itemError) throw itemError;

    const { data: logs, error: logsError } = await (supabase as any)
      .from("ai_action_logs")
      .select("*")
      .eq("ai_inbox_item_id", id)
      .order("created_at", { ascending: false });

    if (logsError) throw logsError;

    return {
      item: item as AIInboxItem,
      logs: (logs || []) as AIActionLog[],
    };
  },

  async createTestInput(payload: {
    raw_text: string;
    source_sender_name?: string;
    source?: "manual" | "whatsapp" | "api";
  }): Promise<AIInboxItem> {
    const { data, error } = await supabase.functions.invoke("goat-ai-process", {
      body: {
        source: payload.source || "manual",
        source_sender_name: payload.source_sender_name || "Sócio / Teste",
        raw_text: payload.raw_text,
        message_type: "text",
      },
    });

    if (error) throw error;
    if (!data?.success || !data?.item) {
      throw new Error(data?.error || "Falha ao processar entrada de teste");
    }
    return data.item as AIInboxItem;
  },

  async reprocessItem(itemId: string): Promise<AIInboxItem> {
    const { data, error } = await supabase.functions.invoke("goat-ai-reprocess", {
      body: { item_id: itemId },
    });

    if (error) throw error;
    if (!data?.success || !data?.item) {
      throw new Error(data?.error || "Falha ao reprocessar item");
    }
    return data.item as AIInboxItem;
  },

  async updateItemInterpretation(
    itemId: string,
    updates: {
      structured_data?: Record<string, any>;
      matched_event_id?: string | null;
      classification?: string;
    }
  ): Promise<AIInboxItem> {
    const { data, error } = await (supabase as any)
      .from("ai_inbox_items")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .select(`
        *,
        events:matched_event_id (
          id,
          client_name,
          event_name,
          date,
          event_location
        )
      `)
      .single();

    if (error) throw error;

    await (supabase as any).from("ai_action_logs").insert({
      ai_inbox_item_id: itemId,
      action: "manual_edit",
      event_id: updates.matched_event_id || null,
      performer_name: "Usuário",
      automatic: false,
      new_data: updates,
    });

    return data as AIInboxItem;
  },

  async approveItem(
    itemId: string,
    options?: {
      override_data?: Record<string, any>;
      event_id?: string;
    }
  ): Promise<{
    success: boolean;
    already_applied?: boolean;
    applied_entity_type?: string;
    applied_entity_id?: string;
  }> {
    const { data, error } = await supabase.functions.invoke("goat-ai-approve", {
      body: {
        item_id: itemId,
        override_data: options?.override_data,
        event_id: options?.event_id,
      },
    });

    if (error) throw error;
    if (!data?.success) {
      throw new Error(data?.error || "Falha ao aprovar item no backend");
    }
    return data;
  },

  async rejectItem(itemId: string, reason?: string): Promise<void> {
    const { error } = await (supabase as any)
      .from("ai_inbox_items")
      .update({
        approval_status: "rejected",
        processing_status: "processed",
        error_message: reason || "Descartado pelo usuário",
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId);

    if (error) throw error;

    await (supabase as any).from("ai_action_logs").insert({
      ai_inbox_item_id: itemId,
      action: "reject_item",
      performer_name: "Usuário",
      automatic: false,
      new_data: { reason: reason || "Descartado pelo usuário" },
    });
  },

  async getIntegrationStatus(): Promise<IntegrationStatus> {
    try {
      const { data, error } = await supabase.functions.invoke("goat-ai-status");
      if (error || !data) {
        return {
          gemini: {
            configured: false,
            model: "gemini-3.6-flash",
            heuristicFallbackAllowed: true,
          },
          whatsapp: {
            configured: false,
            hasVerifyToken: false,
            webhookUrl: `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/whatsapp-webhook`,
          },
          timestamp: new Date().toISOString(),
        };
      }
      return data as IntegrationStatus;
    } catch {
      return {
        gemini: {
          configured: false,
          model: "gemini-3.6-flash",
          heuristicFallbackAllowed: true,
        },
        whatsapp: {
          configured: false,
          hasVerifyToken: false,
          webhookUrl: `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/whatsapp-webhook`,
        },
        timestamp: new Date().toISOString(),
      };
    }
  },

  async listActionLogs(limit = 50): Promise<AIActionLog[]> {
    const { data, error } = await (supabase as any)
      .from("ai_action_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as AIActionLog[];
  },

  async getAttachmentSignedUrl(storagePath: string, expiresIn = 300): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from("ai-inbox-media")
        .createSignedUrl(storagePath, expiresIn);

      if (error || !data?.signedUrl) {
        console.error("Erro ao gerar URL assinada para anexo:", error);
        return null;
      }
      return data.signedUrl;
    } catch (err) {
      console.error("Exceção ao gerar URL assinada:", err);
      return null;
    }
  },

  // Messaging Accounts (WhatsApp Phone -> User linking)
  async listMessagingAccounts(): Promise<UserMessagingAccountItem[]> {
    const { data, error } = await (supabase as any)
      .from("user_messaging_accounts")
      .select(`
        *,
        profile:user_id (
          display_name,
          email
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Erro ao buscar contas de mensageria:", error);
      return [];
    }
    return (data || []) as UserMessagingAccountItem[];
  },

  async createMessagingAccount(payload: {
    user_id: string;
    phone_number: string;
    display_name?: string;
    external_user_id?: string;
    provider?: "whatsapp" | "telegram";
  }): Promise<UserMessagingAccountItem> {
    const cleanPhone = payload.phone_number.replace(/[^0-9+]/g, "");
    const { data, error } = await (supabase as any)
      .from("user_messaging_accounts")
      .upsert({
        user_id: payload.user_id,
        phone_number: cleanPhone,
        display_name: payload.display_name || null,
        external_user_id: payload.external_user_id || cleanPhone.replace("+", ""),
        provider: payload.provider || "whatsapp",
        verified: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "provider,phone_number" })
      .select()
      .single();

    if (error) throw error;
    return data as UserMessagingAccountItem;
  },

  async deleteMessagingAccount(id: string): Promise<void> {
    const { error } = await (supabase as any)
      .from("user_messaging_accounts")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async toggleMessagingAccountVerified(id: string, verified: boolean): Promise<void> {
    const { error } = await (supabase as any)
      .from("user_messaging_accounts")
      .update({ verified, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;
  },
};
