import { GoatAIGeminiAgent } from "../agent/gemini-agent.ts";
import { ConversationManager } from "../conversation/manager.ts";
import { AgentAttachment } from "../types.ts";

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
      phoneNumberId: config?.phoneNumberId || Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "",
      accessToken: config?.accessToken || Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "",
      verifyToken: config?.verifyToken || Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN") || "",
    };
  }

  public async sendTextMessage(to: string, text: string): Promise<boolean> {
    if (!this.config.accessToken || !this.config.phoneNumberId) {
      console.warn("WhatsApp credentials not configured; skipped outgoing message.");
      return false;
    }

    const cleanTo = to.replace(/[^0-9]/g, "");
    const url = `https://graph.facebook.com/v20.0/${this.config.phoneNumberId}/messages`;

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

      return res.ok;
    } catch (err) {
      console.error("Erro ao enviar mensagem WhatsApp:", err);
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
    const contactName = entry.contacts?.[0]?.profile?.name || "Sócio";

    // 1. Resolve User
    const convManager = new ConversationManager(this.supabaseAdmin);
    const resolvedUser = await convManager.resolveUserByPhoneNumber(senderPhone);

    if (!resolvedUser || !resolvedUser.authorized) {
      const unauthReply = "Olá! Este número de WhatsApp ainda não está vinculado a uma conta autorizada do Goat Bar. Solicite a liberação de acesso com um dos administradores.";
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
      // Media download helper if access token exists
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

  private async downloadMediaBase64(mediaId: string): Promise<string | null> {
    try {
      const mediaUrlRes = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
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
