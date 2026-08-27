import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoatAIGeminiAgent } from "../supabase/functions/_shared/goat-ai/agent/gemini-agent";
import { GoatAIToolRegistry } from "../supabase/functions/_shared/goat-ai/tools/registry";
import { CircuitBreakerManager } from "../supabase/functions/_shared/goat-ai/router/circuit-breaker";

describe("Goat AI - Gemini Agent End-to-End & Error Handling", () => {
  let mockSupabase: any;
  let toolRegistry: GoatAIToolRegistry;
  let mockConversation: any;
  let mockUserMessage: any;
  let mockAssistantMessage: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    CircuitBreakerManager.getInstance().reset();
    toolRegistry = new GoatAIToolRegistry();

    mockConversation = {
      id: "conv-test-1",
      channel: "whatsapp",
      user_id: "user-123",
      title: "Conversa com a GIA",
      status: "active",
    };

    mockUserMessage = {
      id: "msg-user-1",
      conversation_id: "conv-test-1",
      role: "user",
      content: "Oi",
      message_type: "text",
    };

    mockAssistantMessage = {
      id: "msg-assistant-1",
      conversation_id: "conv-test-1",
      role: "assistant",
      content: "Olá! Como posso ajudar você hoje?",
      message_type: "text",
    };

    mockSupabase = {
      from: vi.fn((table: string) => {
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
            insert: () => ({
              select: () => ({
                single: async () => ({ data: mockConversation, error: null }),
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
              eq: () => ({
                order: () => ({
                  limit: async () => ({ data: [], error: null }),
                }),
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: async () => ({ data: mockAssistantMessage, error: null }),
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
                        maybeSingle: async () => ({ data: mockPendingAction, error: null }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }

        if (table === "ai_tool_calls") {
          return {
            insert: async () => ({ data: null, error: null }),
          };
        }

        if (table === "events") {
          const data = [
            {
              id: "ev-1",
              client_name: "Fernanda",
              event_name: "Casamento da Fernanda",
              date: "2026-10-15",
              guests: 150,
              status: "confirmado",
            },
            {
              id: "ev-2",
              client_name: "Mariana",
              event_name: "Casamento da Mariana",
              date: "2026-11-20",
              guests: 200,
              status: "confirmado",
            },
          ];
          const builder: any = {
            select: () => builder,
            order: () => builder,
            limit: () => builder,
            ilike: () => builder,
            or: () => builder,
            then: (resolve: (value: unknown) => unknown) =>
              Promise.resolve(resolve({ data, error: null })),
          };
          return builder;
        }

        return {};
      }),
    };
  });

  const mockPendingAction = null;

  it("consulta somente confirmados da mensagem atual, sem chamar Gemini nem limitar silenciosamente", async () => {
    globalThis.fetch = vi.fn();
    const agent = new GoatAIGeminiAgent(
      mockSupabase,
      "mock-gemini-key",
      toolRegistry,
      "gemini-3.6-flash",
    );

    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "Me mande os eventos confirmados",
      userId: "user-123",
      userName: "Romulo Chaves",
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result.toolCallsExecuted).toHaveLength(1);
    expect(result.toolCallsExecuted[0].toolName).toBe("search_events");
    expect(result.toolCallsExecuted[0].arguments).toEqual({
      query: "confirmados",
      status: "confirmed",
    });
    expect(result.reply).toContain("Encontrei 2 evento(s) confirmado(s) no Pipeline");
    expect(result.reply).not.toContain("próximo evento");
  });

  it("5. Gemini responde normalmente gerando resposta conversacional", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: "Olá! Eu sou a GIA. Como posso ajudar com os eventos ou vendas do Goat Bar?",
                },
              ],
            },
            finishReason: "STOP",
          },
        ],
        usageMetadata: {
          promptTokenCount: 120,
          candidatesTokenCount: 25,
        },
      }),
    } as any);

    const agent = new GoatAIGeminiAgent(
      mockSupabase,
      "mock-gemini-key",
      toolRegistry,
      "gemini-3.6-flash",
    );
    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "Oi",
      userId: "user-123",
      userName: "Romulo Chaves",
      userRole: "socio",
    });

    expect(result.reply).toContain("Olá! Eu sou a GIA");
    expect(result.conversationId).toBe("conv-test-1");
  });

  it("6. Trata erro 400 do Gemini sem perder o log detalhado do erro", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: { message: "Invalid JSON payload received." } }),
    } as any);

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-gemini-key", toolRegistry);
    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "Oi",
      userId: "user-123",
      userName: "Romulo Chaves",
    });

    expect(result.reply).toBe(
      "Não consegui processar a resposta com a IA no momento. Sua mensagem foi salva no histórico.",
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[GOAT-AI\]\[PROVIDER\]\[ERROR\].*status=400/),
    );
  });

  it("7. Trata erro 401/403 do Gemini registrando chave inválida", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () =>
        JSON.stringify({ error: { message: "API key not valid. Please pass a valid API key." } }),
    } as any);

    const agent = new GoatAIGeminiAgent(mockSupabase, "invalid-key", toolRegistry);
    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "Oi",
      userId: "user-123",
    });

    expect(result.reply).toContain("Não consegui processar");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[GOAT-AI\]\[PROVIDER\]\[ERROR\].*status=403/),
    );
  });

  it("8. Trata erro 429 de quota/rate limit no Gemini", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () =>
        JSON.stringify({ error: { message: "Resource has been exhausted (e.g. check quota)." } }),
    } as any);

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-gemini-key", toolRegistry);
    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "Oi",
      userId: "user-123",
    });

    expect(result.reply).toContain("Não consegui processar");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[GOAT-AI\]\[PROVIDER\]\[ERROR\].*status=429/),
    );
  });

  it("9. Trata erro 500/indisponibilidade no Gemini", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    } as any);

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-gemini-key", toolRegistry);
    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "Oi",
      userId: "user-123",
    });

    expect(result.reply).toContain("Não consegui processar");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[GOAT-AI\]\[PROVIDER\]\[ERROR\].*status=500/),
    );
  });

  it("10. Trata timeout na chamada do Gemini de forma segura", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    globalThis.fetch = vi.fn().mockRejectedValue(abortError);

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-gemini-key", toolRegistry);
    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "Oi",
      userId: "user-123",
    });

    expect(result.reply).toContain("Não consegui processar");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[GOAT-AI\]\[PROVIDER\]\[ERROR\].*Timeout/),
    );
  });

  it("11. Trata resposta do Gemini vazia ou sem parts de forma graciosa", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [],
      }),
    } as any);

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-gemini-key", toolRegistry);
    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "Oi",
      userId: "user-123",
    });

    expect(result.reply).toContain("Não consegui interpretar a resposta");
  });

  it("12. Trata falta de GEMINI_API_KEY no runtime sem quebrar a execução", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const agent = new GoatAIGeminiAgent(mockSupabase, "", toolRegistry);
    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "Oi",
      userId: "user-123",
    });

    expect(result.reply).toContain("chave GEMINI_API_KEY ausente");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("geminiApiKeyConfigured=false"));
  });

  it("13. Round-trip de Tool Calling: envia functionCall como model e functionResponse como user, NUNCA usando role 'function' ou 'tool'", async () => {
    // Turn 1: Gemini returns functionCall
    const geminiTurn1Response = {
      candidates: [
        {
          content: {
            role: "model",
            parts: [
              {
                functionCall: {
                  name: "search_events",
                  args: { query: "Fernanda" },
                },
              },
            ],
          },
          finishReason: "STOP",
        },
      ],
      usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 20 },
    };

    // Turn 2: Gemini returns final answer after receiving functionResponse
    const geminiTurn2Response = {
      candidates: [
        {
          content: {
            role: "model",
            parts: [
              {
                text: "Encontrei 2 eventos confirmados para os próximos meses: Casamento da Fernanda e Casamento da Mariana.",
              },
            ],
          },
          finishReason: "STOP",
        },
      ],
      usageMetadata: { promptTokenCount: 150, candidatesTokenCount: 35 },
    };

    const fetchCalls: any[] = [];
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      fetchCalls.push({ url, options, body: JSON.parse(options.body) });
      if (fetchCalls.length === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => geminiTurn1Response,
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => geminiTurn2Response,
      };
    });

    const agent = new GoatAIGeminiAgent(
      mockSupabase,
      "mock-gemini-key",
      toolRegistry,
      "gemini-3.6-flash",
    );
    const result = await agent.processTurn({
      channel: "web",
      message: "Buscar o evento da Fernanda",
      userId: "user-123",
      userName: "Romulo Chaves",
    });

    // 1. Agent should execute the tool and complete with final reply
    expect(result.reply).toContain("Encontrei 2 eventos confirmados");
    expect(result.toolCallsExecuted).toHaveLength(1);
    expect(result.toolCallsExecuted[0].toolName).toBe("search_events");

    // 2. Fetch should have been called twice (turn 1 and turn 2)
    expect(fetchCalls).toHaveLength(2);

    const secondPayload = fetchCalls[1].body;
    const rawPayloadJson = JSON.stringify(secondPayload);

    // 3. MUST NOT contain role "function" or role "tool" anywhere in the payload
    expect(rawPayloadJson).not.toContain('"role":"function"');
    expect(rawPayloadJson).not.toContain('"role":"tool"');

    // 4. Second payload contents sequence must be:
    //    [0] user prompt -> [1] model functionCall -> [2] user functionResponse
    const contents = secondPayload.contents;
    expect(contents).toHaveLength(3);

    expect(contents[0].role).toBe("user");
    expect(contents[0].parts[0].text).toContain("Buscar o evento da Fernanda");

    expect(contents[1].role).toBe("model");
    expect(contents[1].parts[0].functionCall.name).toBe("search_events");

    expect(contents[2].role).toBe("user");
    expect(contents[2].parts[0].functionResponse.name).toBe("search_events");
    expect(contents[2].parts[0].functionResponse.response).toBeDefined();
  });
});
