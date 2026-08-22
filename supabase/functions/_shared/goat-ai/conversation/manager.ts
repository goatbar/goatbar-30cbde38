import {
  AIConversation,
  AIMessage,
  AIPendingAction,
  ConversationChannel,
  MessageType,
  ToolContext,
} from "../types.ts";
import { defaultToolRegistry, GoatAIToolRegistry } from "../tools/registry.ts";
import {
  getPhoneLookupCandidates,
  arePhoneNumbersEqual,
  sanitizeDigits,
} from "../phone-normalizer.ts";

export interface ResolvedUser {
  userId: string;
  name: string;
  email?: string;
  role?: string;
  authorized: boolean;
  externalUserId?: string;
  phoneNumber?: string;
}

export function maskPhone(phone?: string | null): string {
  if (!phone) return "";
  const digits = sanitizeDigits(phone);
  if (digits.length <= 6) return digits;
  return digits.slice(0, 4) + "*".repeat(Math.max(2, digits.length - 8)) + digits.slice(-4);
}

export class ConversationManager {
  private supabaseAdmin: any;
  private toolRegistry: GoatAIToolRegistry;

  constructor(supabaseAdmin: any, toolRegistry: GoatAIToolRegistry = defaultToolRegistry) {
    this.supabaseAdmin = supabaseAdmin;
    this.toolRegistry = toolRegistry;
  }

