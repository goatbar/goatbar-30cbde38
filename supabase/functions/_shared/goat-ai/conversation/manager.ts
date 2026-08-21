import {
  AIConversation,
  AIMessage,
  AIPendingAction,
  ConversationChannel,
  MessageType,
  ToolContext,
} from "../types.ts";
import { defaultToolRegistry, GoatAIToolRegistry } from "../tools/registry.ts";

export interface ResolvedUser {
  userId: string;
  name: string;
  email?: string;
  role?: string;
  authorized: boolean;
  externalUserId?: string;
  phoneNumber?: string;
}

export class ConversationManager {
  private supabaseAdmin: any;
  private toolRegistry: GoatAIToolRegistry;

  constructor(supabaseAdmin: any, toolRegistry: GoatAIToolRegistry = defaultToolRegistry) {
    this.supabaseAdmin = supabaseAdmin;
    this.toolRegistry = toolRegistry;
  }

  public async resolveUserByWaIdOrPhone(waId: string, phoneNumber?: string): Promise<ResolvedUser | null> {
    // 1. Primary lookup by external_user_id = wa_id
    if (waId) {
      const { data: accountByWaId } = await this.supabaseAdmin
        .from("user_messaging_accounts")
        .select("user_id, display_name, verified, external_user_id, phone_number")
        .eq("provider", "whatsapp")
        .eq("external_user_id", waId)
        .eq("verified", true)
        .maybeSingle();

      if (accountByWaId) {
        const { data: profile } = await this.supabaseAdmin
          .from("profiles")
          .select("display_name, email")
          .eq("user_id", accountByWaId.user_id)
          .maybeSingle();

        return {
          userId: accountByWaId.user_id,
          name: accountByWaId.display_name || profile?.display_name || "Sócio",
          email: profile?.email,
          role: "socio",
          authorized: true,
          externalUserId: waId,
          phoneNumber: accountByWaId.phone_number,
        };
      }
    }

    // 2. Secondary lookup by exact phone number
    const targetPhone = phoneNumber || waId;
    if (targetPhone) {
      const cleanPhone = targetPhone.replace(/[^0-9+]/g, "");
      const { data: accountByPhone } = await this.supabaseAdmin
        .from("user_messaging_accounts")
        .select("user_id, display_name, verified, external_user_id, phone_number")
        .eq("provider", "whatsapp")
        .or(`phone_number.eq.${cleanPhone},phone_number.eq.+${cleanPhone.replace("+", "")},phone_number.eq.${cleanPhone.replace("+", "")}`)
        .eq("verified", true)
        .maybeSingle();

      if (accountByPhone) {
        // If external_user_id was not yet populated, backfill wa_id for future faster lookups
        if (waId && !accountByPhone.external_user_id) {
          await this.supabaseAdmin
            .from("user_messaging_accounts")
            .update({ external_user_id: waId, updated_at: new Date().toISOString() })
            .eq("id", accountByPhone.id);
        }

        const { data: profile } = await this.supabaseAdmin
          .from("profiles")
          .select("display_name, email")
          .eq("user_id", accountByPhone.user_id)
          .maybeSingle();

        return {
          userId: accountByPhone.user_id,
          name: accountByPhone.display_name || profile?.display_name || "Sócio",
          email: profile?.email,
          role: "socio",
          authorized: true,
          externalUserId: waId,
          phoneNumber: accountByPhone.phone_number,
        };
      }
    }

    return null;
  }

  public async resolveUserByPhoneNumber(phoneNumber: string): Promise<ResolvedUser | null> {
    return this.resolveUserByWaIdOrPhone(phoneNumber, phoneNumber);
  }

  public async getOrCreateConversation(
    channel: ConversationChannel,
    userId?: string | null,
    externalConvId?: string | null,
    title = "Nova conversa"
  ): Promise<AIConversation> {
    if (externalConvId) {
      const { data: existing } = await this.supabaseAdmin
        .from("ai_conversations")
        .select("*")
        .eq("channel", channel)
        .eq("external_conversation_id", externalConvId)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) return existing as AIConversation;
    }

    const { data: created, error } = await this.supabaseAdmin
      .from("ai_conversations")
      .insert({
        user_id: userId || null,
        channel,
        external_conversation_id: externalConvId || null,
        title,
        status: "active",
      })
      .select()
      .single();

