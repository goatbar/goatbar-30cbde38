import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoatAIGeminiAgent } from "../supabase/functions/_shared/goat-ai/agent/gemini-agent";
import { GoatAIToolRegistry } from "../supabase/functions/_shared/goat-ai/tools/registry";

describe("Goat AI - Gemini Agent End-to-End & Error Handling", () => {
  let mockSupabase: any;
  let toolRegistry: GoatAIToolRegistry;
  let mockConversation: any;
  let mockUserMessage: any;
  let mockAssistantMessage: any;

  beforeEach(() => {
    vi.restoreAllMocks();
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

        return {};
      }),
    };
  });

  const mockPendingAction = null;

  it("5. Gemini responde normalmente gerando resposta conversacional", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: "Olá! Eu sou a GIA. Como posso ajudar com os eventos ou vendas do Goat Bar?" }],
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

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-gemini-key", toolRegistry, "gemini-3.6-flash");
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

    expect(result.reply).toBe("Não consegui processar a resposta com a IA no momento. Sua mensagem foi salva no histórico.");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[GOAT-AI\]\[PROVIDER\]\[ERROR\].*status=400/)
    );
  });

  it("7. Trata erro 401/403 do Gemini registrando chave inválida", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: { message: "API key not valid. Please pass a valid API key." } }),
    } as any);

    const agent = new GoatAIGeminiAgent(mockSupabase, "invalid-key", toolRegistry);
    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "Oi",
      userId: "user-123",
    });

    expect(result.reply).toContain("Não consegui processar");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[GOAT-AI\]\[PROVIDER\]\[ERROR\].*status=403/)
    );
  });

  it("8. Trata erro 429 de quota/rate limit no Gemini", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ error: { message: "Resource has been exhausted (e.g. check quota)." } }),
    } as any);

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-gemini-key", toolRegistry);
    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "Oi",
      userId: "user-123",
    });

    expect(result.reply).toContain("Não consegui processar");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[GOAT-AI\]\[PROVIDER\]\[ERROR\].*status=429/)
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
      expect.stringMatching(/\[GOAT-AI\]\[PROVIDER\]\[ERROR\].*status=500/)
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
      expect.stringMatching(/\[GOAT-AI\]\[PROVIDER\]\[ERROR\].*Timeout/)
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
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("geminiApiKeyConfigured=false")
    );
  });
});
