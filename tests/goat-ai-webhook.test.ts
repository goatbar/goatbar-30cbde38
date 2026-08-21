import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  verifyWebhookChallenge,
  verifyMetaSignature,
  parseWhatsAppPayload,
  validateMediaAttachment,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "../supabase/functions/whatsapp-webhook/logic";
import { WhatsAppChannelAdapter } from "../supabase/functions/_shared/goat-ai/channel/whatsapp-adapter";
import { ConversationManager } from "../supabase/functions/_shared/goat-ai/conversation/manager";
import { GoatAIToolRegistry } from "../supabase/functions/_shared/goat-ai/tools/registry";

describe("Goat AI WhatsApp Webhook, Signatures, Handshake & Media Ingestion", () => {
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

  it("rejects missing signature header when app secret is set", async () => {
    const rawBody = JSON.stringify({ object: "whatsapp_business_account" });
    const appSecret = "secret_meta_app_key_123";
    const isValid = await verifyMetaSignature(rawBody, null, appSecret);
    expect(isValid).toBe(false);
  });

  it("ignores WhatsApp delivery and read status updates without creating messages", () => {
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
    expect(messages).toHaveLength(0); // Status updates are ignored
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

  it("parses image, document and audio messages", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "entry_1",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                contacts: [{ profile: { name: "Jhansen" }, wa_id: "5531988887777" }],
                messages: [
                  {
                    from: "5531988887777",
                    id: "wamid.IMG1",
                    timestamp: "1724240010",
                    type: "image",
                    image: { id: "media_img_1", mime_type: "image/jpeg", caption: "Sessão 7 Steak" },
                  },
                  {
                    from: "5531988887777",
                    id: "wamid.DOC1",
                    timestamp: "1724240020",
                    type: "document",
                    document: { id: "media_doc_1", mime_type: "application/pdf", filename: "NF_123.pdf" },
                  },
                  {
                    from: "5531988887777",
                    id: "wamid.AUD1",
                    timestamp: "1724240030",
                    type: "audio",
                    audio: { id: "media_aud_1", mime_type: "audio/ogg; codecs=opus" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const messages = parseWhatsAppPayload(payload);
    expect(messages).toHaveLength(3);
    expect(messages[0].type).toBe("image");
    expect(messages[0].mediaId).toBe("media_img_1");
    expect(messages[1].type).toBe("document");
    expect(messages[1].fileName).toBe("NF_123.pdf");
    expect(messages[2].type).toBe("audio");
    expect(messages[2].mediaId).toBe("media_aud_1");
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

describe("Goat AI WhatsAppChannelAdapter & Unauthorized User Handling", () => {
  let mockSupabase: any;
  let adapter: WhatsAppChannelAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockSupabase = {
      from: vi.fn(),
    };
    adapter = new WhatsAppChannelAdapter(mockSupabase, {
      phoneNumberId: "1260902867106927",
      accessToken: "mock_token",
      verifyToken: "mock_verify",
    });
  });

  it("sends unauthorized message and prevents internal tool execution when sender is unknown", async () => {
    // Mock user_messaging_accounts returns null
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "user_messaging_accounts") {
        const createQueryBuilder = () => {
          const builder: any = {
            eq: () => builder,
            or: () => builder,
            maybeSingle: async () => ({ data: null, error: null }),
          };
          return builder;
        };
        return {
          select: () => createQueryBuilder(),
        };
      }
      return {};
    });

    const sendSpy = vi.spyOn(adapter, "sendTextMessage").mockResolvedValue(true);

    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                contacts: [{ profile: { name: "Desconhecido" }, wa_id: "5531900000000" }],
                messages: [
                  {
                    from: "5531900000000",
                    id: "wamid.UNAUTH",
                    text: { body: "Quais são os próximos eventos?" },
                    type: "text",
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const res = await adapter.processIncomingWebhook(payload);
    expect(res.handled).toBe(true);
    expect(res.reason).toBe("Unauthorized phone number");
    expect(sendSpy).toHaveBeenCalledWith("5531900000000", expect.stringContaining("não está vinculado a uma conta autorizada"));
  });
});
