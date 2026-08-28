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
            in: () => builder,
            maybeSingle: async () => ({ data: null, error: null }),
          };
          return builder;
        };
        return {
          select: () => createQueryBuilder(),
        };
      }
      if (table === "ai_messages") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
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
    expect(sendSpy).toHaveBeenCalledWith("5531900000000", expect.stringContaining("não está vinculado a uma conta autorizada"), expect.any(String));
  });

  it("handles authorized partner message with 9th-digit variation and passes to AI engine", async () => {
    // Mock DB account for Mariana Campos
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "user_messaging_accounts") {
        const createQueryBuilder = () => {
          const builder: any = {
            eq: () => builder,
            or: () => builder,
            in: () => ({
              data: [
                {
                  id: "acc-mariana",
                  user_id: "user-mariana-123",
                  display_name: "Mariana Campos",
                  verified: true,
                  external_user_id: null,
                  phone_number: "+5537999985192",
                },
              ],
              error: null,
            }),
            maybeSingle: async () => ({ data: null, error: null }),
          };
          return builder;
        };
        return {
          select: () => createQueryBuilder(),
          update: () => ({ eq: async () => ({ data: null, error: null }) }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { display_name: "Mariana Campos", email: "mariana@goatbar.com.br" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "ai_conversations") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: { id: "conv-mariana-1", status: "active" },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: { id: "conv-mariana-1", status: "active" },
                error: null,
              }),
            }),
          }),
          update: () => ({ eq: async () => ({ data: null, error: null }) }),
        };
      }
      if (table === "ai_messages") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: { id: "msg-1" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "ai_pending_actions") {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                gt: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const sendSpy = vi.spyOn(adapter, "sendTextMessage").mockResolvedValue(true);

    // Meta sends 12-digit wa_id (without 9th digit): 553799985192
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                contacts: [{ profile: { name: "Mariana Campos" }, wa_id: "553799985192" }],
                messages: [
                  {
                    from: "553799985192",
                    id: "wamid.AUTH1",
                    text: { body: "Oi" },
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
    // Should NOT have rejected as unauthorized
    expect(res.reason).not.toBe("Unauthorized phone number");
    expect(sendSpy).toHaveBeenCalled();
  });

  it("safely logs Meta API errors without exposing access tokens in sendTextMessage", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          message: "(#131030) Recipient phone number not in allowed list",
          type: "OAuthException",
          code: 131030,
          error_subcode: 2388040,
        },
      }),
      text: async () => "",
    } as any);

    const result = await adapter.sendTextMessage("+55 (31) 99876-1967", "Teste de mensagem");
    expect(result).toBe(false);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[GOAT-AI\]\[WHATSAPP\]\[WHATSAPP_SEND_ERROR\].*metaErrorCode=131030/)
    );
    // Check that access token is NOT in any logged call
    for (const call of errorSpy.mock.calls) {
      const logStr = call.join(" ");
      expect(logStr).not.toContain("mock_token");
    }
  });

  it("sends EXACTLY ONE final message on WhatsApp during Tool Calling and NEVER sends false fallback before successful response", async () => {
    process.env.GEMINI_API_KEY = "mock_gemini_key_for_test";
    // Mariana Campos authorized
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "user_messaging_accounts") {
        const createQueryBuilder = () => {
          const builder: any = {
            eq: () => builder,
            or: () => builder,
            in: () => ({
              data: [
                {
                  id: "acc-mariana",
                  user_id: "user-mariana-123",
                  display_name: "Mariana Campos",
                  verified: true,
                  external_user_id: null,
                  phone_number: "+5537999985192",
                },
              ],
              error: null,
            }),
            maybeSingle: async () => ({ data: null, error: null }),
          };
          return builder;
        };
        return { select: () => createQueryBuilder(), update: () => ({ eq: async () => ({ data: null, error: null }) }) };
      }
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { display_name: "Mariana Campos" }, error: null }) }) }) };
      }
      if (table === "ai_conversations") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { id: "conv-1", status: "active" }, error: null }) }) }) }) }) }) }),
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: "conv-1", status: "active" }, error: null }) }) }),
          update: () => ({ eq: async () => ({ data: null, error: null }) }),
        };
      }
      if (table === "ai_messages") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
              order: () => ({ limit: async () => ({ data: [], error: null }) }),
            }),
          }),
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: "msg-1" }, error: null }) }) }),
        };
      }
      if (table === "ai_pending_actions") {
        return { select: () => ({ eq: () => ({ in: () => ({ gt: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) }) }) };
      }
      if (table === "ai_tool_calls") {
        return { insert: async () => ({ data: null, error: null }) };
      }
      if (table === "events") {
        return {
          select: () => ({
            order: () => ({
              limit: async () => ({
                data: [
                  {
                    id: "ev-luisa",
                    client_name: "Luísa de Paula",
                    event_name: "Casamento da Luísa",
                    date: "2026-09-05",
                    drinks: ["Caipi Limão Cravo e Mel", "Caipivodka Abacaxi"],
                    status: "confirmado",
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const sentMessages: string[] = [];
    const sendSpy = vi.spyOn(adapter, "sendTextMessage").mockImplementation(async (_to, text) => {
      sentMessages.push(text);
      return true;
    });

    // Mock Gemini 2-turn fetch
    let fetchCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      fetchCount++;
      if (fetchCount === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  role: "model",
                  parts: [{ functionCall: { name: "search_events", args: { query: "Luisa" } } }],
                },
                finishReason: "STOP",
              },
            ],
            usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20 },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "🍹 *Cardápio de Drinks Selecionados*\n\n• Caipi Limão Cravo e Mel\n• Caipivodka Abacaxi" }],
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: { promptTokenCount: 150, candidatesTokenCount: 30 },
        }),
      };
    });

    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                contacts: [{ profile: { name: "Mariana Campos" }, wa_id: "5537999985192" }],
                messages: [
                  {
                    from: "5537999985192",
                    id: "wamid.CARDAPIO_1",
                    text: { body: "me mostre o cardápio do evento da Luísa" },
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

    // 1. MUST be called EXACTLY once
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sentMessages).toHaveLength(1);

    // 2. Sent message MUST be the cardápio response
    expect(sentMessages[0]).toContain("Cardápio de Drinks Selecionados");
    expect(sentMessages[0]).toContain("Caipi Limão Cravo e Mel");

    // 3. MUST NEVER have sent the false fallback message
    expect(sentMessages[0]).not.toContain("Não consegui processar a resposta");
  });

  it("emits complete structured telemetry lifecycle logs for single-message trace", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "user_messaging_accounts") {
        const createQueryBuilder = () => {
          const builder: any = {
            eq: () => builder,
            or: () => builder,
            in: () => builder,
            maybeSingle: async () => ({
              data: {
                id: "acc-mariana",
                user_id: "user-mariana-123",
                display_name: "Mariana Campos",
                verified: true,
                external_user_id: "553799985192",
                phone_number: "+5537999985192",
              },
              error: null,
            }),
          };
          return builder;
        };
        return {
          select: () => createQueryBuilder(),
        };
      }
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { display_name: "Mariana Campos" }, error: null }) }) }) };
      }
      if (table === "ai_conversations") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { id: "conv-trace-1", status: "active", channel: "whatsapp" }, error: null }) }) }) }) }) }) }),
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: "conv-trace-1", status: "active", channel: "whatsapp" }, error: null }) }) }),
          update: () => ({ eq: async () => ({ data: null, error: null }) }),
        };
      }
      if (table === "ai_messages") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
              order: () => ({ limit: async () => ({ data: [], error: null }) }),
            }),
          }),
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: "msg-trace-1" }, error: null }) }) }),
        };
      }
      if (table === "ai_pending_actions") {
        return { select: () => ({ eq: () => ({ in: () => ({ gt: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) }) }) };
      }
      return {};
    });

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("graph.facebook.com")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ messages: [{ id: "wamid.OUT_1" }] }),
        };
      }
      // Gemini API
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "Olá Mariana! Como posso ajudar?" }] }, finishReason: "STOP" }],
          usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 15 },
        }),
      };
    });

    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                contacts: [{ profile: { name: "Mariana Campos" }, wa_id: "553799985192" }],
                messages: [
                  {
                    from: "553799985192",
                    id: "wamid.TRACE_TEST_1",
                    text: { body: "Olá GIA" },
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

    const loggedMessages = logSpy.mock.calls.map((c) => c.join(" "));
    expect(loggedMessages.some((m) => m.includes("[WEBHOOK_RECEIVED]"))).toBe(true);
    expect(loggedMessages.some((m) => m.includes("[MESSAGE_PARSED]"))).toBe(true);
    expect(loggedMessages.some((m) => m.includes("[PHONE_NORMALIZED]"))).toBe(true);
    expect(loggedMessages.some((m) => m.includes("[USER_RESOLVED]"))).toBe(true);
    expect(loggedMessages.some((m) => m.includes("[CONVERSATION_LOADED]"))).toBe(true);
    expect(loggedMessages.some((m) => m.includes("[AGENT_STARTED]"))).toBe(true);
    expect(loggedMessages.some((m) => m.includes("[AGENT_COMPLETED]"))).toBe(true);
    expect(loggedMessages.some((m) => m.includes("[WHATSAPP_SEND_STARTED]"))).toBe(true);
    expect(loggedMessages.some((m) => m.includes("[WHATSAPP_SEND_SUCCESS]"))).toBe(true);
  });
});


