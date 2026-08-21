import { GoatAIGeminiAgent } from "../agent/gemini-agent.ts";
import { ConversationManager } from "../conversation/manager.ts";
import { AgentAttachment } from "../types.ts";
import {
  getEnv,
  getWhatsAppMessagesUrl,
  getWhatsAppMediaUrl,
} from "../config.ts";

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
}

export class WhatsAppChannelAdapter {
  private config: WhatsAppConfig;
  private supabaseAdmin: any;

  constructor(supabaseAdmin: any, config?: Partial<WhatsAppConfig>) {
    this.supabaseAdmin = supabaseAdmin;
    this.config = {
      phoneNumberId: config?.phoneNumberId || getEnv("WHATSAPP_PHONE_NUMBER_ID"),
      accessToken: config?.accessToken || getEnv("WHATSAPP_ACCESS_TOKEN"),
      verifyToken: config?.verifyToken || getEnv("WHATSAPP_VERIFY_TOKEN") || getEnv("WHATSAPP_WEBHOOK_VERIFY_TOKEN"),
    };
  }

  public async sendTextMessage(to: string, text: string): Promise<boolean> {
    const cleanTo = to.replace(/[^0-9]/g, "");

    if (!this.config.accessToken || !this.config.phoneNumberId) {
      console.warn("[whatsapp-adapter] Credenciais do WhatsApp não configuradas; envio ignorado.", JSON.stringify({
        hasAccessToken: !!this.config.accessToken,
        hasPhoneNumberId: !!this.config.phoneNumberId,
        recipient: cleanTo,
      }));
      return false;
    }

    const url = getWhatsAppMessagesUrl(this.config.phoneNumberId);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanTo,
          type: "text",
          text: { body: text },
        }),
      });

      if (!res.ok) {
        let metaErrorCode: number | string | null = null;
        let metaErrorType: string | null = null;
        let metaErrorMessage: string | null = null;

        try {
          const errorJson = await res.json();
          metaErrorCode = errorJson?.error?.code ?? null;
          metaErrorType = errorJson?.error?.type ?? null;
          metaErrorMessage = errorJson?.error?.message ?? null;
        } catch {
          try {
            metaErrorMessage = (await res.text()).slice(0, 200);
          } catch {
            metaErrorMessage = "Unknown error body";
          }
        }

        console.error("[whatsapp-adapter] Falha ao enviar mensagem Meta Graph API:", JSON.stringify({
          httpStatus: res.status,
          metaErrorCode,
          metaErrorType,
          metaErrorMessage,
          recipient: cleanTo,
        }));

        return false;
      }

      return true;
    } catch (err: any) {
      console.error("[whatsapp-adapter] Exceção de rede ao enviar mensagem WhatsApp:", JSON.stringify({
        error: err?.message || String(err),
        recipient: cleanTo,
      }));
      return false;
    }
  }

  public async markMessageAsRead(messageId: string): Promise<boolean> {
    if (!this.config.accessToken || !this.config.phoneNumberId || !messageId) {
      return false;
    }

    const url = getWhatsAppMessagesUrl(this.config.phoneNumberId);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async processIncomingWebhook(body: any): Promise<{ handled: boolean; reply?: string; reason?: string }> {
    const entry = body?.entry?.[0]?.changes?.[0]?.value;
    if (!entry || !entry.messages || entry.messages.length === 0) {
      return { handled: false, reason: "No messages in webhook payload" };
    }

    const message = entry.messages[0];
    const senderPhone = message.from;
    const messageId = message.id;
    const messageType = message.type || "text";
    const contact = entry.contacts?.[0];
    const waId = contact?.wa_id || senderPhone;
    const contactName = contact?.profile?.name || "Sócio";

    // 1. Resolve User with wa_id priority
    const convManager = new ConversationManager(this.supabaseAdmin);
    const resolvedUser = await convManager.resolveUserByWaIdOrPhone(waId, senderPhone);

    // Structured safe logging for audit and debugging
    console.log("[whatsapp-adapter] Webhook recebido:", JSON.stringify({
      messageId,
      senderPhone,
      waId,
      contactName,
      messageType,
      userFound: !!resolvedUser,
      authorized: !!resolvedUser?.authorized,
      resolvedUserId: resolvedUser?.userId || null,
      resolvedName: resolvedUser?.name || null,
    }));

    if (!resolvedUser || !resolvedUser.authorized) {
      const unauthReply = "Olá! Eu sou a GIA, assistente do Goat Bar. Este número de WhatsApp ainda não está vinculado a uma conta autorizada do Goat Bar. Solicite a liberação de acesso com um dos administradores.";
      await this.sendTextMessage(senderPhone, unauthReply);
      return { handled: true, reply: unauthReply, reason: "Unauthorized phone number" };
    }

    // 2. Extract content and media
    let messageText = "";
    const attachments: AgentAttachment[] = [];

    if (message.type === "text") {
      messageText = message.text?.body || "";
    } else if (message.type === "image") {
      messageText = message.image?.caption || "Foto enviada";
      if (this.config.accessToken && message.image?.id) {
        const mediaBase64 = await this.downloadMediaBase64(message.image.id);
        if (mediaBase64) {
          attachments.push({
            mimeType: message.image.mime_type || "image/jpeg",
            dataBase64: mediaBase64,
          });
        }
      }
    } else if (message.type === "document") {
      messageText = message.document?.caption || message.document?.filename || "Documento enviado";
      if (this.config.accessToken && message.document?.id) {
        const mediaBase64 = await this.downloadMediaBase64(message.document.id);
        if (mediaBase64) {
          attachments.push({
            mimeType: message.document.mime_type || "application/pdf",
            dataBase64: mediaBase64,
            fileName: message.document.filename,
          });
        }
      }
    } else if (message.type === "audio" || message.type === "voice") {
      messageText = "Áudio enviado";
      const audioObj = message.audio || message.voice;
      if (this.config.accessToken && audioObj?.id) {
        const mediaBase64 = await this.downloadMediaBase64(audioObj.id);
        if (mediaBase64) {
          attachments.push({
            mimeType: audioObj.mime_type || "audio/ogg",
            dataBase64: mediaBase64,
          });
        }
      }
    }

    // 3. Process with Gemini Agent
    const agent = new GoatAIGeminiAgent(this.supabaseAdmin);
    const turnResult = await agent.processTurn({
      channel: "whatsapp",
      message: messageText,
      userId: resolvedUser.userId,
      userName: resolvedUser.name || contactName,
      userRole: resolvedUser.role,
      externalMessageId: messageId,
      externalSenderId: senderPhone,
      attachments,
    });

    // 4. Send reply back to WhatsApp
    if (turnResult.reply) {
      await this.sendTextMessage(senderPhone, turnResult.reply);
    }

    return { handled: true, reply: turnResult.reply };
  }

  public async downloadMediaBase64(mediaId: string): Promise<string | null> {
    try {
      const mediaUrlRes = await fetch(getWhatsAppMediaUrl(mediaId), {
        headers: { Authorization: `Bearer ${this.config.accessToken}` },
      });
      if (!mediaUrlRes.ok) return null;
      const mediaData = await mediaUrlRes.json();
      if (!mediaData.url) return null;

      const fileRes = await fetch(mediaData.url, {
        headers: { Authorization: `Bearer ${this.config.accessToken}` },
      });
      if (!fileRes.ok) return null;
      const arrayBuffer = await fileRes.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    } catch (err) {
      console.error("Erro ao baixar mídia do WhatsApp:", err);
      return null;
    }
  }
}