    if (error) throw new Error(`Erro ao criar conversa: ${error.message}`);
    return created as AIConversation;
  }

  public async saveMessage(
    conversationId: string,
    role: "user" | "assistant" | "system" | "tool",
    content: string,
    messageType: MessageType = "text",
    attachmentUrl?: string | null,
    externalMessageId?: string | null,
    senderName?: string | null
  ): Promise<AIMessage> {
    if (externalMessageId) {
      const { data: dup } = await this.supabaseAdmin
        .from("ai_messages")
        .select("*")
        .eq("external_message_id", externalMessageId)
        .maybeSingle();

      if (dup) return dup as AIMessage;
    }

    const { data: message, error } = await this.supabaseAdmin
      .from("ai_messages")
      .insert({
        conversation_id: conversationId,
        role,
        content,
        message_type: messageType,
        attachment_url: attachmentUrl || null,
        external_message_id: externalMessageId || null,
        sender_name: senderName || null,
      })
      .select()
      .single();

    if (error) throw new Error(`Erro ao salvar mensagem: ${error.message}`);

    // Touch conversation updated_at
    await this.supabaseAdmin
      .from("ai_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return message as AIMessage;
  }

  public async getRecentMessages(conversationId: string, limit = 12): Promise<AIMessage[]> {
    const { data: messages } = await this.supabaseAdmin
      .from("ai_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return (messages || []).reverse() as AIMessage[];
  }

  public async getActivePendingAction(conversationId: string): Promise<AIPendingAction | null> {
    const { data: pending } = await this.supabaseAdmin
      .from("ai_pending_actions")
      .select("*")
      .eq("conversation_id", conversationId)
      .in("status", ["collecting", "ready_for_confirmation"])
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return (pending as AIPendingAction) || null;
  }

  public async savePendingAction(
    conversationId: string,
    toolName: string,
    args: Record<string, any>,
    missingFields: string[] = [],
    summary?: string,
    status: "collecting" | "ready_for_confirmation" = missingFields.length > 0 ? "collecting" : "ready_for_confirmation"
  ): Promise<AIPendingAction> {
    // Expire older pending actions for this conversation
    await this.supabaseAdmin
      .from("ai_pending_actions")
      .update({ status: "expired" })
      .eq("conversation_id", conversationId)
      .in("status", ["collecting", "ready_for_confirmation"]);

    const { data: created, error } = await this.supabaseAdmin
      .from("ai_pending_actions")
      .insert({
        conversation_id: conversationId,
        tool_name: toolName,
        arguments: args,
        missing_fields: missingFields,
        summary: summary || null,
        status,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Erro ao salvar ação pendente: ${error.message}`);
    return created as AIPendingAction;
  }

  public async updatePendingActionArgs(
    pendingActionId: string,
    newArgs: Record<string, any>,
    missingFields: string[],
    summary?: string
  ): Promise<AIPendingAction> {
    const status = missingFields.length === 0 ? "ready_for_confirmation" : "collecting";

    const { data: updated, error } = await this.supabaseAdmin
      .from("ai_pending_actions")
      .update({
        arguments: newArgs,
        missing_fields: missingFields,
        summary: summary || null,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pendingActionId)
      .select()
      .single();

    if (error) throw new Error(`Erro ao atualizar ação pendente: ${error.message}`);
    return updated as AIPendingAction;
  }

  public async executePendingAction(
    pendingAction: AIPendingAction,
    context: ToolContext
  ): Promise<{ success: boolean; result?: any; error?: string; message?: string }> {
    // Idempotency: protect against duplicate confirmation execution
    if (pendingAction.status === "executed") {
      return {
        success: true,
        data: pendingAction.result,
        message: "Esta ação já foi executada e confirmada anteriormente.",
      };
    }

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const toolResult = await this.toolRegistry.executeTool(
      pendingAction.tool_name,
      pendingAction.arguments,
      context
    );

    await this.supabaseAdmin
      .from("ai_pending_actions")
      .update({
        status: toolResult.success ? "executed" : "collecting",
        execution_id: executionId,
        result: toolResult.data || null,
        error: toolResult.error || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pendingAction.id);

    return toolResult;
  }

  public isConfirmationIntent(text: string): boolean {
    const clean = text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

    const confirmationWords = [
      "sim", "confirmo", "confirma", "pode lancar", "pode gravar", "pode registrar",
      "autorizado", "ok", "correto", "pode ser", "positivo", "lancar", "gravar", "isso", "concordo"
    ];

    return confirmationWords.some((w) => clean === w || clean.startsWith(w + " ") || clean.endsWith(" " + w));
  }

  public isRejectionIntent(text: string): boolean {
    const clean = text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

    const rejectionWords = [
      "nao", "não", "cancelar", "cancela", "esquece", "descarta", "descartar", "errado", "para"
    ];

    return rejectionWords.some((w) => clean === w || clean.startsWith(w + " "));
  }
}
