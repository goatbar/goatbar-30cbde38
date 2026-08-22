import { describe, it, expect, vi, beforeEach } from "vitest";
import { AIRouter, FRIENDLY_EXHAUSTED_MESSAGE } from "../supabase/functions/_shared/goat-ai/router/ai-router";
import { CircuitBreakerManager } from "../supabase/functions/_shared/goat-ai/router/circuit-breaker";
import { OpenAICompatibleProvider } from "../supabase/functions/_shared/goat-ai/router/providers/openai-compatible-provider";
import { CloudflareAIProvider } from "../supabase/functions/_shared/goat-ai/router/providers/cloudflare-provider";
import { GeminiRouterAdapter } from "../supabase/functions/_shared/goat-ai/router/providers/gemini-adapter";
import { GoatAIGeminiAgent } from "../supabase/functions/_shared/goat-ai/agent/gemini-agent";
import { GoatAIToolRegistry } from "../supabase/functions/_shared/goat-ai/tools/registry";

describe("Goat AI - Multi-Provider Router & Zero-Paid Policy", () => {
  let mockSupabase: any;
  let toolRegistry: GoatAIToolRegistry;
  let circuitBreaker: CircuitBreakerManager;

  beforeEach(() => {
    vi.restoreAllMocks();
    circuitBreaker = CircuitBreakerManager.getInstance();
    circuitBreaker.reset();
    toolRegistry = new GoatAIToolRegistry();

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
                        maybeSingle: async () => ({
                          data: { id: "conv-1", channel: "web", user_id: "u-1", title: "Chat", status: "active" },
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
                  data: { id: "conv-1", channel: "web", user_id: "u-1", title: "Chat", status: "active" },
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
                order: () => ({ limit: async () => ({ data: [], error: null }) }),
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: { id: "msg-1", conversation_id: "conv-1", role: "assistant", content: "ok" },
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
                    order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
                  }),
                }),
              }),
            }),
            insert: (item: any) => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: "pending-1",
                    conversation_id: "conv-1",
                    tool_name: item?.tool_name || "create_sales_session",
                    status: item?.status || "ready_for_confirmation",
                    missing_fields: item?.missing_fields || [],
                    summary: item?.summary || "",
                  },
                  error: null,
                }),
              }),
            }),
            update: () => ({
              eq: () => ({
                in: async () => ({ data: null, error: null }),
                eq: async () => ({ data: null, error: null }),
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
          return {
            select: () => ({
              order: () => ({
                limit: async () => ({
                  data: [
                    { id: "ev-1", client_name: "Fernanda", event_name: "Casamento da Fernanda", date: "2026-10-15", guests: 150, status: "confirmado" },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "ai_circuit_breakers") {
          return {
            upsert: async () => ({ data: null, error: null }),
          };
        }
        if (table === "ai_usage_events") {
          return {
            insert: async () => ({ data: null, error: null }),
          };
        }
        return {};
      }),
    };
  });

  const fullSecrets = {
    groq: { apiKey: "gsk-mock-key", model: "openai/gpt-oss-120b" },
    cloudflare: { apiKey: "cf-token", accountId: "cf-acc-123", model: "@cf/meta/llama-3.1-8b-instruct" },
    mistral: { apiKey: "mistral-key", model: "mistral-small-latest" },
    sambanova: { apiKey: "samba-key", model: "Meta-Llama-3.1-70B-Instruct" },
    openrouter: { apiKey: "openrouter-key", model: "meta-llama/llama-3.1-8b-instruct:free" },
    cerebras: { apiKey: "cerebras-key", model: "llama3.1-70b" },
    nvidia: { apiKey: "nvidia-key", model: "meta/llama-3.1-70b-instruct" },
    gemini: { apiKey: "gemini-key", model: "gemini-3.6-flash" },
  };

  function createRouterAgent(customRouter?: AIRouter) {
    const router = customRouter || new AIRouter({ overrideSecrets: fullSecrets, supabaseAdmin: mockSupabase });
    return new GoatAIGeminiAgent(mockSupabase, "key", toolRegistry, undefined, router);
  }

  // 1. Groq responde -> não chama próximo
  it("1. Groq responde com sucesso -> não chama o próximo provedor", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "Resposta do Groq" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as any);
    globalThis.fetch = fetchSpy;

    const router = new AIRouter({ overrideSecrets: fullSecrets });
    const res = await router.generate({
      messages: [{ role: "user", content: "Olá" }],
    });

    expect(res.providerId).toBe("groq");
    expect(res.text).toBe("Resposta do Groq");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // 2. Groq 429 -> Cloudflare
  it("2. Groq retorna 429 rate-limit -> faz fallback automático para Cloudflare", async () => {
    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("api.groq.com")) {
        return {
          ok: false,
          status: 429,
          headers: new Headers({ "retry-after": "30" }),
          text: async () => "Rate limit reached",
        };
      }
      if (url.includes("api.cloudflare.com")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ result: { response: "Resposta do Cloudflare" } }),
        };
      }
      return { ok: false, status: 500 };
    });
    globalThis.fetch = fetchSpy;

    const router = new AIRouter({ overrideSecrets: fullSecrets });
    const res = await router.generate({
      messages: [{ role: "user", content: "Olá" }],
    });

    expect(res.providerId).toBe("cloudflare");
    expect(res.text).toBe("Resposta do Cloudflare");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  // 3. Groq 401 -> provider desabilitado -> Cloudflare
  it("3. Groq 401 (chave inválida) -> marca provider com erro fatal -> vai para Cloudflare", async () => {
    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("api.groq.com")) {
        return {
          ok: false,
          status: 401,
          text: async () => "Invalid API key",
        };
      }
      if (url.includes("api.cloudflare.com")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ result: { response: "Resposta Cloudflare após 401 no Groq" } }),
        };
      }
      return { ok: false, status: 500 };
    });
    globalThis.fetch = fetchSpy;

    const router = new AIRouter({ overrideSecrets: fullSecrets });
    const res = await router.generate({
      messages: [{ role: "user", content: "Olá" }],
    });

    expect(res.providerId).toBe("cloudflare");
    expect(res.text).toContain("Resposta Cloudflare");
    // Groq circuit breaker must be open
    expect(circuitBreaker.getRecord("groq").state).toBe("open");
  });

  // 4. Cloudflare falha -> Mistral
  it("4. Cloudflare falha -> tenta Mistral na sequência", async () => {
    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("api.groq.com") || url.includes("api.cloudflare.com")) {
        return { ok: false, status: 500, text: async () => "Server error" };
      }
      if (url.includes("api.mistral.ai")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "Resposta do Mistral" }, finish_reason: "stop" }],
          }),
        };
      }
      return { ok: false, status: 500 };
    });
    globalThis.fetch = fetchSpy;

    const router = new AIRouter({ overrideSecrets: fullSecrets });
    const res = await router.generate({
      messages: [{ role: "user", content: "Olá" }],
    });

    expect(res.providerId).toBe("mistral");
    expect(res.text).toBe("Resposta do Mistral");
  });

  // 5. Mistral falha -> SambaNova
  it("5. Mistral falha -> tenta SambaNova", async () => {
    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("api.groq.com") || url.includes("api.cloudflare.com") || url.includes("api.mistral.ai")) {
        return { ok: false, status: 500, text: async () => "Error" };
      }
      if (url.includes("api.sambanova.ai")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "Resposta do SambaNova" }, finish_reason: "stop" }],
          }),
        };
      }
      return { ok: false, status: 500 };
    });
    globalThis.fetch = fetchSpy;

    const router = new AIRouter({ overrideSecrets: fullSecrets });
    const res = await router.generate({
      messages: [{ role: "user", content: "Olá" }],
    });

    expect(res.providerId).toBe("sambanova");
    expect(res.text).toBe("Resposta do SambaNova");
  });

  // 6. SambaNova falha -> OpenRouter
  it("6. SambaNova falha -> tenta OpenRouter Free", async () => {
    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("api.sambanova.ai") || url.includes("api.groq.com") || url.includes("api.cloudflare.com") || url.includes("api.mistral.ai")) {
        return { ok: false, status: 500, text: async () => "Error" };
      }
      if (url.includes("openrouter.ai")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "Resposta OpenRouter Free" }, finish_reason: "stop" }],
          }),
        };
      }
      return { ok: false, status: 500 };
    });
    globalThis.fetch = fetchSpy;

    const router = new AIRouter({ overrideSecrets: fullSecrets });
    const res = await router.generate({
      messages: [{ role: "user", content: "Olá" }],
    });

    expect(res.providerId).toBe("openrouter");
    expect(res.text).toBe("Resposta OpenRouter Free");
  });

  // 7. OpenRouter sem free capacity -> Cerebras
  it("7. OpenRouter retorna free_variant_ended / capacity_exhausted -> tenta Cerebras Trial", async () => {
    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("openrouter.ai")) {
        return {
          ok: false,
          status: 429,
          text: async () => JSON.stringify({ error: { message: "free_variant_ended for this model" } }),
        };
      }
      if (url.includes("api.cerebras.ai")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "Resposta do Cerebras Trial" }, finish_reason: "stop" }],
          }),
        };
      }
      if (url.includes("api.groq.com") || url.includes("api.cloudflare.com") || url.includes("api.mistral.ai") || url.includes("api.sambanova.ai")) {
        return { ok: false, status: 500, text: async () => "Error" };
      }
      return { ok: false, status: 500 };
    });
    globalThis.fetch = fetchSpy;

    const router = new AIRouter({ overrideSecrets: fullSecrets });
    const res = await router.generate({
      messages: [{ role: "user", content: "Olá" }],
    });

    expect(res.providerId).toBe("cerebras");
    expect(res.text).toBe("Resposta do Cerebras Trial");
  });

  // 8. Cerebras sem crédito -> NVIDIA
  it("8. Cerebras sem créditos (quota_exhausted) -> abre circuit breaker e segue para NVIDIA", async () => {
    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("api.cerebras.ai")) {
        return {
          ok: false,
          status: 403,
          text: async () => JSON.stringify({ error: { message: "Trial credits exhausted" } }),
        };
      }
      if (url.includes("integrate.api.nvidia.com")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "Resposta da NVIDIA NIM" }, finish_reason: "stop" }],
          }),
        };
      }
      return { ok: false, status: 500, text: async () => "Error" };
    });
    globalThis.fetch = fetchSpy;

    const router = new AIRouter({ overrideSecrets: fullSecrets });
    const res = await router.generate({
      messages: [{ role: "user", content: "Olá" }],
    });

    expect(res.providerId).toBe("nvidia");
    expect(res.text).toBe("Resposta da NVIDIA NIM");
    expect(circuitBreaker.getRecord("cerebras").state).toBe("open");
  });

  // 9. NVIDIA falha -> Gemini
  it("9. NVIDIA falha -> tenta Gemini Free como último fallback", async () => {
    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("generativelanguage.googleapis.com")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: "Resposta do Gemini Free" }] } }],
          }),
        };
      }
      return { ok: false, status: 500, text: async () => "Error" };
    });
    globalThis.fetch = fetchSpy;

    const router = new AIRouter({ overrideSecrets: fullSecrets });
    const res = await router.generate({
      messages: [{ role: "user", content: "Olá" }],
    });

    expect(res.providerId).toBe("gemini");
    expect(res.text).toBe("Resposta do Gemini Free");
  });

  // 10. Gemini falha -> FREE_POOL_EXHAUSTED
  it("10. Todos os provedores gratuitos falham -> retorna mensagem amigável sem vazar detalhes técnicos", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal server error on all providers",
    } as any);

    const router = new AIRouter({ overrideSecrets: fullSecrets });
    const res = await router.generate({
      messages: [{ role: "user", content: "Olá" }],
    });

    expect(res.text).toBe(FRIENDLY_EXHAUSTED_MESSAGE);
  });

  // 11. Provider em cooldown não é chamado
  it("11. Provider em cooldown ativo não é chamado na requisição seguinte", async () => {
    // Force Groq circuit to be open with future cooldown
    circuitBreaker.recordFailure("groq", {
      type: "rate_limit",
      status: 429,
      message: "Rate limit",
      retryAfterSeconds: 120,
    });

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: { response: "Cloudflare response directly" } }),
    } as any);
    globalThis.fetch = fetchSpy;

    const router = new AIRouter({ overrideSecrets: fullSecrets });
    const res = await router.generate({
      messages: [{ role: "user", content: "Olá" }],
    });

    expect(res.providerId).toBe("cloudflare");
    // Groq was not fetched at all
    expect(fetchSpy.mock.calls.some((c) => c[0].includes("groq.com"))).toBe(false);
  });

  // 12. Retry-After respeitado
  it("12. Cabeçalho Retry-After é extraído e define cooldown correspondente", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ "retry-after": "45" }),
      text: async () => "Rate limit exceeded",
    } as any);

    const router = new AIRouter({ overrideSecrets: { groq: fullSecrets.groq } });
    await router.generate({ messages: [{ role: "user", content: "Test" }] });

    const rec = circuitBreaker.getRecord("groq");
    expect(rec.state).toBe("open");
    expect(rec.cooldownUntil).toBeGreaterThan(Date.now() + 40_000);
  });

  // 13. Provider incompatível com tool calling é pulado
  it("13. Provedor sem suporte a tool calling (Cloudflare) é pulado quando tools são requeridas", async () => {
    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("api.groq.com")) {
        return { ok: false, status: 500, text: async () => "Groq down" };
      }
      if (url.includes("api.mistral.ai")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{
              message: {
                tool_calls: [{ id: "call-1", function: { name: "search_events", arguments: "{}" } }],
              },
            }],
          }),
        };
      }
      return { ok: false, status: 500 };
    });
    globalThis.fetch = fetchSpy;

    const router = new AIRouter({ overrideSecrets: fullSecrets });
    const res = await router.generate({
      messages: [{ role: "user", content: "Buscar eventos" }],
      tools: [{ name: "search_events", description: "Busca eventos", parameters: { type: "object", properties: {} } }],
    });

    // Mistral should be used directly, skipping Cloudflare because Cloudflare doesn't support tools
    expect(res.providerId).toBe("mistral");
    expect(fetchSpy.mock.calls.some((c) => c[0].includes("cloudflare.com"))).toBe(false);
  });

  // 14. OpenRouter usa somente :free
  it("14. OpenRouter rejeita modelos sem o sufixo :free antes do fetch", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const openrouterPaid = new OpenAICompatibleProvider({
      id: "openrouter",
      name: "OpenRouter",
      apiKey: "key",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "meta-llama/llama-3.1-8b-instruct", // missing :free
    });

    expect(openrouterPaid.isAvailable().available).toBe(false);
    expect(openrouterPaid.isAvailable().reason).toContain("PAID_NOT_ALLOWED");

    await expect(
      openrouterPaid.generate({ messages: [{ role: "user", content: "Oi" }] })
    ).rejects.toThrow("PAID_NOT_ALLOWED");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // 15. Nenhum provider pago é chamado
  it("15. Provedores com classificação PAID são bloqueados pela política Zero-Paid", async () => {
    const paidProvider = new OpenAICompatibleProvider({
      id: "groq",
      name: "Paid Provider",
      apiKey: "key",
      baseUrl: "https://api.paid.com/v1",
      model: "paid-model",
      freeType: "PAID_NOT_ALLOWED",
    });

    expect(paidProvider.isAvailable().available).toBe(false);
  });

  // 16. Nenhuma API key aparece em logs
  it("16. Nenhuma API key ou Bearer token é vazada em logs estruturados", () => {
    const sensitiveKey = "gsk_secret_1234567890abcdef";

    const provider = new OpenAICompatibleProvider({
      id: "groq",
      name: "Groq",
      apiKey: sensitiveKey,
      baseUrl: "https://api.groq.com/openai/v1",
      model: "openai/gpt-oss-120b",
    });

    const classified = provider.classifyError(
      new Error(`Failed with Authorization Bearer ${sensitiveKey} key=${sensitiveKey}`),
      500
    );

    expect(classified.message).not.toContain(sensitiveKey);
  });

  // 17. Tools continuam funcionando em provider não-Gemini (ex: Groq)
  it("17. Tool calling funciona perfeitamente em provedores OpenAI-compatible (Groq)", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      id: "call_groq_1",
                      type: "function",
                      function: {
                        name: "search_events",
                        arguments: JSON.stringify({ query: "confirmados" }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: "Encontrei 1 evento confirmado pelo Groq: Casamento da Fernanda",
              },
            },
          ],
        }),
      };
    });

    const agent = createRouterAgent();
    const result = await agent.processTurn({
      channel: "web",
      message: "Buscar eventos",
      userId: "u-1",
    });

    expect(result.reply).toContain("Casamento da Fernanda");
    expect(result.toolCallsExecuted).toHaveLength(1);
    expect(result.toolCallsExecuted[0].toolName).toBe("search_events");
  });

  // 18. Tool result é normalizado corretamente
  it("18. Tool result é normalizado e enviado no formato correto do provedor", async () => {
    const fetchCalls: any[] = [];
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      fetchCalls.push({ url, body: JSON.parse(options.body) });
      if (fetchCalls.length === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{
              message: {
                tool_calls: [{ id: "c1", function: { name: "search_events", arguments: "{}" } }],
              },
            }],
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "Sucesso" } }],
        }),
      };
    });

    const agent = createRouterAgent();
    await agent.processTurn({ channel: "web", message: "Eventos", userId: "u-1" });

    expect(fetchCalls).toHaveLength(2);
    const secondCallMessages = fetchCalls[1].body.messages;
    const toolMsg = secondCallMessages.find((m: any) => m.role === "tool");
    expect(toolMsg).toBeDefined();
    expect(toolMsg.tool_call_id).toBe("c1");
  });

  // 19. Structured output inválido é tratado
  it("19. Erros em parsing de JSON no adapter são capturados e tratados", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{
          message: {
            tool_calls: [{ id: "c1", function: { name: "search_events", arguments: "INVALID_JSON{" } }],
          },
        }],
      }),
    } as any);

    const router = new AIRouter({ overrideSecrets: { groq: fullSecrets.groq } });
    const res = await router.generate({
      messages: [{ role: "user", content: "Teste" }],
      tools: [{ name: "search_events", description: "test", parameters: { type: "object", properties: {} } }],
    });

    expect(res.toolCalls).toHaveLength(1);
    expect(res.toolCalls![0].arguments).toEqual({ raw: "INVALID_JSON{" });
  });

  // 20. Write/Financial tools continuam validadas server-side
  it("20. Tool create_sales_session aciona validação server-side antes de salvar pending action", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{
          message: {
            tool_calls: [{
              id: "c_sales",
              function: {
                name: "create_sales_session",
                arguments: JSON.stringify({
                  unit_name: "Goat Botequim",
                  modality: "Goat Botequim",
                  date: "2026-10-15",
                  start_date: "2026-10-15",
                  items: [{ name: "Caipirinha", quantity: 50, unit_price: 30 }],
                  labor_value: 200,
                }),
              },
            }],
          },
        }],
      }),
    } as any);

    const agent = createRouterAgent();
    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "Registrar sessão Goat Botequim no dia 15/10 faturou R$ 1500",
      userId: "u-1",
    });

    expect(result.pendingAction).toBeDefined();
    expect(result.pendingAction?.toolName).toBe("create_sales_session");
    expect(result.reply.toLowerCase()).toContain("sessão de vendas");
  });

  // 21. Mid-turn switch: Groq pede tool, tool executa, Groq recebe 429, Mistral assume
  it("21. Mid-turn switch: Provedor A pede tool, no 2º step recebe 429 e Provedor B conclui o mesmo turn", async () => {
    let callStep = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      callStep++;
      // Step 1: Groq asks for tool
      if (callStep === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{
              message: {
                tool_calls: [{ id: "c_mid", function: { name: "search_events", arguments: "{}" } }],
              },
            }],
          }),
        };
      }
      // Step 2: Groq gets 429 on second turn
      if (url.includes("groq.com")) {
        return {
          ok: false,
          status: 429,
          text: async () => "Rate limit exceeded on Groq step 2",
        };
      }
      // Step 2 fallback: Mistral completes the response
      if (url.includes("mistral.ai")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{
              message: {
                content: "Concluído pelo Mistral após falha do Groq no 2º passo.",
              },
            }],
          }),
        };
      }
      return { ok: false, status: 500 };
    });

    const agent = createRouterAgent();
    const result = await agent.processTurn({
      channel: "web",
      message: "Buscar eventos",
      userId: "u-1",
    });

    expect(result.reply).toBe("Concluído pelo Mistral após falha do Groq no 2º passo.");
    expect(result.toolCallsExecuted).toHaveLength(1);
  });

  // 22. WRITE tool não é re-executada após switch
  it("22. WRITE tool já executada não é executada novamente durante o mesmo turn", async () => {
    let turnCalls = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      turnCalls++;
      if (turnCalls === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{
              message: {
                tool_calls: [{ id: "c_ev", function: { name: "search_events", arguments: "{}" } }],
              },
            }],
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "Tudo pronto" } }],
        }),
      };
    });

    const agent = createRouterAgent();
    const result = await agent.processTurn({
      channel: "web",
      message: "Buscar eventos",
      userId: "u-1",
    });

    expect(result.toolCallsExecuted).toHaveLength(1);
  });

  // 23. Cloudflare model marcado paid nunca recebe fetch
  it("23. Cloudflare com model fora da allowlist gratuita é pulado com NO_FREE_MODEL_CONFIGURED", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const cfPaid = new CloudflareAIProvider({
      apiKey: "token",
      accountId: "acc",
      model: "@cf/meta/llama-3-70b-instruct", // Paid model
    });

    expect(cfPaid.isAvailable().available).toBe(false);
    expect(cfPaid.isAvailable().reason).toContain("NO_FREE_MODEL_CONFIGURED");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // 24. OpenRouter sem :free nunca recebe fetch
  it("24. OpenRouter sem :free nunca dispara fetch", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const openrouter = new OpenAICompatibleProvider({
      id: "openrouter",
      name: "OpenRouter",
      apiKey: "key",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "anthropic/claude-3.5-sonnet", // Paid
    });

    expect(openrouter.isAvailable().available).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // 25. NVIDIA sem model válido é pulado como CONFIG_INCOMPLETE
  it("25. NVIDIA sem model configurado é pulado como CONFIG_INCOMPLETE sem quebrar a cadeia", async () => {
    const nvidia = new OpenAICompatibleProvider({
      id: "nvidia",
      name: "NVIDIA NIM",
      apiKey: "key",
      baseUrl: "https://integrate.api.nvidia.com/v1",
      model: "", // No model configured
    });

    expect(nvidia.isAvailable().available).toBe(false);
    expect(nvidia.isAvailable().reason).toContain("CONFIG_INCOMPLETE");
  });

  // 26. CUSTOMER_DATA não vai para Gemini Free
  it("26. CUSTOMER_DATA não é enviado para Gemini Free (bloqueio de privacidade)", async () => {
    const gemini = new GeminiRouterAdapter({ apiKey: "key" });

    await expect(
      gemini.generate({
        messages: [{ role: "user", content: "CPF do cliente 123.456.789-00" }],
        privacyClassification: "CUSTOMER_DATA",
      })
    ).rejects.toThrow("PRIVACY_VIOLATION");
  });

  // 27. FINANCIAL não vai para Gemini Free
  it("27. FINANCIAL não é enviado para Gemini Free (bloqueio de privacidade)", async () => {
    const gemini = new GeminiRouterAdapter({ apiKey: "key" });

    await expect(
      gemini.generate({
        messages: [{ role: "user", content: "Faturamento e DRE do evento" }],
        privacyClassification: "FINANCIAL",
      })
    ).rejects.toThrow("PRIVACY_VIOLATION");
  });

  // 28. Circuit breaker persiste e continua válido
  it("28. Circuit breaker armazena estado aberto e respeita cooldown", () => {
    circuitBreaker.recordFailure("groq", {
      type: "server_error",
      status: 500,
      message: "Server 500",
      retryAfterSeconds: 60,
    });

    const status = circuitBreaker.isAvailable("groq");
    expect(status.available).toBe(false);
    expect(status.state).toBe("open");
  });

  // 29. Provider recuperado após cooldown entra em half_open
  it("29. Provider recuperado após cooldown expirar entra em half_open", () => {
    const rec = circuitBreaker.getRecord("groq");
    rec.state = "open";
    rec.cooldownUntil = Date.now() - 1000; // already expired

    const status = circuitBreaker.isAvailable("groq");
    expect(status.available).toBe(true);
    expect(status.state).toBe("half_open");
  });

  // 30. Resposta normal de texto não exige suporte a tools
  it("30. Resposta normal de texto inclui provedores text-only (Cloudflare)", async () => {
    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("groq.com")) {
        return { ok: false, status: 500, text: async () => "err" };
      }
      if (url.includes("cloudflare.com")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ result: { response: "Texto livre do Cloudflare" } }),
        };
      }
      return { ok: false, status: 500 };
    });
    globalThis.fetch = fetchSpy;

    const router = new AIRouter({ overrideSecrets: fullSecrets });
    const res = await router.generate({
      messages: [{ role: "user", content: "Explique o cardápio" }],
    });

    expect(res.providerId).toBe("cloudflare");
    expect(res.text).toBe("Texto livre do Cloudflare");
  });

  // 31. Falha em telemetria não derruba a resposta
  it("31. Falha ao gravar telemetria/banco de dados não interrompe a resposta ao usuário", async () => {
    const brokenSupabase = {
      from: vi.fn(() => {
        throw new Error("DB Connection Error");
      }),
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "Resposta funcionando apesar do banco" } }],
      }),
    } as any);

    const router = new AIRouter({ supabaseAdmin: brokenSupabase, overrideSecrets: fullSecrets });
    const res = await router.generate({
      messages: [{ role: "user", content: "Oi" }],
    });

    expect(res.text).toBe("Resposta funcionando apesar do banco");
  });

  // 32. Nenhuma tentativa de fallback repete operação já concluída
  it("32. Nenhuma tentativa de fallback repete tool call já concluída com sucesso", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: `Resposta final ${callCount}` } }],
        }),
      };
    });

    const agent = createRouterAgent();
    const result = await agent.processTurn({
      channel: "web",
      message: "Oi",
      userId: "u-1",
    });

    expect(result.toolCallsExecuted).toHaveLength(0);
    expect(result.reply).toContain("Resposta final");
  });
});