  public async resolveUserByWaIdOrPhone(waId?: string, phoneNumber?: string): Promise<ResolvedUser | null> {
    const rawWaId = waId?.trim();
    const cleanWaId = sanitizeDigits(rawWaId);

    // 1. Primary lookup: external_user_id = wa_id exact & verified
    if (rawWaId) {
      const { data: accountByWaId } = await this.supabaseAdmin
        .from("user_messaging_accounts")
        .select("id, user_id, display_name, verified, external_user_id, phone_number")
        .eq("provider", "whatsapp")
        .eq("verified", true)
        .or(`external_user_id.eq.${rawWaId},external_user_id.eq.${cleanWaId || rawWaId}`)
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
          externalUserId: accountByWaId.external_user_id || rawWaId,
          phoneNumber: accountByWaId.phone_number,
        };
      }
    }

    // 2. Secondary lookup: Canonical phone number & Brazilian equivalent variations (indexed query)
    const targetPhone = phoneNumber || rawWaId;
    if (targetPhone) {
      const candidates = Array.from(
        new Set([
          ...getPhoneLookupCandidates(targetPhone),
          ...(rawWaId ? getPhoneLookupCandidates(rawWaId) : []),
        ])
      );

      let matchedAccount: any = null;

      if (candidates.length > 0) {
        const query = this.supabaseAdmin
          .from("user_messaging_accounts")
          .select("id, user_id, display_name, verified, external_user_id, phone_number")
          .eq("provider", "whatsapp")
          .eq("verified", true);

        const { data: accountsByCandidates } = typeof query.in === "function"
          ? await query.in("phone_number", candidates)
          : await query.eq("phone_number", targetPhone || rawWaId);

        if (accountsByCandidates && accountsByCandidates.length > 0) {
          matchedAccount = accountsByCandidates[0];
        }
      }

      if (matchedAccount) {
        // Backfill external_user_id if missing or different, using account.id
        if (rawWaId && matchedAccount.id && matchedAccount.external_user_id !== rawWaId) {
          try {
            await this.supabaseAdmin
              .from("user_messaging_accounts")
              .update({
                external_user_id: rawWaId,
                updated_at: new Date().toISOString(),
              })
              .eq("id", matchedAccount.id);
          } catch (updateErr) {
            console.warn("[ConversationManager] Falha ao realizar backfill de external_user_id:", updateErr);
          }
        }

        const { data: profile } = await this.supabaseAdmin
          .from("profiles")
          .select("display_name, email")
          .eq("user_id", matchedAccount.user_id)
          .maybeSingle();

        return {
          userId: matchedAccount.user_id,
          name: matchedAccount.display_name || profile?.display_name || "Sócio",
          email: profile?.email,
          role: "socio",
          authorized: true,
          externalUserId: rawWaId || matchedAccount.external_user_id,
          phoneNumber: matchedAccount.phone_number,
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
    if (channel === "whatsapp") {
      const rawKey = (externalConvId || "").trim();
      const phoneDigits = sanitizeDigits(rawKey.replace(/^whatsapp:/i, "").replace(/^wa_/i, ""));
      const phoneCandidates = phoneDigits ? getPhoneLookupCandidates(phoneDigits) : [];

      const canonicalPlain = phoneDigits ? (getPhoneLookupCandidates(phoneDigits)[0] ? sanitizeDigits(getPhoneLookupCandidates(phoneDigits)[0]) : phoneDigits) : "";
      const canonicalExternalId = canonicalPlain
        ? `whatsapp:${canonicalPlain}`
        : rawKey.startsWith("whatsapp:")
        ? rawKey
        : rawKey
        ? `whatsapp:${rawKey}`
        : userId
        ? `whatsapp:user_${userId}`
        : null;

      const candidateExternalIds: string[] = [];
      if (canonicalExternalId) candidateExternalIds.push(canonicalExternalId);
      if (rawKey) {
        candidateExternalIds.push(rawKey);
        if (!rawKey.startsWith("whatsapp:")) candidateExternalIds.push(`whatsapp:${rawKey}`);
        if (!rawKey.startsWith("wa_")) candidateExternalIds.push(`wa_${rawKey}`);
      }
      for (const cand of phoneCandidates) {
        const cDigits = sanitizeDigits(cand);
        candidateExternalIds.push(`whatsapp:${cDigits}`);
        candidateExternalIds.push(`whatsapp:${cand}`);
        candidateExternalIds.push(`wa_${cDigits}`);
        candidateExternalIds.push(`wa_${cand}`);
        candidateExternalIds.push(cDigits);
        candidateExternalIds.push(cand);
      }

      const uniqueCandidateIds = Array.from(new Set(candidateExternalIds.filter(Boolean)));

      if (uniqueCandidateIds.length > 0) {
        const baseQuery = this.supabaseAdmin
          .from("ai_conversations")
          .select("*")
          .eq("channel", "whatsapp");

        const queryWithFilter = typeof baseQuery.in === "function"
          ? baseQuery.in("external_conversation_id", uniqueCandidateIds)
          : baseQuery.eq("external_conversation_id", canonicalExternalId);

        const { data: existingByExtId } = await queryWithFilter
          .eq("status", "active")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingByExtId) {
          await this.supabaseAdmin
            .from("ai_conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", existingByExtId.id);

          return existingByExtId as AIConversation;
        }
      }

      if (userId) {
        const { data: existingByUserId } = await this.supabaseAdmin
          .from("ai_conversations")
          .select("*")
          .eq("channel", "whatsapp")
          .eq("user_id", userId)
          .eq("status", "active")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingByUserId) {
          await this.supabaseAdmin
            .from("ai_conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", existingByUserId.id);

          return existingByUserId as AIConversation;
        }
      }

      // Create new WhatsApp conversation with canonical key
      const { data: created, error } = await this.supabaseAdmin
        .from("ai_conversations")
        .insert({
          user_id: userId || null,
          channel: "whatsapp",
          external_conversation_id: canonicalExternalId,
          title,
          status: "active",
        })
        .select()
        .single();

      if (error) throw new Error(`Erro ao criar conversa do WhatsApp: ${error.message}`);
      return created as AIConversation;
    }

    // Web or API channels
    if (externalConvId) {
      // First check by direct conversation UUID or external_conversation_id
      const { data: existing } = await this.supabaseAdmin
        .from("ai_conversations")
        .select("*")
        .eq("channel", channel)
        .eq("external_conversation_id", externalConvId)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        await this.supabaseAdmin
          .from("ai_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        return existing as AIConversation;
      }
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
      .in("status", ["collecting", "ready_for_confirmation", "awaiting_confirmation"])
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
    status: "collecting" | "ready_for_confirmation" | "awaiting_confirmation" = missingFields.length > 0 ? "collecting" : "ready_for_confirmation"
  ): Promise<AIPendingAction> {
    // Expire older pending actions for this conversation
    await this.supabaseAdmin
      .from("ai_pending_actions")
      .update({ status: "expired" })
      .eq("conversation_id", conversationId)
      .in("status", ["collecting", "ready_for_confirmation", "awaiting_confirmation"]);

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
  ): Promise<{ success: boolean; result?: any; data?: any; error?: string; message?: string }> {
    // 1. Idempotency check: already executed
    if (pendingAction.status === "executed") {
      return {
        success: true,
        data: pendingAction.result,
        result: pendingAction.result,
        message: "Esta ação já foi executada e confirmada anteriormente.",
      };
    }

    // 2. Concurrency check: already executing
    if (pendingAction.status === "executing") {
      return {
        success: true,
        data: pendingAction.result,
        result: pendingAction.result,
        message: "Esta ação já está sendo processada no momento.",
      };
    }

    // 3. Atomically transition status from ready_for_confirmation/collecting to 'executing'
    let lockQuery = this.supabaseAdmin
      .from("ai_pending_actions")
      .update({
        status: "executing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", pendingAction.id);

    if (typeof lockQuery.in === "function") {
      lockQuery = lockQuery.in("status", ["ready_for_confirmation", "awaiting_confirmation", "collecting"]);
    }

    let locked: any = null;
    let lockErr: any = null;

    if (typeof lockQuery.select === "function") {
      const lockRes = lockQuery.select();
      if (lockRes && typeof lockRes.maybeSingle === "function") {
        const singleRes = await lockRes.maybeSingle();
        locked = singleRes?.data;
        lockErr = singleRes?.error;
      } else {
        const res = await lockRes;
        locked = res?.data;
        lockErr = res?.error;
      }
    } else {
      const lockRes = await lockQuery;
      locked = lockRes?.data || true;
      lockErr = lockRes?.error;
    }

    if (lockErr || !locked) {
      // Concurrency conflict: query latest status
      const builder = this.supabaseAdmin.from("ai_pending_actions");
      if (typeof builder.select === "function") {
        const { data: current } = await builder
          .select("*")
          .eq("id", pendingAction.id)
          .maybeSingle();

        if (current?.status === "executed" || current?.status === "completed") {
          return {
            success: true,
            data: current.result,
            result: current.result,
            message: "Esta ação já foi executada e confirmada anteriormente.",
          };
        }

        if (current?.status === "executing") {
          return {
            success: true,
            message: "Esta ação já está sendo processada no momento.",
          };
        }
      }
    }

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      // Execute tool EXCLUSIVELY with the stored structured arguments
      const toolResult = await this.toolRegistry.executeTool(
        pendingAction.tool_name,
        pendingAction.arguments,
        context
      );

      if (toolResult.success) {
        await this.supabaseAdmin
          .from("ai_pending_actions")
          .update({
            status: "executed",
            execution_id: executionId,
            result: toolResult.data || null,
            error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", pendingAction.id);

        return toolResult;
      } else {
        // Recoverable state: revert to ready_for_confirmation so the user can fix/retry
        await this.supabaseAdmin
          .from("ai_pending_actions")
          .update({
            status: "ready_for_confirmation",
            error: toolResult.error || "Erro na execução",
            updated_at: new Date().toISOString(),
          })
          .eq("id", pendingAction.id);

        return toolResult;
      }
    } catch (execErr: any) {
      const errorMsg = execErr?.message || String(execErr);
      await this.supabaseAdmin
        .from("ai_pending_actions")
        .update({
          status: "ready_for_confirmation",
          error: errorMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pendingAction.id);

      return {
        success: false,
        error: errorMsg,
        message: `Falha ao executar ação: ${errorMsg}`,
      };
    }
  }

  public isConfirmationIntent(text: string): boolean {
    if (!text || typeof text !== "string") return false;
    const clean = text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .trim();

    if (!clean) return false;

    // Single-token exact matches
    if (clean === "s" || clean === "sim" || clean === "ok" || clean === "k" || clean === "y") return true;

    // Multi-token exact or prefixed confirmation phrases
    const confirmationPhrases = [
      "pode sim",
      "pode lancar",
      "pode gravar",
      "pode registrar",
      "pode cadastrar",
      "pode prosseguir",
      "pode mandar",
      "pode ser",
      "pode ir",
      "isso mesmo",
      "isso ai",
      "manda bala",
      "manda ver",
      "manda ai",
      "com certeza",
      "tudo certo",
      "esta certo",
      "ta certo",
      "esta correto",
      "ta correto",
      "sim por favor",
      "sim pode",
      "sim confirmo",
      "sim pode lancar",
      "pode lancar por favor",
      "isso pode lancar",
    ];

    if (
      confirmationPhrases.some(
        (phrase) =>
          clean === phrase ||
          clean.startsWith(phrase + " ") ||
          clean.endsWith(" " + phrase) ||
          clean.includes(" " + phrase + " ")
      )
    ) {
      return true;
    }

    const tokens = clean.split(/\s+/).filter(Boolean);
    const confirmationWords = new Set([
      "sim", "confirmo", "confirma", "confirmado", "confirmar",
      "autorizado", "autorizo", "autoriza", "autorizar",
      "ok", "correto", "positivo", "lancar", "gravar",
      "isso", "concordo", "pode", "prosseguir", "prossiga",
      "manda", "mande", "bora", "fechado", "cadastrar", "executa", "executar", "dale"
    ]);

    // Check if short utterance starts with or contains standalone confirmation tokens without negations
    if (tokens.length <= 4) {
      const hasNegation = tokens.some((t) => t === "nao" || t === "nunca" || t === "nem");
      if (!hasNegation && tokens.some((t) => confirmationWords.has(t) || t === "s")) {
        return true;
      }
    }

    return false;
  }

  public isRejectionIntent(text: string): boolean {
    if (!text || typeof text !== "string") return false;
    const clean = text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .trim();

    if (!clean) return false;

    if (clean === "n" || clean === "nao" || clean === "no") return true;

    const rejectionPhrases = [
      "nao lanca",
      "nao lancar",
      "nao grava",
      "nao gravar",
      "nao registra",
      "nao registrar",
      "nao pode",
      "nao precisa",
      "nao quero",
      "deixa quieto",
      "deixa pra la",
      "deixa para la",
      "cancela isso",
      "cancela por favor",
      "nao lanca nao",
    ];

    if (
      rejectionPhrases.some(
        (phrase) =>
          clean === phrase ||
          clean.startsWith(phrase + " ") ||
          clean.endsWith(" " + phrase) ||
          clean.includes(" " + phrase + " ")
      )
    ) {
      return true;
    }

    const tokens = clean.split(/\s+/).filter(Boolean);
    const rejectionWords = new Set([
      "nao", "cancelar", "cancela", "cancelado", "esquece", "esqueca",
      "descarta", "descartar", "descarte", "descartado",
      "errado", "para", "pare", "parar", "deixa", "abortar", "aborta"
    ]);

    if (tokens.length <= 4) {
      if (tokens.some((t) => rejectionWords.has(t) || t === "n")) {
        return true;
      }
    }

    return false;
  }
}

