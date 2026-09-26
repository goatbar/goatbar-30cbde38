import { GoatAIGeminiAgent } from "../agent/gemini-agent.ts";
import { ConversationManager } from "../conversation/manager.ts";
import { AgentAttachment } from "../types.ts";
import { formatWhatsAppMessage } from "../formatter.ts";
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

export type WhatsAppSendErrorCategory =
  | "NO_RECIPIENTS"
  | "WHATSAPP_NOT_CONFIGURED"
  | "META_REJECTED"
  | "NETWORK_ERROR"
  | "INVALID_RECIPIENT";

export interface WhatsAppSendResult {
  success: boolean;
  metaMessageId?: string;
  errorCategory?: WhatsAppSendErrorCategory;
  httpStatus?: number;
  metaErrorCode?: number | string;
  metaErrorMessage?: string;
  errorReason?: string;
}

function maskPhone(phone: string): string {
  if (!phone || phone.length <= 6) return phone || "";
  return phone.slice(0, 4) + "*".repeat(Math.max(2, phone.length - 8)) + phone.slice(-4);
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

  public async sendTextMessage(to: string, text: string, correlationId?: string): Promise<boolean> {
    const cleanTo = to.replace(/[^0-9]/g, "");
    const formattedText = formatWhatsAppMessage(text);

    if (!this.config.accessToken || !this.config.phoneNumberId) {
      console.warn(`[GOAT-AI][WHATSAPP][WHATSAPP_SEND_ERROR] correlationId=${correlationId || "none"} status=skipped error="WhatsApp credentials not configured" recipient=${maskPhone(cleanTo)}`);
      return false;
    }

    const url = getWhatsAppMessagesUrl(this.config.phoneNumberId);
    console.log(`[GOAT-AI][WHATSAPP][WHATSAPP_SEND_STARTED] correlationId=${correlationId || "none"} recipient=${maskPhone(cleanTo)} textLength=${formattedText.length}`);

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
          text: { body: formattedText },
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

        console.error(`[GOAT-AI][WHATSAPP][WHATSAPP_SEND_ERROR] correlationId=${correlationId || "none"} success=false httpStatus=${res.status} metaErrorCode=${metaErrorCode} metaErrorType=${metaErrorType} metaErrorMessage=${metaErrorMessage} recipient=${maskPhone(cleanTo)}`);

        return false;
      }

      let metaMessageId: string | null = null;
      try {
        const resJson = await res.json();
        metaMessageId = resJson?.messages?.[0]?.id || null;
      } catch {
        // ignore json parse error on successful send
      }

      console.log(`[GOAT-AI][WHATSAPP][WHATSAPP_SEND_SUCCESS] correlationId=${correlationId || "none"} success=true metaMessageId=${metaMessageId || "none"} recipient=${maskPhone(cleanTo)}`);

      return true;
    } catch (err: any) {
      console.error(`[GOAT-AI][WHATSAPP][WHATSAPP_SEND_ERROR] correlationId=${correlationId || "none"} success=false error="${err?.message || String(err)}" recipient=${maskPhone(cleanTo)}`);
      return false;
    }
  }

  public async sendDocumentMessage(
    to: string,
    documentUrl: string,
    filename: string,
    caption?: string,
    correlationId?: string,
  ): Promise<boolean> {
    const cleanTo = to.replace(/[^0-9]/g, "");
    if (!this.config.accessToken || !this.config.phoneNumberId || !documentUrl) {
      return false;
    }

    const document: Record<string, string> = {
      link: documentUrl,
      filename: filename || "documento.pdf",
    };
    if (caption) {
      document.caption = formatWhatsAppMessage(caption).slice(0, 1024);
    }

    try {
      const res = await fetch(getWhatsAppMessagesUrl(this.config.phoneNumberId), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanTo,
          type: "document",
          document,
        }),
      });

      const responseBody = await res.json().catch(() => ({}));
      const metaId = responseBody?.messages?.[0]?.id || null;
      if (!res.ok || !metaId) {
        console.error(
          `[GOAT-AI][WHATSAPP][DOCUMENT_SEND_ERROR] correlationId=${correlationId || "none"} httpStatus=${res.status} metaError=${responseBody?.error?.message || "unknown"} recipient=${maskPhone(cleanTo)}`,
        );
        return false;
      }

      console.log(
        `[GOAT-AI][WHATSAPP][DOCUMENT_SEND_SUCCESS] correlationId=${correlationId || "none"} metaMessageId=${metaId} recipient=${maskPhone(cleanTo)}`,
      );
      return true;
    } catch (err: any) {
      console.error(
        `[GOAT-AI][WHATSAPP][DOCUMENT_SEND_ERROR] correlationId=${correlationId || "none"} error="${err?.message || String(err)}" recipient=${maskPhone(cleanTo)}`,
      );
      return false;
    }
  }

  public async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string,
    parameters: string[],
    correlationId?: string,
  ): Promise<WhatsAppSendResult> {
    const cleanTo = to.replace(/[^0-9]/g, "");
    if (!this.config.accessToken || !this.config.phoneNumberId) {
      const reason = "WhatsApp credentials not configured (WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID missing)";
      console.warn(`[GOAT-AI][WHATSAPP][WHATSAPP_SEND_ERROR] correlationId=${correlationId || "none"} mechanism=template template=${templateName} status=skipped error="${reason}" recipient=${maskPhone(cleanTo)}`);
      return {
        success: false,
        errorCategory: "WHATSAPP_NOT_CONFIGURED",
        errorReason: reason,
      };
    }

    try {
      const res = await fetch(getWhatsAppMessagesUrl(this.config.phoneNumberId), {
        method: "POST",
        headers: { Authorization: `Bearer ${this.config.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanTo,
          type: "template",
          template: {
            name: templateName,
            language: { code: languageCode },
            components: [{ type: "body", parameters: parameters.map((text) => ({ type: "text", text })) }],
          },
        }),
      });

      const body = await res.json().catch(() => ({}));
      const metaId = body?.messages?.[0]?.id || undefined;
      const metaError = body?.error || {};

      if (!res.ok) {
        const metaErrorCode = metaError.code ?? undefined;
        const metaErrorMessage = String(metaError.message || "Unknown error").slice(0, 300);
        console.error(`[GOAT-AI][WHATSAPP][WHATSAPP_SEND_ERROR] correlationId=${correlationId || "none"} mechanism=template template=${templateName} success=false httpStatus=${res.status} metaErrorCode=${metaErrorCode ?? "none"} metaErrorMessage="${metaErrorMessage}" recipient=${maskPhone(cleanTo)}`);
        return {
          success: false,
          errorCategory: "META_REJECTED",
          httpStatus: res.status,
          metaErrorCode,
          metaErrorMessage,
          errorReason: `Meta rejected: HTTP ${res.status} code=${metaErrorCode ?? "none"} message="${metaErrorMessage}"`,
        };
      }

      if (!metaId) {
        const reason = "Meta returned a successful HTTP status without a messages[0].id acceptance receipt";
        console.error(`[GOAT-AI][WHATSAPP][WHATSAPP_SEND_ERROR] correlationId=${correlationId || "none"} mechanism=template template=${templateName} success=false httpStatus=${res.status} error="${reason}" recipient=${maskPhone(cleanTo)}`);
        return {
          success: false,
          errorCategory: "META_REJECTED",
          httpStatus: res.status,
          metaErrorMessage: reason,
          errorReason: reason,
        };
      }

      console.log(`[GOAT-AI][WHATSAPP][WHATSAPP_SEND_SUCCESS] correlationId=${correlationId || "none"} mechanism=template template=${templateName} success=true httpStatus=${res.status} metaMessageId=${metaId || "none"} recipient=${maskPhone(cleanTo)}`);
      return {
        success: true,
        metaMessageId: metaId,
        httpStatus: res.status,
      };
    } catch (err: any) {
      const reason = err?.message || String(err);
      console.error(`[GOAT-AI][WHATSAPP][WHATSAPP_SEND_ERROR] correlationId=${correlationId || "none"} mechanism=template template=${templateName} success=false error="${reason}" recipient=${maskPhone(cleanTo)}`);
      return {
        success: false,
        errorCategory: "NETWORK_ERROR",
        errorReason: reason,
      };
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
    const correlationId = `wa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[GOAT-AI][WHATSAPP][WEBHOOK_RECEIVED] correlationId=${correlationId} entriesCount=${body?.entry?.length || 0}`);

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
    const maskedPhone = maskPhone(senderPhone);

    console.log(`[GOAT-AI][WHATSAPP][MESSAGE_PARSED] correlationId=${correlationId} messageId=${messageId} phone=${maskedPhone} messageType=${messageType} senderName="${contactName}"`);

    // Deduplication check: if this specific messageId was already processed, ignore Meta retry
    if (messageId) {
      const { data: existingMsg } = await this.supabaseAdmin
        .from("ai_messages")
        .select("id")
        .eq("external_message_id", messageId)
        .maybeSingle();

      if (existingMsg) {
        console.log(`[GOAT-AI][WHATSAPP][DEDUPLICATE] correlationId=${correlationId} messageId=${messageId} already processed. Skipping duplicate webhook.`);
        return { handled: true, reason: "Duplicate message already processed" };
      }
    }

    // 1. Resolve User with wa_id priority
    const convManager = new ConversationManager(this.supabaseAdmin);
    console.log(`[GOAT-AI][WHATSAPP][PHONE_NORMALIZED] correlationId=${correlationId} rawPhone=${maskedPhone} waId=${maskPhone(waId)}`);
    const resolvedUser = await convManager.resolveUserByWaIdOrPhone(waId, senderPhone);

    if (!resolvedUser || !resolvedUser.authorized) {
      console.warn(`[GOAT-AI][AUTH][UNAUTHORIZED] correlationId=${correlationId} phone=${maskedPhone} userFound=${!!resolvedUser} authorized=false`);
      const unauthReply = "Olá! Eu sou a GIA, assistente do Goat Bar. Este número de WhatsApp ainda não está vinculado a uma conta autorizada do Goat Bar. Solicite a liberação de acesso com um dos administradores.";
      await this.sendTextMessage(senderPhone, unauthReply, correlationId);
      return { handled: true, reply: unauthReply, reason: "Unauthorized phone number" };
    }

    console.log(`[GOAT-AI][AUTH][USER_RESOLVED] correlationId=${correlationId} userId=${resolvedUser.userId} userName="${resolvedUser.name}" authorized=true externalUserId=${resolvedUser.externalUserId || "none"}`);

    // 2. Extract content and media
    let messageText = "";
    const attachments: AgentAttachment[] = [];

    const ALLOWED_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
    const ALLOWED_DOC_MIMES = new Set(["application/pdf", "image/jpeg", "image/png"]);
    const ALLOWED_AUDIO_MIMES = new Set(["audio/ogg", "audio/mpeg", "audio/mp4", "audio/aac", "audio/wav"]);

    if (message.type === "text") {
      messageText = message.text?.body || "";
    } else if (message.type === "image") {
      messageText = message.image?.caption || "Foto enviada";
      const mime = message.image?.mime_type || "image/jpeg";
      const mediaId = message.image?.id || "unknown_media";
      console.log(`[GOAT-AI][MEDIA][RECEIVED] correlationId=${correlationId} mediaId=${mediaId} mimeType=${mime}`);

      if (!ALLOWED_IMAGE_MIMES.has(mime.toLowerCase())) {
        console.warn(`[GOAT-AI][MEDIA][REJECTED] correlationId=${correlationId} reason="unsupported_mime" mimeType=${mime}`);
        const reply = "Recebi sua imagem, mas o formato não é suportado. Por favor, envie uma foto em JPG, PNG ou WEBP.";
        await this.sendTextMessage(senderPhone, reply, correlationId);
        return { handled: true, reply, reason: "Unsupported image MIME type" };
      }

      if (this.config.accessToken && message.image?.id) {
        const media = await this.downloadMediaBase64(message.image.id, correlationId);
        if (!media) {
          const reply = "Não consegui baixar a imagem enviada. Pode tentar reenviar?";
          await this.sendTextMessage(senderPhone, reply, correlationId);
          return { handled: true, reply, reason: "Failed to download media" };
        }
        attachments.push({
          mimeType: media.mimeType || mime,
          dataBase64: media.dataBase64,
        });
      }
    } else if (message.type === "document") {
      messageText = message.document?.caption || message.document?.filename || "Documento enviado";
      const mime = message.document?.mime_type || "application/pdf";
      const mediaId = message.document?.id || "unknown_media";
      console.log(`[GOAT-AI][MEDIA][RECEIVED] correlationId=${correlationId} mediaId=${mediaId} mimeType=${mime}`);

      if (!ALLOWED_DOC_MIMES.has(mime.toLowerCase())) {
        console.warn(`[GOAT-AI][MEDIA][REJECTED] correlationId=${correlationId} reason="unsupported_mime" mimeType=${mime}`);
        const reply = "Recebi seu documento, mas atualmente aceitamos apenas PDFs ou imagens.";
        await this.sendTextMessage(senderPhone, reply, correlationId);
        return { handled: true, reply, reason: "Unsupported document MIME type" };
      }

      if (this.config.accessToken && message.document?.id) {
        const media = await this.downloadMediaBase64(message.document.id, correlationId);
        if (!media) {
          const reply = "Não consegui baixar o documento enviado. Pode tentar reenviar?";
          await this.sendTextMessage(senderPhone, reply, correlationId);
          return { handled: true, reply, reason: "Failed to download media" };
        }
        attachments.push({
          mimeType: media.mimeType || mime,
          dataBase64: media.dataBase64,
          fileName: message.document.filename,
        });
      }
    } else if (message.type === "audio" || message.type === "voice") {
      messageText = "Áudio enviado";
      const audioObj = message.audio || message.voice;
      const mime = audioObj?.mime_type || "audio/ogg";
      const mediaId = audioObj?.id || "unknown_media";
      console.log(`[GOAT-AI][MEDIA][RECEIVED] correlationId=${correlationId} mediaId=${mediaId} mimeType=${mime}`);

      if (this.config.accessToken && audioObj?.id) {
        const media = await this.downloadMediaBase64(audioObj.id, correlationId);
        if (media) {
          attachments.push({
            mimeType: media.mimeType || mime,
            dataBase64: media.dataBase64,
          });
        }
      }
    }

    // 3. Process with Gemini Agent
    const turnId = `wa_turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const requestId = `wa_req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[GOAT-AI][WHATSAPP][AGENT_STARTED] correlationId=${correlationId} turnId=${turnId} messageTextLength=${messageText.length} attachmentsCount=${attachments.length}`);
    const agent = new GoatAIGeminiAgent(this.supabaseAdmin);
    const turnResult = await agent.processTurn({
      correlationId,
      turnId,
      requestId,
      channel: "whatsapp",
      message: messageText,
      userId: resolvedUser.userId,
      userName: resolvedUser.name || contactName,
      userRole: resolvedUser.role,
      externalMessageId: messageId,
      externalSenderId: senderPhone,
      attachments,
    });

    console.log(`[GOAT-AI][WHATSAPP][AGENT_COMPLETED] correlationId=${correlationId} turnId=${turnResult.turnId} status=${turnResult.turnStatus} toolsExecuted=${turnResult.toolCallsExecuted?.length || 0} replyLength=${turnResult.reply?.length || 0}`);

    // 4. Se o turno gerou explicitamente um PDF, tente entregar o arquivo real.
    // Se a Meta não conseguir buscar o documento, caia para texto com URL clicável.
    // Somente documentos solicitados para ENTREGA ao usuário são anexados.
    // Contrato enviado para assinatura é uma ação jurídica: o PDF vai para a
    // Assinafy e não deve ser anexado automaticamente na conversa da GIA.
    const documentToolNames = new Set([
      "generate_event_menu_pdf",
      "generate_commercial_proposal_pdf",
    ]);
    const generatedDocumentCall = (turnResult.toolCallsExecuted || []).find(
      (call: any) =>
        call?.status === "success" &&
        documentToolNames.has(call?.toolName) &&
        typeof call?.result?.pdf_url === "string" &&
        call.result.pdf_url.startsWith("http"),
    );

    let deliveredAsDocument = false;
    if (generatedDocumentCall) {
      const result = generatedDocumentCall.result || {};
      const caption =
        generatedDocumentCall.toolName === "generate_event_menu_pdf"
          ? "Cardápio em PDF"
          : "Proposta comercial em PDF";
      deliveredAsDocument = await this.sendDocumentMessage(
        senderPhone,
        result.pdf_url,
        result.filename || "documento-goatbar.pdf",
        caption,
        correlationId,
      );
    }

    if (!deliveredAsDocument && turnResult.reply) {
      const sendOk = await this.sendTextMessage(senderPhone, turnResult.reply, correlationId);
      if (!sendOk) {
        console.error(`[GOAT-AI][WHATSAPP][WHATSAPP_SEND_ERROR] correlationId=${correlationId} recipient=${maskedPhone} reason="sendTextMessage returned false"`);
      }
    }

    return { handled: true, reply: turnResult.reply };
  }

  public async downloadMediaBase64(
    mediaId: string,
    correlationId?: string
  ): Promise<{ dataBase64: string; mimeType: string; sizeBytes: number } | null> {
    const MAX_MEDIA_BYTES = 20 * 1024 * 1024; // 20 MB

    try {
      console.log(`[GOAT-AI][MEDIA][RESOLVE_STARTED] correlationId=${correlationId || "none"} mediaId=${mediaId}`);
      const mediaUrlRes = await fetch(getWhatsAppMediaUrl(mediaId), {
        headers: { Authorization: `Bearer ${this.config.accessToken}` },
      });
      if (!mediaUrlRes.ok) {
        console.error(`[GOAT-AI][MEDIA][RESOLVE_FAILED] correlationId=${correlationId || "none"} status=${mediaUrlRes.status}`);
        return null;
      }

      const mediaData = await mediaUrlRes.json();
      if (!mediaData.url) {
        console.error(`[GOAT-AI][MEDIA][RESOLVE_FAILED] correlationId=${correlationId || "none"} error="no url in response"`);
        return null;
      }

      const mimeType = mediaData.mime_type || "image/jpeg";
      const fileSizeBytes = Number(mediaData.file_size) || 0;

      if (fileSizeBytes > MAX_MEDIA_BYTES) {
        console.warn(`[GOAT-AI][MEDIA][SIZE_EXCEEDED] correlationId=${correlationId || "none"} fileSizeBytes=${fileSizeBytes} maxBytes=${MAX_MEDIA_BYTES}`);
        return null;
      }

      console.log(`[GOAT-AI][MEDIA][DOWNLOAD_STARTED] correlationId=${correlationId || "none"} mediaId=${mediaId} mimeType=${mimeType} declaredSize=${fileSizeBytes}`);
      const fileRes = await fetch(mediaData.url, {
        headers: { Authorization: `Bearer ${this.config.accessToken}` },
      });

      if (!fileRes.ok) {
        console.error(`[GOAT-AI][MEDIA][DOWNLOAD_FAILED] correlationId=${correlationId || "none"} status=${fileRes.status}`);
        return null;
      }

      const arrayBuffer = await fileRes.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_MEDIA_BYTES) {
        console.warn(`[GOAT-AI][MEDIA][SIZE_EXCEEDED] correlationId=${correlationId || "none"} actualBytes=${arrayBuffer.byteLength}`);
        return null;
      }

      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const dataBase64 = btoa(binary);

      console.log(`[GOAT-AI][MEDIA][DOWNLOAD] correlationId=${correlationId || "none"} success=true mediaId=${mediaId} mimeType=${mimeType} sizeBytes=${bytes.byteLength}`);
      console.log(`[GOAT-AI][MEDIA][DOWNLOAD_SUCCESS] correlationId=${correlationId || "none"} mediaId=${mediaId} mimeType=${mimeType} sizeBytes=${bytes.byteLength}`);

      return {
        dataBase64,
        mimeType,
        sizeBytes: bytes.byteLength,
      };
    } catch (err: any) {
      console.error(`[GOAT-AI][MEDIA][DOWNLOAD] correlationId=${correlationId || "none"} success=false error="${err?.message || String(err)}"`);
      console.error(`[GOAT-AI][MEDIA][ERROR] correlationId=${correlationId || "none"} error="${err?.message || String(err)}"`);
      return null;
    }
  }
}
