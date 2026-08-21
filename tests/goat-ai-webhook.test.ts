import { describe, it, expect } from "vitest";
import {
  verifyWebhookChallenge,
  verifyMetaSignature,
  parseWhatsAppPayload,
  validateMediaAttachment,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "../supabase/functions/whatsapp-webhook/logic";

describe("Goat AI WhatsApp Webhook, Signatures & Media Ingestion", () => {
  it("verifies GET webhook challenge when token matches", () => {
    const url = new URL("https://example.com/webhook?hub.mode=subscribe&hub.verify_token=my_secret_token&hub.challenge=1122334455");
    const challenge = verifyWebhookChallenge(url, "my_secret_token");
    expect(challenge).toBe("1122334455");
  });

  it("rejects GET webhook challenge when token is wrong or missing", () => {
    const url = new URL("https://example.com/webhook?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=1122334455");
    const challenge = verifyWebhookChallenge(url, "my_secret_token");
    expect(challenge).toBeNull();
  });

  it("verifies valid HMAC SHA-256 signature when app secret is set", async () => {
    const rawBody = JSON.stringify({ object: "whatsapp_business_account" });
    const appSecret = "secret_meta_app_key_123";

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(appSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const isValid = await verifyMetaSignature(rawBody, `sha256=${hex}`, appSecret);
    expect(isValid).toBe(true);
  });

  it("rejects invalid signature when app secret is set", async () => {
    const rawBody = JSON.stringify({ object: "whatsapp_business_account" });
    const appSecret = "secret_meta_app_key_123";
    const isValid = await verifyMetaSignature(rawBody, "sha256=invalidhash", appSecret);
    expect(isValid).toBe(false);
  });

  it("ignores WhatsApp delivery and read status updates without creating inbox items", () => {
    const statusPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry_1",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "553199999999", phone_number_id: "12345" },
                statuses: [
                  {
                    id: "wamid.HBgLMD...",
                    status: "delivered",
                    timestamp: "1724240050",
                    recipient_id: "5531988887777",
                  },
                  {
                    id: "wamid.HBgLMD...",
                    status: "read",
                    timestamp: "1724240060",
                    recipient_id: "5531988887777",
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const messages = parseWhatsAppPayload(statusPayload);
    expect(messages).toHaveLength(0); // Status updates are ignored!
  });

  it("parses WhatsApp payload with text message", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry_1",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                contacts: [{ profile: { name: "Lucas Goat" }, wa_id: "5531999998888" }],
                messages: [
                  {
                    from: "5531999998888",
                    id: "wamid.HBgLM...",
                    timestamp: "1724240000",
                    text: { body: "Comprei 4 Tanqueray no Assaí por R$ 480" },
                    type: "text",
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const messages = parseWhatsAppPayload(payload);
    expect(messages).toHaveLength(1);
    expect(messages[0].senderName).toBe("Lucas Goat");
    expect(messages[0].messageId).toBe("wamid.HBgLM...");
    expect(messages[0].text).toContain("Tanqueray");
    expect(messages[0].type).toBe("text");
  });

  it("validates allowed media MIME types and size limits", () => {
    expect(ALLOWED_MIME_TYPES.has("image/jpeg")).toBe(true);
    expect(ALLOWED_MIME_TYPES.has("application/pdf")).toBe(true);
    expect(ALLOWED_MIME_TYPES.has("audio/ogg")).toBe(true);

    const validImage = validateMediaAttachment("image/jpeg", 5 * 1024 * 1024);
    expect(validImage.isValid).toBe(true);

    const invalidMime = validateMediaAttachment("application/x-executable", 100);
    expect(invalidMime.isValid).toBe(false);

    const oversizeFile = validateMediaAttachment("application/pdf", MAX_FILE_SIZE_BYTES + 1);
    expect(oversizeFile.isValid).toBe(false);
  });
});
