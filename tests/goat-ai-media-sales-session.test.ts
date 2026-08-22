import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateSalesSessionData,
  checkDuplicateSalesSession,
  formatSalesSessionWhatsAppPreview,
  normalizeCurrency,
  normalizeDate,
} from "../supabase/functions/_shared/goat-ai/validators/sales-session-validator";
import { GoatAIGeminiAgent } from "../supabase/functions/_shared/goat-ai/agent/gemini-agent";
import { ConversationManager } from "../supabase/functions/_shared/goat-ai/conversation/manager";
import { GoatAIToolRegistry } from "../supabase/functions/_shared/goat-ai/tools/registry";
import { WhatsAppChannelAdapter } from "../supabase/functions/_shared/goat-ai/channel/whatsapp-adapter";

describe("Goat AI - Multimodal Media Reading, Sales Session & Safe Confirmation", () => {
  let mockSupabase: any;
  let toolRegistry: GoatAIToolRegistry;
  let insertedSessions: any[];
  let insertedSessionItems: any[];
  let pendingActions: any[];
  let messages: any[];

  beforeEach(() => {
    vi.restoreAllMocks();
    insertedSessions = [];
    insertedSessionItems = [];
    pendingActions = [];
    messages = [];
    toolRegistry = new GoatAIToolRegistry();

    const createBuilder = (table: string) => {
      let currentOperation = "select";
      let updatePayload: any = null;
      let insertPayload: any = null;
      let filters: { col: string; val: any; type: string }[] = [];

      const builder: any = {
        select: vi.fn(() => {
          currentOperation = "select";
          return builder;
        }),
        insert: vi.fn((payload: any) => {
          currentOperation = "insert";
          insertPayload = payload;
          if (table === "financial_sessions") {
            const session = { id: `session-${Date.now()}`, ...payload };
            insertedSessions.push(session);
            insertPayload = session;
          } else if (table === "financial_session_items") {
            const items = Array.isArray(payload) ? payload : [payload];
            insertedSessionItems.push(...items);
            insertPayload = items;
          } else if (table === "ai_pending_actions") {
            const pending = { id: `pending-${Date.now()}`, ...payload };
            pendingActions.push(pending);
            insertPayload = pending;
          } else if (table === "ai_messages") {
            const msg = { id: `msg-${Date.now()}`, ...payload };
            messages.push(msg);
            insertPayload = msg;
          }
          return builder;
        }),
        update: vi.fn((payload: any) => {
          currentOperation = "update";
          updatePayload = payload;
          return builder;
        }),
        eq: vi.fn((col: string, val: any) => {
          filters.push({ col, val, type: "eq" });
          return builder;
        }),
        in: vi.fn((col: string, vals: any[]) => {
          filters.push({ col, val: vals, type: "in" });
          return builder;
        }),
        or: vi.fn(() => builder),
        gt: vi.fn(() => builder),
        order: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        single: vi.fn(async () => {
          if (table === "financial_sessions") {
            return { data: insertPayload || insertedSessions[0] || null, error: null };
          }
          if (table === "ai_pending_actions") {
            return { data: insertPayload || pendingActions[pendingActions.length - 1] || null, error: null };
          }
          if (table === "ai_messages") {
            return { data: insertPayload || messages[messages.length - 1] || null, error: null };
          }
          if (table === "ai_conversations") {
            return { data: { id: "conv-1", status: "active" }, error: null };
          }
          return { data: insertPayload || null, error: null };
        }),
        maybeSingle: vi.fn(async () => {
          if (table === "user_messaging_accounts") {
            return {
              data: {
                id: "acc-1",
                user_id: "user-1",
                display_name: "Mariana Campos",
                verified: true,
                phone_number: "+5531999998888",
              },
              error: null,
            };
          }
          if (table === "profiles") {
            return { data: { display_name: "Mariana Campos", email: "mariana@goatbar.com.br" }, error: null };
          }
          if (table === "ai_conversations") {
            return { data: { id: "conv-1", status: "active" }, error: null };
          }
          if (table === "ai_pending_actions") {
            const active = pendingActions
              .slice()
              .reverse()
              .find((p) => p.status === "ready_for_confirmation" || p.status === "collecting");
            return { data: active || null, error: null };
          }
          if (table === "financial_sessions") {
            const found = insertedSessions.find((s) => {
              return filters.every((f) => f.type === "eq" ? s[f.col] === f.val : true);
            });
            return { data: found || null, error: null };
          }
          return { data: null, error: null };
        }),
        then: (resolve: any) => {
          if (currentOperation === "update" && table === "ai_pending_actions" && updatePayload) {
            pendingActions.forEach((p) => {
              const matches = filters.every((f) => {
                if (f.type === "eq") return p[f.col] === f.val;
                if (f.type === "in") return f.val.includes(p[f.col]);
                return true;
              });
              if (matches) {
                Object.assign(p, updatePayload);
              }
            });
          }
          return Promise.resolve({ data: null, error: null }).then(resolve);
        },
      };

      return builder;
    };

    mockSupabase = {
      from: vi.fn((table: string) => createBuilder(table)),
    };
  });

  // 1. Normalization & Math Check Tests
  it("normalizes currency, dates and units deterministically in TypeScript", () => {
    expect(normalizeCurrency("R$ 1.234,56")).toBe(1234.56);
    expect(normalizeCurrency("8.450,00")).toBe(8450.0);
    expect(normalizeCurrency(1200.5)).toBe(1200.5);

    expect(normalizeDate("07/08/2026")).toBe("2026-08-07");
    expect(normalizeDate("2026-08-07")).toBe("2026-08-07");
    expect(normalizeDate("07/08", 2026)).toBe("2026-08-07");

    const valid = validateSalesSessionData({
      unit_name: "Goat Botequim",
      date: "07/08/2026",
      items: [
        { name: "Caipirinha", quantity: 10, unit_price: 25.0 },
        { name: "Gin Tropical", quantity: 5, unit_price: 30.0 },
      ],
      labor_value: 200.0,
      labor_names: "Jhansen",
    });

    expect(valid.isValid).toBe(true);
    expect(valid.normalized?.total_drinks).toBe(15);
    expect(valid.normalized?.total_amount).toBe(400.0);
    expect(valid.normalized?.start_date).toBe("2026-08-07");
    expect(valid.normalized?.labor_value).toBe(200.0);
    expect(valid.normalized?.labor_names).toBe("Jhansen");
    expect(valid.warnings).toHaveLength(0);
  });

  it("validates missing mandatory fields when required data is not provided", () => {
    const invalid = validateSalesSessionData({
      items: [{ name: "Caipirinha", quantity: 2 }],
    });

    expect(invalid.isValid).toBe(false);
    expect(invalid.missingFields).toContain("unit_name");
    expect(invalid.missingFields).toContain("start_date");
  });

  // 2. Safe Media Download & Log Sanitization
  it("downloads WhatsApp media safely with byte limit and prevents leaking tokens/base64 in logs", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    globalThis.fetch = vi
      .fn()
      .mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({
          url: "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=123&ext=123",
          mime_type: "image/jpeg",
          file_size: 1024,
        }),
      }))
      .mockImplementationOnce(async () => ({
        ok: true,
        arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
      }));

    const adapter = new WhatsAppChannelAdapter(mockSupabase, {
      phoneNumberId: "12345",
      accessToken: "SECRET_ACCESS_TOKEN_XYZ",
    });

    const media = await adapter.downloadMediaBase64("media-test-1", "corr-test-1");
    expect(media).not.toBeNull();
    expect(media?.mimeType).toBe("image/jpeg");
    expect(media?.sizeBytes).toBe(4);

    // Verify token was NOT logged anywhere
    for (const call of logSpy.mock.calls) {
      const line = call.join(" ");
      expect(line).not.toContain("SECRET_ACCESS_TOKEN_XYZ");
      expect(line).not.toContain("data:image");
    }
  });

  it("rejects unsupported media MIME type before downloading", async () => {
    const adapter = new WhatsAppChannelAdapter(mockSupabase, {
      phoneNumberId: "12345",
      accessToken: "mock-token",
    });

    const sendSpy = vi.spyOn(adapter, "sendTextMessage").mockResolvedValue(true);

    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                contacts: [{ profile: { name: "Mariana" }, wa_id: "5531999998888" }],
                messages: [
                  {
                    from: "5531999998888",
                    id: "wamid.EXE1",
                    type: "image",
                    image: { id: "media-bad-1", mime_type: "application/x-msdownload" },
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
    expect(res.reason).toBe("Unsupported image MIME type");
    expect(sendSpy).toHaveBeenCalledWith(
      "5531999998888",
      expect.stringContaining("formato não é suportado"),
      expect.any(String)
    );
  });

  // 3. Guarantee that Image NEVER creates records without confirmation
  it("interprets sales session image, presents preview and GUARANTEES NO DB INSERT before confirmation", async () => {
    // Mock Gemini API returning create_sales_session functionCall
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              role: "model",
              parts: [
                {
                  functionCall: {
                    name: "create_sales_session",
                    args: {
                      unit_name: "Goat Botequim",
                      start_date: "2026-08-07",
                      items: [
                        { name: "Caipirinha Classica", quantity: 16, unit_price: 22.0 },
                        { name: "Gin Tropical", quantity: 12, unit_price: 25.0 },
                      ],
                      labor_value: 200.0,
                      labor_names: "Jhansen",
                    },
                  },
                },
              ],
            },
            finishReason: "STOP",
          },
        ],
        usageMetadata: { promptTokenCount: 200, candidatesTokenCount: 50 },
      }),
    } as any);

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-gemini-key", toolRegistry);
    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "Segue o fechamento do caixa",
      userId: "user-1",
      userName: "Mariana Campos",
      attachments: [{ mimeType: "image/jpeg", dataBase64: "fakeBase64" }],
    });

    // 1. Turn response must be a preview asking for confirmation
    expect(result.reply).toContain("Sessão de Vendas Identificada");
    expect(result.reply).toContain("Goat Botequim");
    expect(result.reply).toContain("28 drinks");
    expect(result.reply).toContain("Posso realizar o lançamento da sessão de vendas?");

    // 2. Pending Action must be saved in ready_for_confirmation state
    expect(result.pendingAction).not.toBeNull();
    expect(result.pendingAction.status).toBe("ready_for_confirmation");

    // 3. ZERO database inserts in financial_sessions or items!
    expect(insertedSessions).toHaveLength(0);
    expect(insertedSessionItems).toHaveLength(0);
  });

  // 4. Confirmation Flow ("sim") -> Creates EXACTLY ONE record
  it("executes create_sales_session and creates exactly 1 record when user confirms 'sim'", async () => {
    // Setup existing pending action
    pendingActions.push({
      id: "pending-active-1",
      conversation_id: "conv-1",
      tool_name: "create_sales_session",
      arguments: {
        unit_name: "Goat Botequim",
        start_date: "2026-08-07",
        items: [
          { name: "Caipirinha Classica", quantity: 16, unit_price: 22.0 },
          { name: "Gin Tropical", quantity: 12, unit_price: 25.0 },
        ],
        labor_value: 200.0,
        labor_names: "Jhansen",
      },
      missing_fields: [],
      status: "ready_for_confirmation",
      expires_at: new Date(Date.now() + 1000000).toISOString(),
    });

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-gemini-key", toolRegistry);
    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "sim",
      userId: "user-1",
      userName: "Mariana Campos",
    });

    // 1. Must reply with success
    expect(result.reply).toContain("registrada com sucesso");

    // 2. Exactly 1 record inserted in DB
    expect(insertedSessions).toHaveLength(1);
    expect(insertedSessions[0].modality).toBe("Goat Botequim");
    expect(insertedSessions[0].labor_names).toBe("Jhansen");

    // 3. Status updated to executed
    const updatedPending = pendingActions.find((p) => p.id === "pending-active-1");
    expect(updatedPending.status).toBe("executed");
  });

  // 5. Idempotency: Replaying "sim" does NOT create duplicate records
  it("protects idempotency: replaying 'sim' does NOT create duplicate records in DB", async () => {
    pendingActions.push({
      id: "pending-executed-1",
      conversation_id: "conv-1",
      tool_name: "create_sales_session",
      arguments: {
        unit_name: "Goat Botequim",
        start_date: "2026-08-07",
        responsible: "Jhansen",
        total_amount: 8450.0,
      },
      missing_fields: [],
      status: "executed", // Already executed
      result: { session_id: "session-1" },
      expires_at: new Date(Date.now() + 1000000).toISOString(),
    });

    const manager = new ConversationManager(mockSupabase, toolRegistry);
    const execResult = await manager.executePendingAction(
      pendingActions[0],
      { supabaseAdmin: mockSupabase, conversationId: "conv-1", channel: "whatsapp" }
    );

    expect(execResult.success).toBe(true);
    expect(execResult.message).toContain("já foi executada");
    expect(insertedSessions).toHaveLength(0); // NO extra insert!
  });

  // 6. Cancellation Flow ("não / cancela")
  it("cancels pending action without inserting anything when user says 'não'", async () => {
    pendingActions.push({
      id: "pending-active-2",
      conversation_id: "conv-1",
      tool_name: "create_sales_session",
      arguments: {
        unit_name: "7 Steak House",
        start_date: "2026-08-12",
        responsible: "Jhansen",
        total_amount: 1500.0,
      },
      missing_fields: [],
      status: "ready_for_confirmation",
      expires_at: new Date(Date.now() + 1000000).toISOString(),
    });

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-gemini-key", toolRegistry);
    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "não, cancela",
      userId: "user-1",
      userName: "Mariana Campos",
    });

    expect(result.reply).toContain("Operação cancelada");
    const updated = pendingActions.find((p) => p.id === "pending-active-2");
    expect(updated.status).toBe("cancelled");
    expect(insertedSessions).toHaveLength(0);
  });

  // 7. Deterministic Duplicate Detection
  it("detects existing session for the same modality and date in the database", async () => {
    insertedSessions.push({
      id: "session-existing-1",
      modality: "Goat Botequim",
      date: "2026-08-07",
      labor_names: "Jhansen",
      financial_session_items: [{ quantity: 1, unit_price: 8450 }],
    });

    const duplicateCheck = await checkDuplicateSalesSession(
      mockSupabase,
      "Goat Botequim",
      "2026-08-07"
    );

    expect(duplicateCheck.isDuplicate).toBe(true);
    expect(duplicateCheck.existingSessionId).toBe("session-existing-1");

    const nonDuplicate = await checkDuplicateSalesSession(
      mockSupabase,
      "7Steakhouse",
      "2026-08-07"
    );
    expect(nonDuplicate.isDuplicate).toBe(false);
  });

  // 8. Unknown document handling
  it("handles unknown/unrecognized document without creating pending action or DB records", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              role: "model",
              parts: [
                {
                  text: "Consegui ler a imagem, mas não identifiquei com segurança qual lançamento você quer fazer. Pode me dizer o que é esse documento?",
                },
              ],
            },
            finishReason: "STOP",
          },
        ],
      }),
    } as any);

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-gemini-key", toolRegistry);
    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "Segue documento",
      userId: "user-1",
      attachments: [{ mimeType: "image/jpeg", dataBase64: "unrecognizedDoc" }],
    });

    expect(result.reply).toContain("não identifiquei com segurança");
    expect(result.pendingAction).toBeNull();
    expect(insertedSessions).toHaveLength(0);
  });

  // 9. Failure preservation
  it("preserves pending action state for retry and does NOT mark as executed if tool fails", async () => {
    pendingActions.push({
      id: "pending-failing-1",
      conversation_id: "conv-1",
      tool_name: "create_sales_session",
      arguments: {
        unit_name: "Goat Botequim",
        start_date: "2026-08-07",
        items: [{ name: "Caipirinha", quantity: 10, unit_price: 25.0 }],
        labor_value: 200.0,
      },
      missing_fields: [],
      status: "ready_for_confirmation",
      expires_at: new Date(Date.now() + 1000000).toISOString(),
    });

    // Force DB error on financial_sessions insert
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "financial_sessions") {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: null, error: { message: "Database connection timeout" } }),
            }),
          }),
        };
      }
      if (table === "ai_pending_actions") {
        return {
          update: (payload: any) => ({
            eq: (_col: string, val: any) => {
              const item = pendingActions.find((p) => p.id === val);
              if (item) Object.assign(item, payload);
              return { select: () => ({ single: async () => ({ data: item, error: null }) }) };
            },
          }),
        };
      }
      if (table === "ai_tool_calls") {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {};
    });

    const manager = new ConversationManager(mockSupabase, toolRegistry);
    const execResult = await manager.executePendingAction(
      pendingActions[0],
      { supabaseAdmin: mockSupabase, conversationId: "conv-1", channel: "whatsapp" }
    );

    expect(execResult.success).toBe(false);
    expect(execResult.error).toContain("Database connection timeout");

    // Status MUST NOT be 'executed'
    const preserved = pendingActions.find((p) => p.id === "pending-failing-1");
    expect(preserved.status).toBe("ready_for_confirmation");
    expect(preserved.error).toContain("Database connection timeout");
  });
});
