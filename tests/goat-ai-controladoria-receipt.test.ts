import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoatAIGeminiAgent } from "../supabase/functions/_shared/goat-ai/agent/gemini-agent";
import { GoatAIToolRegistry } from "../supabase/functions/_shared/goat-ai/tools/registry";
import { WhatsAppChannelAdapter } from "../supabase/functions/_shared/goat-ai/channel/whatsapp-adapter";
import {
  validateControladoriaExpenseDraft,
  formatControladoriaExpenseWhatsAppPreview,
  normalizeControladoriaModality,
  normalizeControladoriaCategory,
  normalizeControladoriaPaymentMethod,
  normalizeCurrencyBRL,
  normalizeControladoriaDate,
} from "../supabase/functions/_shared/goat-ai/validators/controladoria-expense-validator";
import { CircuitBreakerManager } from "../supabase/functions/_shared/goat-ai/router/circuit-breaker";

describe("GIA Controladoria Receipt & Expense Integration", () => {
  let mockSupabase: any;
  let toolRegistry: GoatAIToolRegistry;
  let mockConversation: any;
  let savedMessages: any[];
  let savedPendingActions: any[];
  let savedExpenses: any[];
  let savedExpenseItems: any[];
  let savedReceiptLogs: any[];
  let isUserAuthorized: boolean;

  beforeEach(() => {
    vi.restoreAllMocks();
    CircuitBreakerManager.getInstance().reset();
    toolRegistry = new GoatAIToolRegistry();
    isUserAuthorized = true;

    mockConversation = {
      id: "conv-ctrl-1",
      channel: "whatsapp",
      user_id: "user-socio-1",
      external_conversation_id: "5511999998888",
      title: "Conversa com a GIA",
      status: "active",
    };

    savedMessages = [];
    savedPendingActions = [];
    savedExpenses = [];
    savedExpenseItems = [];
    savedReceiptLogs = [];

    mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "user_messaging_accounts") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  or: () => ({
                    maybeSingle: async () => {
                      if (!isUserAuthorized) return { data: null, error: null };
                      return {
                        data: {
                          id: "acc-1",
                          user_id: "user-socio-1",
                          display_name: "Romulo Chaves",
                          verified: true,
                          phone_number: "5511999998888",
                        },
                        error: null,
                      };
                    },
                  }),
                  in: async () => {
                    if (!isUserAuthorized) return { data: [], error: null };
                    return {
                      data: [
                        {
                          id: "acc-1",
                          user_id: "user-socio-1",
                          display_name: "Romulo Chaves",
                          verified: true,
                          phone_number: "5511999998888",
                        },
                      ],
                      error: null,
                    };
                  },
                }),
              }),
            }),
          };
        }

        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    display_name: "Romulo Chaves",
                    email: "romulo@goatbar.com.br",
                  },
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
                        maybeSingle: async () => ({ data: mockConversation, error: null }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
            insert: (data: any) => ({
              select: () => ({
                single: async () => {
                  const conv = { id: "conv-ctrl-1", ...data };
                  mockConversation = conv;
                  return { data: conv, error: null };
                },
              }),
            }),
            update: () => ({
              eq: async () => ({ data: null, error: null }),
            }),
          };
        }

        if (table === "ai_messages") {
          return {
            select: () => ({
              eq: (col: string, val: string) => {
                if (col === "external_message_id" && val === "meta_msg_duplicate_123") {
                  return {
                    maybeSingle: async () => ({ data: { id: "existing-msg-123" }, error: null }),
                  };
                }
                return {
                  order: () => ({
                    limit: async () => ({ data: [...savedMessages], error: null }),
                  }),
                  maybeSingle: async () => ({ data: null, error: null }),
                };
              },
            }),
            insert: (data: any) => ({
              select: () => ({
                single: async () => {
                  const msg = { id: `msg-${Date.now()}-${Math.random()}`, ...data };
                  savedMessages.push(msg);
                  return { data: msg, error: null };
                },
              }),
            }),
          };
        }

        if (table === "ai_pending_actions") {
          return {
            select: () => ({
              eq: () => ({
                in: (col: string, vals: string[]) => ({
                  gt: () => ({
                    order: () => ({
                      limit: () => ({
                        maybeSingle: async () => {
                          const active = savedPendingActions
                            .filter((p) => vals.includes(p.status))
                            .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))[0];
                          return { data: active || null, error: null };
                        },
                      }),
                    }),
                  }),
                }),
                maybeSingle: async () => {
                  const p = savedPendingActions[0] || null;
                  return { data: p, error: null };
                },
              }),
            }),
            insert: (data: any) => ({
              select: () => ({
                single: async () => {
                  const action = {
                    id: `pending-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                    created_at: new Date().toISOString(),
                    ...data,
                  };
                  savedPendingActions.unshift(action);
                  return { data: action, error: null };
                },
              }),
            }),
            update: (updateData: any) => ({
              eq: (col: string, val: string) => {
                const target = savedPendingActions.find((p) => p.id === val);
                if (target) {
                  Object.assign(target, updateData);
                }
                return {
                  in: (statusCol: string, statusVals: string[]) => ({
                    select: () => ({
                      maybeSingle: async () => {
                        if (target && statusVals.includes(target.status || updateData.status)) {
                          return { data: target, error: null };
                        }
                        return { data: target, error: null };
                      },
                    }),
                  }),
                  select: () => ({
                    single: async () => ({ data: target, error: null }),
                    maybeSingle: async () => ({ data: target, error: null }),
                  }),
                };
              },
            }),
          };
        }

        if (table === "financial_expenses") {
          return {
            select: () => ({
              contains: (col: string, val: any) => ({
                limit: async () => {
                  if (val.operation_id) {
                    const match = savedExpenses.filter(
                      (e) => e.ocr_metadata?.operation_id === val.operation_id
                    );
                    return { data: match, error: null };
                  }
                  return { data: [], error: null };
                },
              }),
            }),
            insert: (data: any) => ({
              select: () => ({
                single: async () => {
                  const exp = {
                    id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                    created_at: new Date().toISOString(),
                    ...data,
                  };
                  savedExpenses.push(exp);
                  return { data: exp, error: null };
                },
              }),
            }),
          };
        }

        if (table === "financial_expense_items") {
          return {
            insert: async (items: any[]) => {
              if (Array.isArray(items)) {
                savedExpenseItems.push(...items);
              }
              return { data: items, error: null };
            },
          };
        }

        if (table === "ai_tool_calls") {
          return {
            insert: async (data: any) => ({ data, error: null }),
          };
        }

        if (table === "financial_expense_receipt_logs") {
          return {
            insert: async (log: any) => {
              savedReceiptLogs.push(log);
              return { data: log, error: null };
            },
          };
        }

        return {};
      }),
    };
  });

  // 1. Validator & Deterministic Normalizers Unit Tests
  describe("Deterministic Normalizers & Validator", () => {
    it("1. Normaliza valores monetários BRL com precisão", () => {
      expect(normalizeCurrencyBRL("186,40")).toBe(186.4);
      expect(normalizeCurrencyBRL("R$ 1.250,50")).toBe(1250.5);
      expect(normalizeCurrencyBRL("196.40")).toBe(196.4);
      expect(normalizeCurrencyBRL("0,00")).toBe(0);
      expect(normalizeCurrencyBRL(undefined)).toBe(0);
    });

    it("2. Normaliza modalidades e unidades para o enum real do banco", () => {
      expect(normalizeControladoriaModality("7 Steakhouse").normalized).toBe("Steakhouse");
      expect(normalizeControladoriaModality("7 Steak House").normalized).toBe("Steakhouse");
      expect(normalizeControladoriaModality("Goat Botequim").normalized).toBe("Goatbotequim");
      expect(normalizeControladoriaModality("Botequim").normalized).toBe("Goatbotequim");
      expect(normalizeControladoriaModality("Evento").normalized).toBe("Evento");
      expect(normalizeControladoriaModality("Geral").normalized).toBe("Geral");
      expect(normalizeControladoriaModality("Matriz").normalized).toBe("Geral");
    });

    it("3. Normaliza categorias e formas de pagamento sem quebrar constraints", () => {
      expect(normalizeControladoriaCategory("bebidas e vodka")).toBe("Insumos");
      expect(normalizeControladoriaCategory("limão e gelo")).toBe("Insumos");
      expect(normalizeControladoriaCategory("diária do bartender")).toBe("Equipe");
      expect(normalizeControladoriaCategory("copos descartáveis")).toBe("Operacional");

      // DB check constraint: ('PIX', 'Dinheiro', 'Cartao', 'Transferencia', 'Outros')
      expect(normalizeControladoriaPaymentMethod("Cartão")).toBe("Cartao");
      expect(normalizeControladoriaPaymentMethod("Transferência")).toBe("Transferencia");
      expect(normalizeControladoriaPaymentMethod("PIX")).toBe("PIX");
      expect(normalizeControladoriaPaymentMethod("dinheiro")).toBe("Dinheiro");
    });

    it("4. Valida rascunho completo de despesa e gera prévia formatada", () => {
      const draft = {
        supplier_name: "Atacadão S/A",
        supplier_cnpj: "12345678000190",
        amount: "186,40",
        date: "21/08/2026",
        modality: "7 Steakhouse",
        category: "Insumos",
        payment_method: "PIX",
        items: [
          { product_name: "Limão Cravo", quantity: 10, unit_price: 5.0, total_price: 50.0 },
          { product_name: "Gelo 5kg", quantity: 5, unit_price: 10.0, total_price: 50.0 },
        ],
      };

      const result = validateControladoriaExpenseDraft(draft, { fallbackResponsible: "Romulo Chaves" });
      expect(result.isValid).toBe(true);
      expect(result.normalized?.amount).toBe(186.4);
      expect(result.normalized?.modality).toBe("Steakhouse");
      expect(result.normalized?.payment_method).toBe("PIX");
      expect(result.normalized?.items.length).toBe(2);
      expect(result.normalized?.responsible).toBe("Romulo Chaves");
      expect(result.reviewStatus).toBe("Lido automaticamente");

      const preview = formatControladoriaExpenseWhatsAppPreview(result.normalized!);
      expect(preview).toContain("🧾 *Lançamento de Gasto na Controladoria*");
      expect(preview).toContain("📍 *Unidade/Destino:* 7 Steakhouse");
      expect(preview).toContain("💰 *Valor Total:* *R$ 186,40*");
      expect(preview).toContain("Limão Cravo");
    });

    it("5. Identifica quando falta a unidade (modality) e solicita apenas o campo pendente", () => {
      const draft = {
        supplier_name: "ABC Distribuidora",
        amount: "186,40",
        date: "2026-08-21",
        category: "Insumos",
      };

      const result = validateControladoriaExpenseDraft(draft);
      expect(result.isValid).toBe(false);
      expect(result.missingFields).toContain("modality");
    });

    it("6. Identifica quando falta o valor da nota (amount) com erro", () => {
      const draft = {
        supplier_name: "Supermercado BH",
        date: "2026-08-21",
        modality: "Goat Botequim",
      };

      const result = validateControladoriaExpenseDraft(draft);
      expect(result.isValid).toBe(false);
      expect(result.missingFields).toContain("amount");
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // 2. Multi-turn Agent Flow Tests
  describe("GIA Conversational Multi-turn & Tool Interception", () => {
    it("7. Processa imagem e texto de nota fiscal acionando create_controladoria_expense e pedindo unidade", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: "create_controladoria_expense",
                      args: {
                        supplier_name: "ABC Distribuidora",
                        amount: 186.4,
                        date: "2026-08-21",
                        category: "Insumos",
                        payment_method: "PIX",
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
      const result = await agent.processTurn({
        channel: "whatsapp",
        message: "Preciso lançar uma notinha na controladoria ler a imagem e fazer lançamento de gasto",
        userId: "user-socio-1",
        userName: "Romulo Chaves",
        attachments: [
          {
            mimeType: "image/jpeg",
            dataBase64: "dummy_base64_data",
          },
        ],
      });

      expect(result.reply).toContain("Em qual unidade devo lançar esse gasto?");
      expect(result.pendingAction?.status).toBe("collecting");
      expect(result.pendingAction?.missingFields).toContain("modality");
      expect(savedPendingActions.length).toBe(1);
    });

    it("8. Usuário responde a unidade pendente ('7 Steakhouse') e a GIA gera a prévia de confirmação", async () => {
      // Setup pending action in 'collecting' status
      savedPendingActions.push({
        id: "pending-ctrl-123",
        conversation_id: "conv-ctrl-1",
        tool_name: "create_controladoria_expense",
        status: "collecting",
        arguments: {
          supplier_name: "ABC Distribuidora",
          amount: 186.4,
          date: "2026-08-21",
          category: "Insumos",
          payment_method: "PIX",
        },
        missing_fields: ["modality"],
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      const agent = new GoatAIGeminiAgent(mockSupabase, "mock-key", toolRegistry);
      const result = await agent.processTurn({
        channel: "whatsapp",
        message: "7 Steakhouse",
        userId: "user-socio-1",
        userName: "Romulo Chaves",
      });

      expect(result.reply).toContain("🧾 *Lançamento de Gasto na Controladoria*");
      expect(result.reply).toContain("7 Steakhouse");
      expect(result.reply).toContain("R$ 186,40");
      expect(result.reply).toContain("Posso confirmar o lançamento");
      expect(result.pendingAction?.status).toBe("ready_for_confirmation");
    });

    it("9. Usuário confirma ('sim') e o lançamento é gravado com sucesso no Supabase", async () => {
      // Setup pending action in 'ready_for_confirmation' status
      savedPendingActions.push({
        id: "pending-ctrl-123",
        conversation_id: "conv-ctrl-1",
        tool_name: "create_controladoria_expense",
        status: "ready_for_confirmation",
        arguments: {
          operation_id: "op-exp-test-999",
          supplier_name: "ABC Distribuidora",
          amount: 186.4,
          date: "2026-08-21",
          modality: "Steakhouse",
          category: "Insumos",
          payment_method: "PIX",
          responsible: "Romulo Chaves",
          description: "Compra de insumos na ABC Distribuidora",
        },
        missing_fields: [],
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      const agent = new GoatAIGeminiAgent(mockSupabase, "mock-key", toolRegistry);
      const result = await agent.processTurn({
        channel: "whatsapp",
        message: "sim",
        userId: "user-socio-1",
        userName: "Romulo Chaves",
      });

      expect(result.reply).toContain("Pronto. O gasto de R$ 186,40 (ABC Distribuidora) foi lançado com sucesso na Controladoria.");
      expect(savedExpenses.length).toBe(1);
      expect(savedExpenses[0].modality).toBe("Steakhouse");
      expect(savedExpenses[0].amount).toBe(186.4);
      expect(savedExpenses[0].payment_method).toBe("PIX");
      expect(savedExpenses[0].responsible).toBe("Romulo Chaves");
    });

    it("10. Usuário confirma com 'pode lançar' alternativo", async () => {
      savedPendingActions.push({
        id: "pending-ctrl-456",
        conversation_id: "conv-ctrl-1",
        tool_name: "create_controladoria_expense",
        status: "ready_for_confirmation",
        arguments: {
          operation_id: "op-exp-test-888",
          supplier_name: "Atacadão",
          amount: 350.0,
          date: "2026-08-21",
          modality: "Goatbotequim",
          category: "Insumos",
          payment_method: "Cartao",
          responsible: "Romulo Chaves",
        },
        missing_fields: [],
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      const agent = new GoatAIGeminiAgent(mockSupabase, "mock-key", toolRegistry);
      const result = await agent.processTurn({
        channel: "whatsapp",
        message: "pode lançar",
        userId: "user-socio-1",
        userName: "Romulo Chaves",
      });

      expect(result.reply).toContain("foi lançado com sucesso");
      expect(savedExpenses.length).toBe(1);
      expect(savedExpenses[0].payment_method).toBe("Cartao");
    });

    it("11. Usuário cancela com 'não' ou 'cancela'", async () => {
      savedPendingActions.push({
        id: "pending-ctrl-789",
        conversation_id: "conv-ctrl-1",
        tool_name: "create_controladoria_expense",
        status: "ready_for_confirmation",
        arguments: {
          supplier_name: "Atacadão",
          amount: 350.0,
          date: "2026-08-21",
          modality: "Steakhouse",
        },
        missing_fields: [],
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      const agent = new GoatAIGeminiAgent(mockSupabase, "mock-key", toolRegistry);
      const result = await agent.processTurn({
        channel: "whatsapp",
        message: "cancela",
        userId: "user-socio-1",
      });

      expect(result.reply).toContain("Operação cancelada");
      expect(savedExpenses.length).toBe(0);
      expect(savedPendingActions[0].status).toBe("cancelled");
    });

    it("12. Usuário corrige valor antes da confirmação ('o valor é 196,40')", async () => {
      savedPendingActions.push({
        id: "pending-ctrl-999",
        conversation_id: "conv-ctrl-1",
        tool_name: "create_controladoria_expense",
        status: "ready_for_confirmation",
        arguments: {
          supplier_name: "ABC Distribuidora",
          amount: 186.4,
          date: "2026-08-21",
          modality: "Steakhouse",
          category: "Insumos",
        },
        missing_fields: [],
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      const agent = new GoatAIGeminiAgent(mockSupabase, "mock-key", toolRegistry);
      const result = await agent.processTurn({
        channel: "whatsapp",
        message: "o valor correto é 196,40",
        userId: "user-socio-1",
        userName: "Romulo Chaves",
      });

      expect(result.reply).toContain("R$ 196,40");
      expect(result.reply).toContain("Posso confirmar o lançamento");
      expect(savedExpenses.length).toBe(0); // Ainda não gravou, apenas corrigiu a prévia
    });
  });

  // 3. Idempotency, Concurrency & Security Tests
  describe("Idempotency, Concurrency & Security", () => {
    it("13. Idempotência por operationId: duas confirmações seguidas não criam duas despesas", async () => {
      const operationId = "op-idemp-111";
      savedPendingActions.push({
        id: "pending-idemp-1",
        conversation_id: "conv-ctrl-1",
        tool_name: "create_controladoria_expense",
        status: "ready_for_confirmation",
        arguments: {
          operation_id: operationId,
          supplier_name: "Mercado Municipal",
          amount: 100.0,
          date: "2026-08-21",
          modality: "Steakhouse",
          category: "Insumos",
          responsible: "Romulo Chaves",
        },
        missing_fields: [],
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

      const agent = new GoatAIGeminiAgent(mockSupabase, "mock-key", toolRegistry);

      // Turno 1: Confirmação 1
      const res1 = await agent.processTurn({
        channel: "whatsapp",
        message: "sim",
        userId: "user-socio-1",
        userName: "Romulo Chaves",
      });
      expect(res1.reply).toContain("foi lançado com sucesso");
      expect(savedExpenses.length).toBe(1);

      // Turno 2: Confirmação 2 (usuário mandou 'sim' de novo ou rede duplicou)
      const res2 = await agent.processTurn({
        channel: "whatsapp",
        message: "sim",
        userId: "user-socio-1",
        userName: "Romulo Chaves",
      });

      expect(savedExpenses.length).toBe(1); // Não duplicou!
    });

    it("14. Webhook level deduplication: mesmo messageId da Meta é ignorado", async () => {
      const adapter = new WhatsAppChannelAdapter(mockSupabase, {
        accessToken: "test_token",
        phoneNumberId: "phone_123",
      });

      const body = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: "meta_msg_duplicate_123",
                      from: "5511999998888",
                      type: "text",
                      text: { body: "sim" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const webhookResult = await adapter.processIncomingWebhook(body);
      expect(webhookResult.handled).toBe(true);
      expect(webhookResult.reason).toContain("Duplicate message already processed");
    });

    it("15. Bloqueia usuário não autorizado com mensagem explicativa", async () => {
      isUserAuthorized = false;
      const adapter = new WhatsAppChannelAdapter(mockSupabase, {
        accessToken: "test_token",
        phoneNumberId: "phone_123",
      });

      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true } as any);

      const body = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: "msg_unauth_1",
                      from: "5511900000000",
                      type: "text",
                      text: { body: "Lança essa nota" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const res = await adapter.processIncomingWebhook(body);
      expect(res.handled).toBe(true);
      expect(res.reply).toContain("não está vinculado a uma conta autorizada");
    });
  });

  // 4. End-to-End 4-turn Integration Test (Requirement #14)
  describe("4-Turn Full Integration Flow Simulation", () => {
    it("16. Executa exatamente o fluxo de 4 mensagens e valida que existe EXATAMENTE UMA despesa no banco", async () => {
      const agent = new GoatAIGeminiAgent(mockSupabase, "mock-key", toolRegistry);

      // Turn 1: Usuário manda texto: "Preciso lançar uma notinha na controladoria"
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: "Pode me enviar a foto ou PDF da nota fiscal ou cupom que faço a leitura para você." }],
              },
              finishReason: "STOP",
            },
          ],
        }),
      } as any);

      const turn1 = await agent.processTurn({
        channel: "whatsapp",
        message: "Preciso lançar uma notinha na controladoria",
        userId: "user-socio-1",
        userName: "Romulo Chaves",
      });
      expect(turn1.reply).toContain("Pode me enviar a foto");
      expect(savedExpenses.length).toBe(0);

      // Turn 2: Usuário envia imagem [imagem da nota]
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: "create_controladoria_expense",
                      args: {
                        supplier_name: "Mercadinho São José",
                        amount: 186.4,
                        date: "2026-08-21",
                        category: "Insumos",
                        payment_method: "PIX",
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

      const turn2 = await agent.processTurn({
        channel: "whatsapp",
        message: "Foto enviada",
        userId: "user-socio-1",
        userName: "Romulo Chaves",
        attachments: [
          {
            mimeType: "image/jpeg",
            dataBase64: "base64_nota_fiscal",
          },
        ],
      });
      expect(turn2.reply).toContain("Em qual unidade devo lançar esse gasto?");
      expect(turn2.pendingAction?.status).toBe("collecting");
      expect(savedExpenses.length).toBe(0);

      // Turn 3: Usuário responde a unidade: "7 Steakhouse"
      const turn3 = await agent.processTurn({
        channel: "whatsapp",
        message: "7 Steakhouse",
        userId: "user-socio-1",
        userName: "Romulo Chaves",
      });
      expect(turn3.reply).toContain("🧾 *Lançamento de Gasto na Controladoria*");
      expect(turn3.reply).toContain("7 Steakhouse");
      expect(turn3.reply).toContain("R$ 186,40");
      expect(turn3.reply).toContain("Posso confirmar o lançamento desse gasto");
      expect(turn3.pendingAction?.status).toBe("ready_for_confirmation");
      expect(savedExpenses.length).toBe(0);

      // Turn 4: Usuário confirma: "sim"
      const turn4 = await agent.processTurn({
        channel: "whatsapp",
        message: "sim",
        userId: "user-socio-1",
        userName: "Romulo Chaves",
      });
      expect(turn4.reply).toContain("Pronto. O gasto de R$ 186,40 (Mercadinho São José) foi lançado com sucesso na Controladoria.");

      // Validação final de integridade:
      expect(savedExpenses.length).toBe(1);
      const createdExpense = savedExpenses[0];
      expect(createdExpense.amount).toBe(186.4);
      expect(createdExpense.supplier_name).toBe("Mercadinho São José");
      expect(createdExpense.modality).toBe("Steakhouse");
      expect(createdExpense.category).toBe("Insumos");
      expect(createdExpense.payment_method).toBe("PIX");
      expect(createdExpense.responsible).toBe("Romulo Chaves");
    });
  });
});
