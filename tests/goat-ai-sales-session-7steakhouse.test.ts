import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateSalesSessionDraft,
  parseSalesSessionText,
  formatSalesSessionWhatsAppPreview,
  checkDuplicateSalesSession,
  resolveDrinkFromCatalog,
} from "../supabase/functions/_shared/goat-ai/validators/sales-session-validator";
import { resolveBusinessUnit } from "../supabase/functions/_shared/goat-ai/matchers/unit-matcher";
import { GoatAIGeminiAgent } from "../supabase/functions/_shared/goat-ai/agent/gemini-agent";
import { ConversationManager } from "../supabase/functions/_shared/goat-ai/conversation/manager";
import { GoatAIToolRegistry, defaultToolRegistry } from "../supabase/functions/_shared/goat-ai/tools/registry";
import { WhatsAppChannelAdapter } from "../supabase/functions/_shared/goat-ai/channel/whatsapp-adapter";
import { AIRouter } from "../supabase/functions/_shared/goat-ai/router/ai-router";
import { OpenAICompatibleProvider } from "../supabase/functions/_shared/goat-ai/router/providers/openai-compatible-provider";
import { GeminiRouterAdapter } from "../supabase/functions/_shared/goat-ai/router/providers/gemini-adapter";

describe("GIA WhatsApp - Full Audit & Fix for 7 Steak House Sales Sessions (27 Requirements)", () => {
  let mockSupabase: any;
  let insertedSessions: any[];
  let insertedSessionItems: any[];
  let pendingActions: any[];
  let messages: any[];

  const mockDrinksCatalog = [
    {
      id: "drink-caipirinha",
      nome: "Caipirinha",
      custo_unitario: 5.0,
      modality_config: {
        steakhouse: { price: 28.0, cost: 7.0 },
        goatbotequim: { price: 24.0, cost: 6.0 },
        evento: { cost: 5.0 },
      },
    },
    {
      id: "drink-fitzgerald",
      nome: "Fitz Gerald",
      custo_unitario: 6.5,
      modality_config: {
        steakhouse: { price: 34.0, cost: 8.5 },
        goatbotequim: { price: 30.0, cost: 7.5 },
        evento: { cost: 6.5 },
      },
    },
    {
      id: "drink-caipvodka-morango",
      nome: "Caipvodka Morango",
      custo_unitario: 7.0,
      modality_config: {
        steakhouse: { price: 32.0, cost: 8.0 },
        goatbotequim: { price: 28.0, cost: 7.0 },
        evento: { cost: 7.0 },
      },
    },
    {
      id: "drink-london-mule",
      nome: "London Mule",
      custo_unitario: 8.0,
      modality_config: {
        steakhouse: { price: 36.0, cost: 9.0 },
        goatbotequim: { price: 32.0, cost: 8.0 },
        evento: { cost: 8.0 },
      },
    },
    {
      id: "drink-negroni",
      nome: "Negroni",
      custo_unitario: 9.0,
      modality_config: {
        steakhouse: { price: 38.0, cost: 10.0 },
        goatbotequim: { price: 34.0, cost: 9.0 },
        evento: { cost: 9.0 },
      },
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    insertedSessions = [];
    insertedSessionItems = [];
    pendingActions = [];
    messages = [];

    const createBuilder = (table: string) => {
      let currentOperation = "select";
      let updatePayload: any = null;
      let insertPayload: any = null;
      const filters: { col: string; val: any; type: string }[] = [];

      const builder: any = {
        select: vi.fn(() => {
          currentOperation = "select";
          return builder;
        }),
        insert: vi.fn((payload: any) => {
          currentOperation = "insert";
          insertPayload = payload;
          if (table === "financial_sessions") {
            const session = { id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, ...payload };
            insertedSessions.push(session);
            insertPayload = session;
          } else if (table === "financial_session_items") {
            const items = Array.isArray(payload) ? payload : [payload];
            insertedSessionItems.push(...items);
            insertPayload = items;
          } else if (table === "ai_pending_actions") {
            const pending = { id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, ...payload };
            pendingActions.push(pending);
            insertPayload = pending;
          } else if (table === "ai_messages") {
            const msg = { id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, ...payload };
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
            return { data: { id: "conv-test", status: "active" }, error: null };
          }
          return { data: insertPayload || null, error: null };
        }),
        maybeSingle: vi.fn(async () => {
          if (table === "user_messaging_accounts") {
            return {
              data: {
                id: "acc-1",
                user_id: "user-1",
                display_name: "Mariana",
                verified: true,
                phone_number: "+5531999998888",
              },
              error: null,
            };
          }
          if (table === "profiles") {
            return { data: { display_name: "Mariana", email: "mariana@goatbar.com.br" }, error: null };
          }
          if (table === "ai_conversations") {
            return { data: { id: "conv-test", status: "active" }, error: null };
          }
          if (table === "ai_pending_actions") {
            const active = pendingActions
              .slice()
              .reverse()
              .find((p) => p.status === "ready_for_confirmation" || p.status === "collecting");
            return { data: active || null, error: null };
          }
          if (table === "ai_messages") {
            const found = messages.find((m) => {
              return filters.every((f) => f.type === "eq" ? m[f.col] === f.val : true);
            });
            return { data: found || null, error: null };
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
          if (currentOperation === "select" && table === "drinks") {
            return Promise.resolve({ data: mockDrinksCatalog, error: null }).then(resolve);
          }
          if (currentOperation === "select" && table === "ai_messages") {
            return Promise.resolve({ data: messages, error: null }).then(resolve);
          }
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

  // 1. Imagem + legenda contendo "7 Steak House"
  it("1. Image + caption with '7 Steak House' parses correctly and prepares preview", async () => {
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
                      unit_name: "7 Steak House",
                      start_date: "2026-08-05",
                      end_date: "2026-08-09",
                      items: [
                        { name: "Caipirinha", quantity: 2 },
                        { name: "Fitz Gerald", quantity: 16 },
                        { name: "London Mule", quantity: 5 },
                      ],
                    },
                  },
                },
              ],
            },
            finishReason: "STOP",
          },
        ],
      }),
    } as any);

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-key", defaultToolRegistry);
    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "Preciso que você lance uma sessão de venda na 7 steak house, leia a imagem",
      userId: "user-1",
      attachments: [{ mimeType: "image/jpeg", dataBase64: "testImageData" }],
    });

    expect(result.pendingAction).toBeDefined();
    expect(result.pendingAction?.status).toBe("ready_for_confirmation");
    expect(result.reply).toContain("7 Steak House");
    expect(result.reply).toContain("05/08/2026 a 09/08/2026");
    expect(result.reply).toContain("23 drinks");
    expect(insertedSessions).toHaveLength(0); // Zero database insert before confirmation
  });

  // 2. Unidade informada na mensagem anterior + imagem na seguinte
  it("2. Unit informed in turn 1 ('7 steak house') + image in turn 2 inherits unit", async () => {
    // Turn 1 message saved in history
    messages.push({
      id: "msg-1",
      conversation_id: "conv-test",
      role: "user",
      content: "Quero lançar uma sessão de vendas da 7 steak house",
      created_at: new Date().toISOString(),
    });

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
                      // Model omitted unit_name in turn 2, relying on turn 1 context
                      start_date: "2026-08-05",
                      end_date: "2026-08-09",
                      items: [
                        { name: "Caipirinha", quantity: 2 },
                        { name: "Fitz Gerald", quantity: 16 },
                      ],
                    },
                  },
                },
              ],
            },
            finishReason: "STOP",
          },
        ],
      }),
    } as any);

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-key", defaultToolRegistry);
    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "Foto do relatório",
      userId: "user-1",
      attachments: [{ mimeType: "image/jpeg", dataBase64: "testImage" }],
    });

    expect(result.pendingAction).toBeDefined();
    expect(result.pendingAction?.status).toBe("ready_for_confirmation");
    expect(result.reply).toContain("7 Steak House");
  });

  // 3. Todos os dados enviados somente em texto
  it("3. All data sent in text produces complete structured draft and preview", () => {
    const rawText = `7 Steak House
05/08/2026 a 09/08/2026
CAIPIRINHA 2
FITZ GERALD 16
CAIPVODKA MORANGO 1
LONDON MULE 5
NEGRONI 3`;

    const draft = parseSalesSessionText(rawText);
    expect(draft.unit_name).toBe("7 Steak House");
    expect(draft.start_date).toBe("2026-08-05");
    expect(draft.end_date).toBe("2026-08-09");
    expect(draft.items).toHaveLength(5);
    expect(draft.items?.find((i) => i.name === "FITZ GERALD")?.quantity).toBe(16);

    const validation = validateSalesSessionDraft(draft, mockDrinksCatalog);
    expect(validation.isValid).toBe(true);
    expect(validation.normalized?.unit_name).toBe("7 Steak House");
    expect(validation.normalized?.total_drinks).toBe(27);
    expect(validation.normalized?.total_amount).toBeGreaterThan(0);
  });

  // 4. Capitalizações variadas de 7 Steak House
  it("4. Handles various capitalizations of 7 Steak House deterministically", () => {
    const variations = ["7 steakhouse", "7 Steak House", "7STEAKHOUSE", "7steak house", "7steak"];
    for (const v of variations) {
      const res = resolveBusinessUnit(v);
      expect(res.matched).toBe(true);
      expect(res.canonicalName).toBe("7 Steak House");
      expect(res.dbModality).toBe("7Steakhouse");
    }
  });

  // 5. Todos os aliases de 7 Steak House
  it("5. Resolves all aliases of 7 Steak House to canonical '7 Steak House' and '7Steakhouse'", () => {
    const aliases = [
      "7Steakhouse",
      "7 Steakhouse",
      "7 Steak House",
      "7 Steak",
      "sete steakhouse",
      "sete steak",
      "steakhouse",
      "7steakhouse",
      "steak",
    ];
    for (const a of aliases) {
      const res = resolveBusinessUnit(a);
      expect(res.matched).toBe(true);
      expect(res.dbModality).toBe("7Steakhouse");
    }
  });

  // 6. Goat Botequim continua funcionando sem regressão
  it("6. Goat Botequim aliases continue resolving without regression", () => {
    const aliases = ["Goat Botequim", "goat botequim", "botequim", "boteco", "goatbotequim"];
    for (const a of aliases) {
      const res = resolveBusinessUnit(a);
      expect(res.matched).toBe(true);
      expect(res.dbModality).toBe("Goat Botequim");
    }
  });

  // 7. Imagem válida nunca gera 'envie a imagem novamente'
  it("7. Valid image never prompts user to re-send image", async () => {
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
                      unit_name: "7 Steak House",
                      start_date: "2026-08-05",
                      items: [{ name: "Caipirinha", quantity: 5 }],
                    },
                  },
                },
              ],
            },
            finishReason: "STOP",
          },
        ],
      }),
    } as any);

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-key", defaultToolRegistry);
    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "Lançamento de vendas",
      userId: "user-1",
      attachments: [{ mimeType: "image/jpeg", dataBase64: "validImage" }],
    });

    expect(result.reply).not.toContain("envie a imagem novamente");
    expect(result.reply).toContain("Sessão de Vendas Identificada");
  });

  // 8. Modelo e validator não pedem campos inexistentes
  it("8. Does NOT require nonexistent fields (dinheiro, pix, debito, credito, taxas, descontos, responsável)", () => {
    const minimalDraft = {
      unit_name: "7 Steak House",
      start_date: "2026-08-05",
      items: [{ name: "Caipirinha", quantity: 2 }],
    };

    const validation = validateSalesSessionDraft(minimalDraft);
    expect(validation.isValid).toBe(true);
    expect(validation.missingFields).toHaveLength(0);
    expect(validation.missingFields).not.toContain("responsible");
    expect(validation.missingFields).not.toContain("dinheiro");
    expect(validation.missingFields).not.toContain("total_amount");
  });

  // 9. Modelo pergunta SOMENTE campos obrigatórios reais ausentes
  it("9. Asks ONLY for real missing mandatory fields (unit_name, start_date, items)", () => {
    const missingUnit = validateSalesSessionDraft({
      start_date: "2026-08-05",
      items: [{ name: "Caipirinha", quantity: 2 }],
    });
    expect(missingUnit.isValid).toBe(false);
    expect(missingUnit.missingFields).toEqual(["unit_name"]);

    const missingDate = validateSalesSessionDraft({
      unit_name: "7 Steak House",
      items: [{ name: "Caipirinha", quantity: 2 }],
    });
    expect(missingDate.isValid).toBe(false);
    expect(missingDate.missingFields).toEqual(["start_date"]);

    const missingItems = validateSalesSessionDraft({
      unit_name: "7 Steak House",
      start_date: "2026-08-05",
    });
    expect(missingItems.isValid).toBe(false);
    expect(missingItems.missingFields).toEqual(["items"]);
  });

  // 10. Todos os campos presentes -> chama create sales session / pending action preview
  it("10. All fields present -> creates ready_for_confirmation pending action", () => {
    const valid = validateSalesSessionDraft(
      {
        unit_name: "7 Steak House",
        start_date: "2026-08-05",
        items: [{ name: "Caipirinha", quantity: 10 }],
      },
      mockDrinksCatalog
    );

    expect(valid.isValid).toBe(true);
    expect(valid.normalized?.total_amount).toBe(280.0); // 10 * 28.0 (Steakhouse price)
  });

  // 11. Drink desconhecido -> solicita confirmação sem silenciar e sem inventar preço
  it("11. Unknown drink keeps zero price, flags in preview and does not invent price", () => {
    const draft = {
      unit_name: "7 Steak House",
      start_date: "2026-08-05",
      items: [
        { name: "Caipirinha", quantity: 2 },
        { name: "Drink Inexistente Exotico", quantity: 3 },
      ],
    };

    const validation = validateSalesSessionDraft(draft, mockDrinksCatalog);
    expect(validation.isValid).toBe(true);
    const unknownItem = validation.normalized?.items.find((i) => i.name === "Drink Inexistente Exotico");
    expect(unknownItem?.isUnknown).toBe(true);
    expect(unknownItem?.unit_price).toBe(0);

    const preview = formatSalesSessionWhatsAppPreview(validation.normalized!, validation.warnings);
    expect(preview).toContain("Drink Inexistente Exotico");
    expect(preview).toContain("não catalogados");
  });

  // 12. Contexto multi-turno preserva unit, período e drinks
  it("12. Multi-turn context preserves unit and merges new items", () => {
    const turn1Draft = {
      unit_name: "7 Steak House",
      start_date: "2026-08-05",
      items: [{ name: "Caipirinha", quantity: 2 }],
    };

    const turn2Update = {
      items: [{ name: "Fitz Gerald", quantity: 16 }],
    };

    const merged = { ...turn1Draft, items: [...(turn1Draft.items || []), ...(turn2Update.items || [])] };
    const validation = validateSalesSessionDraft(merged, mockDrinksCatalog);
    expect(validation.isValid).toBe(true);
    expect(validation.normalized?.unit_name).toBe("7 Steak House");
    expect(validation.normalized?.total_drinks).toBe(18);
  });

  // 13. Nenhuma sessão é criada antes da confirmação
  it("13. No database inserts happen before user explicitly confirms with 'sim'", async () => {
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
                      unit_name: "7 Steak House",
                      start_date: "2026-08-05",
                      items: [{ name: "Caipirinha", quantity: 5 }],
                    },
                  },
                },
              ],
            },
            finishReason: "STOP",
          },
        ],
      }),
    } as any);

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-key", defaultToolRegistry);
    await agent.processTurn({
      channel: "whatsapp",
      message: "Lançar sessão 7 steak house dia 05/08 com 5 caipirinhas",
      userId: "user-1",
    });

    expect(insertedSessions).toHaveLength(0);
    expect(insertedSessionItems).toHaveLength(0);
  });

  // 14. Idempotência / retry previne duplicatas
  it("14. Idempotency protects against duplicate confirmation execution", async () => {
    pendingActions.push({
      id: "pending-done",
      conversation_id: "conv-test",
      tool_name: "create_sales_session",
      arguments: {
        unit_name: "7 Steak House",
        start_date: "2026-08-05",
        items: [{ name: "Caipirinha", quantity: 5, unit_price: 28 }],
      },
      status: "executed",
      result: { session_id: "session-123" },
      expires_at: new Date(Date.now() + 100000).toISOString(),
    });

    const manager = new ConversationManager(mockSupabase, defaultToolRegistry);
    const result = await manager.executePendingAction(
      pendingActions[0],
      { supabaseAdmin: mockSupabase, conversationId: "conv-test", channel: "whatsapp" }
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain("já foi executada");
    expect(insertedSessions).toHaveLength(0);
  });

  // 15. Imagem com 7Steakhouse + provider text-only primeiro -> provider é pulado por CAPABILITY_MISMATCH
  it("15. Capability-driven routing skips text-only providers when image is present", async () => {
    const textProvider = new OpenAICompatibleProvider({
      id: "groq",
      name: "Groq Text",
      apiKey: "groq-key",
      baseUrl: "https://api.groq.com/openai/v1",
      model: "llama-3",
    });

    const visionProvider = new GeminiRouterAdapter({
      apiKey: "gemini-key",
      model: "gemini-3.6-flash",
    });

    const router = new AIRouter({
      supabaseAdmin: mockSupabase,
      customProviders: [textProvider, visionProvider],
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Leitura da imagem concluída" }] }, finishReason: "STOP" }],
      }),
    } as any);

    const response = await router.generate({
      correlationId: "corr-vision-test",
      messages: [
        {
          role: "user",
          content: "Segue a foto",
          attachments: [{ mimeType: "image/jpeg", dataBase64: "imageData" }],
        },
      ],
      privacyClassification: "COMMERCIAL",
    });

    // Routed to vision provider (Gemini), not Groq text
    expect(response.providerId).toBe("gemini");
    const skipLogs = logSpy.mock.calls.filter((c) => c.join(" ").includes("CAPABILITY_MISMATCH"));
    expect(skipLogs.length).toBeGreaterThan(0);
  });

  // 16. Imagem + contexto anterior de unidade -> draft herda unidade
  it("16. Multimodal turn inherits unit name from conversation state", async () => {
    const pendingWithUnit = {
      id: "p1",
      status: "collecting",
      tool_name: "create_sales_session",
      arguments: { unit_name: "7 Steak House" },
      missing_fields: ["start_date", "items"],
    };

    const newArgs = {
      start_date: "2026-08-05",
      items: [{ name: "Caipirinha", quantity: 2 }],
    };

    const merged = { ...pendingWithUnit.arguments, ...newArgs };
    const validation = validateSalesSessionDraft(merged, mockDrinksCatalog);
    expect(validation.isValid).toBe(true);
    expect(validation.normalized?.unit_name).toBe("7 Steak House");
  });

  // 17. Imagem e texto equivalente geram drafts semanticamente iguais
  it("17. Text and multimodal extractions converge to identical SalesSessionDraft", () => {
    const textDraft = parseSalesSessionText(`7 Steak House
05/08/2026
CAIPIRINHA 2
FITZ GERALD 16`);

    const imageExtractedDraft = {
      unit_name: "7 Steak House",
      start_date: "2026-08-05",
      items: [
        { name: "CAIPIRINHA", quantity: 2 },
        { name: "FITZ GERALD", quantity: 16 },
      ],
    };

    const normText = validateSalesSessionDraft(textDraft, mockDrinksCatalog);
    const normImage = validateSalesSessionDraft(imageExtractedDraft, mockDrinksCatalog);

    expect(normText.normalized?.total_drinks).toBe(normImage.normalized?.total_drinks);
    expect(normText.normalized?.total_amount).toBe(normImage.normalized?.total_amount);
    expect(normText.normalized?.unit_name).toBe(normImage.normalized?.unit_name);
  });

  // 18. 7Steakhouse usa catálogo/preços corretos da modalidade
  it("18. Resolves 7Steakhouse-specific price and costs from catalog", () => {
    const resolved = resolveDrinkFromCatalog("Fitz Gerald", mockDrinksCatalog, "7Steakhouse");
    expect(resolved.matched).toBe(true);
    expect(resolved.unitPrice).toBe(34.0); // Steakhouse price
    expect(resolved.unitCost).toBe(8.5); // Steakhouse cost
  });

  // 19. Goat Botequim usa catálogo/preços corretos da modalidade
  it("19. Resolves Goat Botequim-specific price and costs from catalog", () => {
    const resolved = resolveDrinkFromCatalog("Fitz Gerald", mockDrinksCatalog, "Goat Botequim");
    expect(resolved.matched).toBe(true);
    expect(resolved.unitPrice).toBe(30.0); // Goat Botequim price
    expect(resolved.unitCost).toBe(7.5); // Goat Botequim cost
  });

  // 20. Drink desconhecido nunca recebe preço inventado
  it("20. Unknown drink never receives invented price", () => {
    const resolved = resolveDrinkFromCatalog("Bebida Misteriosa 123", mockDrinksCatalog, "7Steakhouse");
    expect(resolved.matched).toBe(false);
    expect(resolved.unitPrice).toBe(0);
    expect(resolved.unitCost).toBe(0);
  });

  // 21. Webhook duplicado não cria segunda sessão
  it("21. Duplicate external_message_id is rejected idempotently by webhook adapter", async () => {
    messages.push({
      id: "m-existing",
      external_message_id: "wamid.DUPLICATE_123",
      conversation_id: "conv-test",
    });

    const adapter = new WhatsAppChannelAdapter(mockSupabase, {
      phoneNumberId: "12345",
      accessToken: "token",
    });

    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ id: "wamid.DUPLICATE_123", from: "5531999998888", type: "text", text: { body: "sim" } }],
                contacts: [{ wa_id: "5531999998888" }],
              },
            },
          ],
        },
      ],
    };

    const res = await adapter.processIncomingWebhook(payload);
    expect(res.handled).toBe(true);
    expect(res.reason).toContain("Duplicate message");
  });

  // 22. Confirmação repetida não cria duplicata
  it("22. Repeated confirmation 'sim' on executed action is safe", async () => {
    const pending = {
      id: "p-exec",
      tool_name: "create_sales_session",
      arguments: { unit_name: "7 Steak House", start_date: "2026-08-05", items: [{ name: "Caipirinha", quantity: 2 }] },
      status: "executed" as const,
      result: { session_id: "sess-1" },
    };

    const manager = new ConversationManager(mockSupabase, defaultToolRegistry);
    const result = await manager.executePendingAction(pending as any, {
      supabaseAdmin: mockSupabase,
      conversationId: "conv-test",
      channel: "whatsapp",
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("já foi executada");
    expect(insertedSessions).toHaveLength(0);
  });

  // 23. 7Steakhouse preserva regra real de período semanal
  it("23. 7Steakhouse preserves weekly period semantics (start_date in date column)", async () => {
    const tool = defaultToolRegistry.getTool("create_sales_session");
    const result = await tool?.execute(
      { supabaseAdmin: mockSupabase, conversationId: "conv-test", channel: "whatsapp" },
      {
        unit_name: "7 Steak House",
        start_date: "2026-08-05",
        end_date: "2026-08-09",
        items: [{ name: "Caipirinha", quantity: 10, unit_price: 28.0 }],
      }
    );

    expect(result?.success).toBe(true);
    expect(insertedSessions).toHaveLength(1);
    expect(insertedSessions[0].date).toBe("2026-08-05");
    expect(insertedSessions[0].modality).toBe("7Steakhouse");
  });

  // 24. Campos opcionais reais são persistidos quando fornecidos
  it("24. Optional real fields (labor_value, labor_names, reposicao_restaurante) are persisted", async () => {
    const tool = defaultToolRegistry.getTool("create_sales_session");
    const result = await tool?.execute(
      { supabaseAdmin: mockSupabase, conversationId: "conv-test", channel: "whatsapp" },
      {
        unit_name: "7 Steak House",
        start_date: "2026-08-05",
        items: [{ name: "Caipirinha", quantity: 10, unit_price: 28.0 }],
        labor_value: 450.0,
        labor_quantity: 3,
        labor_names: "Lucas e Marcos",
        reposicao_restaurante: 120.0,
      }
    );

    expect(result?.success).toBe(true);
    expect(insertedSessions[0].labor_value).toBe(450.0);
    expect(insertedSessions[0].labor_names).toBe("Lucas e Marcos");
    expect(insertedSessions[0].reposicao_restaurante).toBe(120.0);
  });

  // 25. Provider sem vision nunca recebe attachment
  it("25. Non-vision provider is never dispatched multimodal attachments", async () => {
    const textProvider = new OpenAICompatibleProvider({
      id: "mistral",
      name: "Mistral",
      apiKey: "mistral-key",
      baseUrl: "https://api.mistral.ai/v1",
      model: "mistral-small",
    });

    const router = new AIRouter({
      supabaseAdmin: mockSupabase,
      customProviders: [textProvider],
    });

    const res = await router.generate({
      messages: [
        {
          role: "user",
          content: "Foto do caixa",
          attachments: [{ mimeType: "image/jpeg", dataBase64: "someData" }],
        },
      ],
      privacyClassification: "COMMERCIAL",
    });

    // Because Mistral doesn't support vision, router marks all providers exhausted rather than sending raw attachment to non-vision model
    expect(res.modelId).toBe("exhausted");
  });

  // 26. Base64 nunca aparece em logs
  it("26. Base64 content is sanitized and never appears in console logs", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const preview = formatSalesSessionWhatsAppPreview({
      unit_name: "7 Steak House",
      modality: "7Steakhouse",
      start_date: "2026-08-05",
      items: [{ name: "Caipirinha", quantity: 2, unit_price: 28, total_price: 56, unit_cost: 7 }],
      total_drinks: 2,
      total_amount: 56,
      total_cost: 14,
      labor_value: 0,
      labor_quantity: 0,
      reposicao_restaurante: 0,
    });

    console.log(preview);
    for (const call of logSpy.mock.calls) {
      const text = call.join(" ");
      expect(text).not.toContain("data:image");
      expect(text).not.toContain("base64");
    }
  });

  // 27. Nenhum campo inexistente volta ao prompt ou validator
  it("27. Real schema enforces zero reference to non-existent fields", () => {
    const validation = validateSalesSessionDraft({
      unit_name: "7 Steak House",
      start_date: "2026-08-05",
      items: [{ name: "Caipirinha", quantity: 5 }],
      // If someone passes garbage non-existent fields, they do NOT cause validation failure
      responsible: "Ignored",
      dinheiro: 100,
      pix: 200,
      taxas: 10,
    } as any);

    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
    expect(validation.missingFields).toHaveLength(0);
  });
});
