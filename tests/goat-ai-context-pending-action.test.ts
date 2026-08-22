import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoatAIGeminiAgent } from "../supabase/functions/_shared/goat-ai/agent/gemini-agent";
import { ConversationManager } from "../supabase/functions/_shared/goat-ai/conversation/manager";
import { GoatAIToolRegistry, defaultToolRegistry } from "../supabase/functions/_shared/goat-ai/tools/registry";
import { WhatsAppChannelAdapter } from "../supabase/functions/_shared/goat-ai/channel/whatsapp-adapter";
import { parseSalesSessionText, validateSalesSessionDraft } from "../supabase/functions/_shared/goat-ai/validators/sales-session-validator";

describe("Goat AI - Context Management, State Machine & Pending Actions on WhatsApp", () => {
  let mockSupabase: any;
  let conversations: any[];
  let messages: any[];
  let pendingActions: any[];
  let insertedSessions: any[];
  let insertedSessionItems: any[];
  let userMessagingAccounts: any[];
  let profiles: any[];
  let drinksCatalog: any[];
  let toolRegistry: GoatAIToolRegistry;

  beforeEach(() => {
    vi.restoreAllMocks();
    conversations = [];
    messages = [];
    pendingActions = [];
    insertedSessions = [];
    insertedSessionItems = [];
    toolRegistry = defaultToolRegistry;

    userMessagingAccounts = [
      {
        id: "acc-jhansen",
        user_id: "user-jhansen-123",
        display_name: "Jhansen Sócio",
        verified: true,
        external_user_id: "5531999998888",
        phone_number: "+5531999998888",
        provider: "whatsapp",
      },
    ];

    profiles = [
      {
        user_id: "user-jhansen-123",
        display_name: "Jhansen Sócio",
        email: "jhansen@goatbar.com.br",
        role: "socio",
      },
    ];

    drinksCatalog = [
      {
        id: "drink-caipirinha",
        nome: "Caipirinha",
        custo_unitario: 5.0,
        modality_config: {
          steakhouse: { price: 28.0, cost: 7.0 },
          goatbotequim: { price: 24.0, cost: 6.0 },
        },
      },
      {
        id: "drink-fitzgerald",
        nome: "Fitz Gerald",
        custo_unitario: 6.5,
        modality_config: {
          steakhouse: { price: 34.0, cost: 8.5 },
          goatbotequim: { price: 30.0, cost: 7.5 },
        },
      },
      {
        id: "drink-aperol",
        nome: "Aperol Spritz",
        custo_unitario: 8.0,
        modality_config: {
          steakhouse: { price: 36.0, cost: 9.0 },
          goatbotequim: { price: 32.0, cost: 8.0 },
        },
      },
    ];

    const createQueryBuilder = (table: string) => {
      let currentOp = "select";
      let updateData: any = null;
      let insertData: any = null;
      const filters: { col: string; val: any; type: string }[] = [];

      const builder: any = {
        select: vi.fn(() => {
          currentOp = "select";
          return builder;
        }),
        insert: vi.fn((payload: any) => {
          currentOp = "insert";
          insertData = payload;
          if (table === "ai_conversations") {
            const conv = {
              id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ...payload,
            };
            conversations.push(conv);
            insertData = conv;
          } else if (table === "ai_messages") {
            const msg = {
              id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              created_at: new Date().toISOString(),
              ...payload,
            };
            messages.push(msg);
            insertData = msg;
          } else if (table === "ai_pending_actions") {
            const p = {
              id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ...payload,
            };
            pendingActions.push(p);
            insertData = p;
          } else if (table === "financial_sessions") {
            const s = {
              id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              created_at: new Date().toISOString(),
              ...payload,
            };
            insertedSessions.push(s);
            insertData = s;
          } else if (table === "financial_session_items") {
            const items = Array.isArray(payload) ? payload : [payload];
            insertedSessionItems.push(...items);
            insertData = items;
          }
          return builder;
        }),
        update: vi.fn((payload: any) => {
          currentOp = "update";
          updateData = payload;
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
        gt: vi.fn((col: string, val: any) => {
          filters.push({ col, val, type: "gt" });
          return builder;
        }),
        or: vi.fn(() => builder),
        order: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        single: vi.fn(async () => {
          if (insertData) return { data: insertData, error: null };
          if (table === "ai_conversations") return { data: conversations[conversations.length - 1] || null, error: null };
          if (table === "ai_messages") return { data: messages[messages.length - 1] || null, error: null };
          if (table === "ai_pending_actions") return { data: pendingActions[pendingActions.length - 1] || null, error: null };
          if (table === "financial_sessions") return { data: insertedSessions[insertedSessions.length - 1] || null, error: null };
          return { data: null, error: null };
        }),
        maybeSingle: vi.fn(async () => {
          if (table === "user_messaging_accounts") {
            const found = userMessagingAccounts[0] || null;
            return { data: found, error: null };
          }
          if (table === "profiles") {
            const found = profiles[0] || null;
            return { data: found, error: null };
          }
          if (table === "ai_conversations") {
            const found = conversations.slice().reverse().find((c) => {
              return filters.every((f) => {
                if (f.type === "eq") return c[f.col] === f.val;
                if (f.type === "in") return f.val.includes(c[f.col]);
                return true;
              });
            });
            return { data: found || null, error: null };
          }
          if (table === "ai_pending_actions") {
            const found = pendingActions.slice().reverse().find((p) => {
              return filters.every((f) => {
                if (f.type === "eq") return p[f.col] === f.val;
                if (f.type === "in") return f.val.includes(p[f.col]);
                return true;
              });
            });
            return { data: found || null, error: null };
          }
          if (table === "ai_messages") {
            const found = messages.find((m) => {
              return filters.every((f) => f.type === "eq" ? m[f.col] === f.val : true);
            });
            return { data: found || null, error: null };
          }
          return { data: null, error: null };
        }),
        then: (resolve: any) => {
          if (currentOp === "select") {
            if (table === "drinks") return Promise.resolve({ data: drinksCatalog, error: null }).then(resolve);
            if (table === "ai_messages") return Promise.resolve({ data: messages, error: null }).then(resolve);
            if (table === "drink_aliases") return Promise.resolve({ data: [], error: null }).then(resolve);
          }
          if (currentOp === "update" && updateData) {
            if (table === "ai_pending_actions") {
              pendingActions.forEach((p) => {
                const match = filters.every((f) => {
                  if (f.type === "eq") return p[f.col] === f.val;
                  if (f.type === "in") return f.val.includes(p[f.col]);
                  return true;
                });
                if (match) Object.assign(p, updateData);
              });
            }
            if (table === "ai_conversations") {
              conversations.forEach((c) => {
                const match = filters.every((f) => {
                  if (f.type === "eq") return c[f.col] === f.val;
                  return true;
                });
                if (match) Object.assign(c, updateData);
              });
            }
          }
          return Promise.resolve({ data: null, error: null }).then(resolve);
        },
      };

      return builder;
    };

    mockSupabase = {
      from: vi.fn((table: string) => createQueryBuilder(table)),
    };
  });

  // 1. Sessão → confirmação → "sim" → lançamento
  it("1. Complete flow: sales session draft -> preview -> 'sim' -> executes launch without re-prompting or losing context", async () => {
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
                      items: [
                        { name: "Caipirinha", quantity: 5 },
                        { name: "Fitz Gerald", quantity: 10 },
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

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-key", toolRegistry);

    // Step 1: User sends sales session data
    const turn1 = await agent.processTurn({
      channel: "whatsapp",
      externalSenderId: "+55 (31) 99999-8888",
      userId: "user-jhansen-123",
      userName: "Jhansen Sócio",
      message: "7 Steak House 05/08: 5 caipirinhas e 10 fitz gerald",
    });

    console.log("TURN1 RESULT:", JSON.stringify(turn1, null, 2));

    expect(turn1.pendingAction).toBeDefined();
    expect(turn1.pendingAction?.status).toBe("ready_for_confirmation");
    expect(turn1.reply).toContain("Sessão de Vendas Identificada");
    expect(turn1.reply).toContain("Posso realizar o lançamento da sessão de vendas?");
    expect(insertedSessions).toHaveLength(0); // Not launched yet!

    // Step 2: User responds "sim"
    const turn2 = await agent.processTurn({
      channel: "whatsapp",
      externalSenderId: "+55 (31) 99999-8888",
      userId: "user-jhansen-123",
      userName: "Jhansen Sócio",
      message: "sim",
    });

    // Verification: Turn 2 executes directly using stored structured arguments!
    expect(turn2.pendingAction).toBeNull();
    expect(turn2.reply).toContain("registrada com sucesso");
    expect(insertedSessions).toHaveLength(1);
    expect(insertedSessions[0].modality).toBe("7Steakhouse");
    expect(insertedSessions[0].date).toBe("2026-08-05");
    expect(insertedSessionItems).toHaveLength(2);
    expect(insertedSessionItems.find((i) => i.drink_name === "Caipirinha")?.quantity).toBe(5);
    expect(insertedSessionItems.find((i) => i.drink_name === "Fitz Gerald")?.quantity).toBe(10);
  });

  // 2. Sessão → "pode lançar" → lançamento
  it("2. Accepts 'pode lançar' and executes launch deterministically", async () => {
    // Populate existing ready_for_confirmation pending action in conversation
    conversations.push({
      id: "conv-pode-lancar",
      channel: "whatsapp",
      external_conversation_id: "whatsapp:5531999998888",
      status: "active",
    });

    pendingActions.push({
      id: "pending-pode-lancar",
      conversation_id: "conv-pode-lancar",
      tool_name: "create_sales_session",
      arguments: {
        unit_name: "7 Steak House",
        start_date: "2026-08-05",
        items: [{ name: "Caipirinha", quantity: 8, unit_price: 28.0 }],
      },
      status: "ready_for_confirmation",
      expires_at: new Date(Date.now() + 1000000).toISOString(),
    });

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-key", toolRegistry);
    const turn = await agent.processTurn({
      channel: "whatsapp",
      externalSenderId: "5531999998888",
      userId: "user-jhansen-123",
      message: "pode lançar",
    });

    expect(turn.pendingAction).toBeNull();
    expect(turn.reply).toContain("registrada com sucesso");
    expect(insertedSessions).toHaveLength(1);
    expect(insertedSessionItems[0].quantity).toBe(8);
  });

  // 3. Sessão → "não" → cancelamento
  it("3. Accepts 'não' or 'cancela' and cancels pending action cleanly", async () => {
    conversations.push({
      id: "conv-cancel",
      channel: "whatsapp",
      external_conversation_id: "whatsapp:5531999998888",
      status: "active",
    });

    pendingActions.push({
      id: "pending-cancel",
      conversation_id: "conv-cancel",
      tool_name: "create_sales_session",
      arguments: {
        unit_name: "7 Steak House",
        start_date: "2026-08-05",
        items: [{ name: "Caipirinha", quantity: 8 }],
      },
      status: "ready_for_confirmation",
      expires_at: new Date(Date.now() + 1000000).toISOString(),
    });

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-key", toolRegistry);
    const turn = await agent.processTurn({
      channel: "whatsapp",
      externalSenderId: "5531999998888",
      userId: "user-jhansen-123",
      message: "não, cancela",
    });

    expect(turn.reply).toContain("Operação cancelada");
    expect(pendingActions[0].status).toBe("cancelled");
    expect(insertedSessions).toHaveLength(0);
  });

  // 4. Sessão → pergunta intermediária → manutenção da pending action → subsequente "sim"
  it("4. Intermediate question maintains pending action intact, answers question, and subsequent 'sim' launches successfully", async () => {
    conversations.push({
      id: "conv-inter",
      channel: "whatsapp",
      external_conversation_id: "whatsapp:5531999998888",
      status: "active",
    });

    pendingActions.push({
      id: "pending-inter",
      conversation_id: "conv-inter",
      tool_name: "create_sales_session",
      arguments: {
        unit_name: "7 Steak House",
        start_date: "2026-08-05",
        items: [{ name: "Caipirinha", quantity: 10, unit_price: 28.0 }],
        total_amount: 280.0,
      },
      summary: "Sessão de Vendas: 10 Caipirinhas (R$ 280,00)",
      status: "ready_for_confirmation",
      expires_at: new Date(Date.now() + 1000000).toISOString(),
    });

    // Gemini mock answering question
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              role: "model",
              parts: [{ text: "O valor total estimado para as 10 Caipirinhas é de R$ 280,00. Posso confirmar o lançamento?" }],
            },
            finishReason: "STOP",
          },
        ],
      }),
    } as any);

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-key", toolRegistry);

    // Turn 1: User asks intermediate question
    const turn1 = await agent.processTurn({
      channel: "whatsapp",
      externalSenderId: "5531999998888",
      userId: "user-jhansen-123",
      message: "qual foi o valor total?",
    });

    expect(turn1.reply).toContain("R$ 280,00");
    expect(turn1.pendingAction).toBeDefined();
    expect(turn1.pendingAction?.status).toBe("ready_for_confirmation");
    expect(insertedSessions).toHaveLength(0); // Not launched yet!

    // Turn 2: User now confirms with "sim"
    const turn2 = await agent.processTurn({
      channel: "whatsapp",
      externalSenderId: "5531999998888",
      userId: "user-jhansen-123",
      message: "sim",
    });

    expect(turn2.pendingAction).toBeNull();
    expect(turn2.reply).toContain("registrada com sucesso");
    expect(insertedSessions).toHaveLength(1);
    expect(insertedSessionItems[0].quantity).toBe(10);
  });

  // 5. Sessão → alteração de draft pré-confirmação ("muda caipirinha para 20") → "sim" executa com o draft alterado
  it("5. Draft modification before confirmation updates draft preview and subsequent 'sim' launches modified values", async () => {
    conversations.push({
      id: "conv-mod",
      channel: "whatsapp",
      external_conversation_id: "whatsapp:5531999998888",
      status: "active",
    });

    pendingActions.push({
      id: "pending-mod",
      conversation_id: "conv-mod",
      tool_name: "create_sales_session",
      arguments: {
        unit_name: "7 Steak House",
        start_date: "2026-08-05",
        items: [{ name: "Caipirinha", quantity: 5, unit_price: 28.0 }],
      },
      status: "ready_for_confirmation",
      expires_at: new Date(Date.now() + 1000000).toISOString(),
    });

    // Model tool call updating draft with 20 caipirinhas
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
                      items: [{ name: "Caipirinha", quantity: 20 }],
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

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-key", toolRegistry);

    // Turn 1: User requests correction
    const turn1 = await agent.processTurn({
      channel: "whatsapp",
      externalSenderId: "5531999998888",
      userId: "user-jhansen-123",
      message: "na verdade foram 20 caipirinhas",
    });

    expect(turn1.reply).toContain("20x Caipirinha");
    expect(turn1.pendingAction?.status).toBe("ready_for_confirmation");
    expect(insertedSessions).toHaveLength(0);

    // Turn 2: User confirms with "pode lançar"
    const turn2 = await agent.processTurn({
      channel: "whatsapp",
      externalSenderId: "5531999998888",
      userId: "user-jhansen-123",
      message: "pode lançar",
    });

    expect(turn2.reply).toContain("registrada com sucesso");
    expect(insertedSessions).toHaveLength(1);
    expect(insertedSessionItems[0].quantity).toBe(20); // Corrected quantity executed!
  });

  // 6. Mensagem enviada segundos depois ainda encontra a mesma sessão e conversa
  it("6. Message sent seconds after turn 1 maintains active session in same conversation", async () => {
    const manager = new ConversationManager(mockSupabase, toolRegistry);
    const conv1 = await manager.getOrCreateConversation("whatsapp", "user-jhansen-123", "+55 (31) 99999-8888");

    await manager.savePendingAction(
      conv1.id,
      "create_sales_session",
      { unit_name: "7 Steak House", start_date: "2026-08-05", items: [{ name: "Caipirinha", quantity: 5 }] },
      [],
      "Preview",
      "ready_for_confirmation"
    );

    // Seconds later: new call for same phone
    const conv2 = await manager.getOrCreateConversation("whatsapp", "user-jhansen-123", "+55 31 99999-8888");
    expect(conv2.id).toBe(conv1.id);

    const pending = await manager.getActivePendingAction(conv2.id);
    expect(pending).not.toBeNull();
    expect(pending?.status).toBe("ready_for_confirmation");
  });

  // 7. Telefone recebido em formatos diferentes resolve para a mesma chave canônica e conversa
  it("7. Phone received in multiple variations (+55 31 99876-1967, 553198761967, 5531998761967) resolves to the exact same conversation", async () => {
    const manager = new ConversationManager(mockSupabase, toolRegistry);

    const conv1 = await manager.getOrCreateConversation("whatsapp", "user-jhansen-123", "+55 (31) 99876-1967");
    const conv2 = await manager.getOrCreateConversation("whatsapp", "user-jhansen-123", "553198761967");
    const conv3 = await manager.getOrCreateConversation("whatsapp", "user-jhansen-123", "5531998761967");

    expect(conv1.id).toBe(conv2.id);
    expect(conv2.id).toBe(conv3.id);
  });

  // 8. Nenhuma ação é executada duas vezes se "sim" for recebido/reprocessado duas vezes
  it("8. Duplicate 'sim' or webhook retry does not execute action twice (idempotency)", async () => {
    const manager = new ConversationManager(mockSupabase, toolRegistry);
    const conv = await manager.getOrCreateConversation("whatsapp", "user-jhansen-123", "5531999998888");

    const pending = await manager.savePendingAction(
      conv.id,
      "create_sales_session",
      { unit_name: "7 Steak House", start_date: "2026-08-05", items: [{ name: "Caipirinha", quantity: 5, unit_price: 28 }] },
      [],
      "Preview",
      "ready_for_confirmation"
    );

    const context = { supabaseAdmin: mockSupabase, conversationId: conv.id, channel: "whatsapp" as const };

    // Execution 1
    const res1 = await manager.executePendingAction(pending, context);
    expect(res1.success).toBe(true);
    expect(insertedSessions).toHaveLength(1);

    // Execution 2 on the now 'executed' action
    const res2 = await manager.executePendingAction(pending, context);
    expect(res2.success).toBe(true);
    expect(res2.message).toContain("já foi executada");
    expect(insertedSessions).toHaveLength(1); // Zero additional inserts!
  });

  // 9. Após execução bem-sucedida, pending_action é encerrada ('executed')
  it("9. After successful execution, pending_action status is 'executed' and getActivePendingAction returns null", async () => {
    const manager = new ConversationManager(mockSupabase, toolRegistry);
    const conv = await manager.getOrCreateConversation("whatsapp", "user-jhansen-123", "5531999998888");

    const pending = await manager.savePendingAction(
      conv.id,
      "create_sales_session",
      { unit_name: "7 Steak House", start_date: "2026-08-05", items: [{ name: "Caipirinha", quantity: 5, unit_price: 28 }] },
      [],
      "Preview",
      "ready_for_confirmation"
    );

    await manager.executePendingAction(pending, { supabaseAdmin: mockSupabase, conversationId: conv.id, channel: "whatsapp" });

    expect(pending.status).toBe("executed");
    const active = await manager.getActivePendingAction(conv.id);
    expect(active).toBeNull();
  });

  // 10. Falha de execução mantém estado recuperável e informa erro ao usuário
  it("10. Execution failure keeps state recoverable in ready_for_confirmation and logs error", async () => {
    const errorToolRegistry = new GoatAIToolRegistry();
    errorToolRegistry.register({
      name: "create_sales_session",
      description: "Fail tool",
      parameters: { type: "object", properties: {} },
      requiresConfirmation: true,
      execute: async () => ({ success: false, error: "Conexão com o banco falhou" }),
    });

    const manager = new ConversationManager(mockSupabase, errorToolRegistry);
    const conv = await manager.getOrCreateConversation("whatsapp", "user-jhansen-123", "5531999998888");

    const pending = await manager.savePendingAction(
      conv.id,
      "create_sales_session",
      { unit_name: "7 Steak House", start_date: "2026-08-05", items: [{ name: "Caipirinha", quantity: 5 }] },
      [],
      "Preview",
      "ready_for_confirmation"
    );

    const res = await manager.executePendingAction(pending, { supabaseAdmin: mockSupabase, conversationId: conv.id, channel: "whatsapp" });

    expect(res.success).toBe(false);
    expect(res.error).toContain("Conexão com o banco falhou");
    expect(pending.status).toBe("ready_for_confirmation"); // Recoverable!
  });

  // 11. Logs seguros com telefone mascarado, correlation_id, pending_action e decisão do resolver
  it("11. Produces secure logs with masked phone number, correlationId and resolver decision", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    conversations.push({
      id: "conv-log",
      channel: "whatsapp",
      external_conversation_id: "whatsapp:5531999998888",
      status: "active",
    });

    pendingActions.push({
      id: "pending-log",
      conversation_id: "conv-log",
      tool_name: "create_sales_session",
      arguments: { unit_name: "7 Steak House", start_date: "2026-08-05", items: [{ name: "Caipirinha", quantity: 5, unit_price: 28 }] },
      status: "ready_for_confirmation",
      expires_at: new Date(Date.now() + 1000000).toISOString(),
    });

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-key", toolRegistry);
    await agent.processTurn({
      correlationId: "corr-sec-test-123",
      channel: "whatsapp",
      externalSenderId: "+55 (31) 99999-8888",
      userId: "user-jhansen-123",
      message: "sim",
    });

    const calls = logSpy.mock.calls.map((c) => c.join(" "));
    const resolverLog = calls.find((c) => c.includes("[GOAT-AI][CONFIRMATION_RESOLVER]"));

    expect(resolverLog).toBeDefined();
    expect(resolverLog).toContain("correlationId=corr-sec-test-123");
    expect(resolverLog).toContain("decision=CONFIRM");
    expect(resolverLog).toContain("phone=5531*****8888"); // Phone is masked!
    expect(resolverLog).not.toContain("+55 (31) 99999-8888"); // Raw phone never logged!

    logSpy.mockRestore();
  });
});
