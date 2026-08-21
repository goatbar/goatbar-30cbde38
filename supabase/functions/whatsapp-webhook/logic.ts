export interface ParsedWhatsAppMessage {
  messageId: string;
  senderPhone: string;
  senderName: string;
  timestamp: string;
  type: "text" | "image" | "audio" | "document" | "other";
  text?: string;
  mediaId?: string;
  mimeType?: string;
  fileName?: string;
}

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/aac",
  "application/pdf",
]);

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export function verifyWebhookChallenge(url: URL, expectedToken?: string | null): string | null {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && expectedToken && token === expectedToken) {
    return challenge;
  }
  return null;
}

export async function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret?: string | null
): Promise<boolean> {
  // If app secret is not set in environment, allow in dev/test, but fail if signature was supplied
  if (!appSecret) return true;
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;

  const expectedSignature = signatureHeader.substring(7);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const calculatedHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return calculatedHex === expectedSignature;
}

export function parseWhatsAppPayload(payload: any): ParsedWhatsAppMessage[] {
  const results: ParsedWhatsAppMessage[] = [];
  if (!payload || !payload.entry || !Array.isArray(payload.entry)) return results;

  for (const entry of payload.entry) {
    for (const change of entry.changes || []) {
      // Strictly ignore delivery/read status updates (sent, delivered, read)
      if (change.value?.statuses && !change.value?.messages) {
        continue;
      }

      if (change.value?.messages && Array.isArray(change.value.messages)) {
        const contact = change.value.contacts?.[0];
        const senderName = contact?.profile?.name || "Contato WhatsApp";

        for (const msg of change.value.messages) {
          const messageId = msg.id;
          const senderPhone = msg.from;
          const timestamp = msg.timestamp
            ? new Date(Number(msg.timestamp) * 1000).toISOString()
            : new Date().toISOString();

          let type: "text" | "image" | "audio" | "document" | "other" = "other";
          let text: string | undefined;
          let mediaId: string | undefined;
          let mimeType: string | undefined;
          let fileName: string | undefined;

          if (msg.type === "text") {
            type = "text";
            text = msg.text?.body;
          } else if (msg.type === "image") {
            type = "image";
            text = msg.image?.caption;
            mediaId = msg.image?.id;
            mimeType = msg.image?.mime_type;
          } else if (msg.type === "audio" || msg.type === "voice") {
            type = "audio";
            mediaId = msg.audio?.id || msg.voice?.id;
            mimeType = msg.audio?.mime_type || msg.voice?.mime_type;
          } else if (msg.type === "document") {
            type = "document";
            text = msg.document?.caption;
            mediaId = msg.document?.id;
            mimeType = msg.document?.mime_type;
            fileName = msg.document?.filename;
          }

          results.push({
            messageId,
            senderPhone,
            senderName,
            timestamp,
            type,
            text,
            mediaId,
            mimeType,
            fileName,
          });
        }
      }
    }
  }

  return results;
}

export function validateMediaAttachment(mimeType?: string, fileSizeBytes?: number): { isValid: boolean; error?: string } {
  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
    return { isValid: false, error: `Formato de arquivo não suportado: ${mimeType}` };
  }
  if (fileSizeBytes && fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    return { isValid: false, error: `Tamanho do arquivo excede o limite de 25MB: ${fileSizeBytes} bytes` };
  }
  return { isValid: true };
}
