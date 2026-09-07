import { describe, it, expect, vi, beforeEach } from "vitest";
import { AIRouter, FRIENDLY_EXHAUSTED_MESSAGE } from "../supabase/functions/_shared/goat-ai/router/ai-router.ts";
import { CircuitBreakerManager } from "../supabase/functions/_shared/goat-ai/router/circuit-breaker.ts";
import { GoatAIGeminiAgent } from "../supabase/functions/_shared/goat-ai/agent/gemini-agent.ts";
import { GoatAIToolRegistry } from "../supabase/functions/_shared/goat-ai/tools/registry.ts";

describe("GIA - Suíte de Resiliência de Failover e Circuit Breaker (12 Cenários Obrigatórios)", () => {
  let mockSupabase: any;
  let circuitBreaker: CircuitBreakerManager;
  let toolRegistry: GoatAIToolRegistry;

  const testSecrets = {
    groq: { apiKey: "gsk-valid-key", model: "openai/gpt-oss-120b" },
    mistral: { apiKey: "mistral-valid-key", model: "mistral-small-latest" },
    gemini: { apiKey: "gemini-valid-key", model: "gemini-2.0-flash" },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    circuitBreaker = CircuitBreakerManager.getInstance();
    circuitBreaker.reset();
    toolRegistry = new GoatAIToolRegistry();

    mockSupabase = {
      from: vi.fn((table: string) => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: { id: "conv-test", channel: "whatsapp", user_id: "u-test", status: "active" },
                    error: null,
                  }),
                }),
              }),
            }),
            maybeSingle: async () => ({ data: null, error: null }),
            order: () => ({ limit: async () => ({ data: [], error: null }) }),
            in: () => ({ gt: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: async () => ({
              data: { id: "msg-test", conversation_id: "conv-test", role: "assistant", content: "ok" },
              error: null,
            }),
          }),
        }),
        update: () => ({
          eq: async () => ({ data: null, error: null }),
        }),
        upsert: async () => ({ data: null, error: null }),
      })),
    };
  });

  // 1. Groq falha → segundo provider responde
  it("Cenário 1: Groq falha com 500 → Mistral (segundo provider) assume e responde", async () => {
    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("api.groq.com")) {
        return { ok: false, status: 500, text: async () => "Internal Groq Error" };
      }
      if (url.includes("api.mistral.ai")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "Resposta com sucesso do Mistral" }, finish_reason: "stop" }],
          }),
        };
      }
      return { ok: false, status: 500 };
    });
    globalThis.fetch = fetchSpy;

    const router = new AIRouter({ overrideSecrets: testSecrets, supabaseAdmin: mockSupabase });
    const res = await router.generate({
      messages: [{ role: "user", content: "Olá GIA" }],
    });

    expect(res.providerId).toBe("mistral");
    expect(res.text).toBe("Resposta com sucesso do Mistral");
  });

  // 2. Primeiro e segundo falham → terceiro responde
  it("Cenário 2: Primeiro (Groq) e segundo (Mistral) falham → terceiro (Gemini) responde com tools", async () => {
    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("api.groq.com")) {
        return { ok: false, status: 500, text: async () => "Groq Server Error" };
      }
      if (url.includes("api.mistral.ai")) {
        return { ok: false, status: 500, text: async () => "Mistral Server Error" };
      }
      if (url.includes("generativelanguage.googleapis.com")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{
                  functionCall: {
                    name: "search_events",
                    args: { query: "Isidora" },
                  },
                }],
              },
              finishReason: "STOP",
            }],
          }),
        };
      }
      return { ok: false, status: 500 };
    });
    globalThis.fetch = fetchSpy;

    const router = new AIRouter({ overrideSecrets: testSecrets, supabaseAdmin: mockSupabase });
    const res = await router.generate({
      messages: [{ role: "user", content: "Consultar Isidora" }],
      tools: [{ name: "search_events", description: "Busca eventos", parameters: { type: "object", properties: {} } }],
      privacyClassification: "COMMERCIAL",
    });

    expect(res.providerId).toBe("gemini");
    expect(res.toolCalls).toBeDefined();
    expect(res.toolCalls![0].name).toBe("search_events");
    expect(res.toolCalls![0].arguments).toEqual({ query: "Isidora" });
  });

  // 3. 429 → retry / failover correto sem abrir circuito indevidamente
  it("Cenário 3: 429 transitório → tenta failover para o próximo provedor e não abre circuito na primeira ocorrência", async () => {
    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("api.groq.com")) {
        return {
          ok: false,
          status: 429,
          headers: new Headers({ "retry-after": "5" }),
          text: async () => "Rate limit exceeded TPM",
        };
      }
      if (url.includes("api.mistral.ai")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "Mistral assumiu após 429 do Groq" }, finish_reason: "stop" }],
          }),
        };
      }
      return { ok: false, status: 500 };
    });
    globalThis.fetch = fetchSpy;

    const router = new AIRouter({ overrideSecrets: testSecrets, supabaseAdmin: mockSupabase });
    const res = await router.generate({
      messages: [{ role: "user", content: "Mensagem rápida" }],
    });

    expect(res.providerId).toBe("mistral");
    expect(res.text).toBe("Mistral assumiu após 429 do Groq");

    // Groq falhou 1 vez por 429 curto: estado NÃO pode estar open imediatamente
    const groqRec = circuitBreaker.getRecord("groq");
    expect(groqRec.state).toBe("closed");
    expect(groqRec.consecutiveFailures).toBe(1);
  });

  // 4. Timeout → retry / failover limpo
  it("Cenário 4: Timeout na requisição → retry controlado e failover para o provedor seguinte", async () => {
    let groqAttempts = 0;
    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("api.groq.com")) {
        groqAttempts++;
        const abortErr = new Error("The operation was aborted due to timeout");
        abortErr.name = "AbortError";
        throw abortErr;
      }
      if (url.includes("api.mistral.ai")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "Mistral respondeu após timeout do Groq" }, finish_reason: "stop" }],
          }),
        };
      }
      return { ok: false, status: 500 };
    });
    globalThis.fetch = fetchSpy;

    const router = new AIRouter({ overrideSecrets: testSecrets, supabaseAdmin: mockSupabase });
    const res = await router.generate({
      messages: [{ role: "user", content: "Teste de timeout" }],
    });

    // Groq tentou inicial + 1 retry = 2 tentativas
    expect(groqAttempts).toBe(2);
    expect(res.providerId).toBe("mistral");
    expect(res.text).toBe("Mistral respondeu após timeout do Groq");
  });

  // 5. 401/403 → não ficar fazendo retries inúteis
  it("Cenário 5: 401 (chave inválida) e 403 (permissão negada) → pula imediatamente sem retries inúteis", async () => {
    let groqCalls = 0;
    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("api.groq.com")) {
        groqCalls++;
        return {
          ok: false,
          status: 401,
          text: async () => "Invalid API key or unauthorized",
        };
      }
      if (url.includes("api.mistral.ai")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "Mistral ativo imediatamente" }, finish_reason: "stop" }],
          }),
        };
      }
      return { ok: false, status: 500 };
    });
    globalThis.fetch = fetchSpy;

    const router = new AIRouter({ overrideSecrets: testSecrets, supabaseAdmin: mockSupabase });
    const res = await router.generate({
      messages: [{ role: "user", content: "Teste 401" }],
    });

    // 401 não é transiente: NENHUM retry repetido
    expect(groqCalls).toBe(1);
    expect(res.providerId).toBe("mistral");
    // Circuito do Groq deve ser aberto imediatamente por erro fatal
    expect(circuitBreaker.getRecord("groq").state).toBe("open");
  });

  // 6. Modelo inválido / 404 → provider seguinte
  it("Cenário 6: Modelo inexistente (HTTP 404) → falha imediatamente sem retry cego e vai para o seguinte", async () => {
    let groqCalls = 0;
    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("api.groq.com")) {
        groqCalls++;
        return {
          ok: false,
          status: 404,
          text: async () => "Model not found: invalid-model-name",
        };
      }
      if (url.includes("api.mistral.ai")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "Mistral assumiu" }, finish_reason: "stop" }],
          }),
        };
      }
      return { ok: false, status: 500 };
    });
    globalThis.fetch = fetchSpy;

    const router = new AIRouter({ overrideSecrets: testSecrets, supabaseAdmin: mockSupabase });
    const res = await router.generate({
      messages: [{ role: "user", content: "Teste 404" }],
    });

    expect(groqCalls).toBe(1);
    expect(res.providerId).toBe("mistral");
  });

  // 7. Circuit breaker aberto → pula diretamente para o próximo
  it("Cenário 7: Circuit breaker aberto em provider anterior → pula diretamente sem chamada de rede", async () => {
    const rec = circuitBreaker.getRecord("groq");
    rec.state = "open";
    rec.cooldownUntil = Date.now() + 100_000;

    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("api.groq.com")) {
        throw new Error("Groq não deveria ser chamado com circuito aberto!");
      }
      if (url.includes("api.mistral.ai")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "Mistral chamado diretamente" }, finish_reason: "stop" }],
          }),
        };
      }
      return { ok: false, status: 500 };
    });
    globalThis.fetch = fetchSpy;

    const router = new AIRouter({ overrideSecrets: testSecrets, supabaseAdmin: mockSupabase });
    const res = await router.generate({
      messages: [{ role: "user", content: "Teste circuito aberto" }],
    });

    expect(res.providerId).toBe("mistral");
    expect(fetchSpy.mock.calls.some((c) => c[0].includes("groq.com"))).toBe(false);
  });

  // 8. Circuit breaker recupera corretamente (half_open -> closed)
  it("Cenário 8: Circuit breaker recupera com transição para half_open e fecha após sucesso", async () => {
    const rec = circuitBreaker.getRecord("groq");
    rec.state = "open";
    rec.cooldownUntil = Date.now() - 1000; // Cooldown já expirou

    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("api.groq.com")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "Groq recuperado com sucesso!" }, finish_reason: "stop" }],
          }),
        };
      }
      return { ok: false, status: 500 };
    });
    globalThis.fetch = fetchSpy;

    const router = new AIRouter({ overrideSecrets: testSecrets, supabaseAdmin: mockSupabase });
    const res = await router.generate({
      messages: [{ role: "user", content: "Teste recuperação" }],
    });

    expect(res.providerId).toBe("groq");
    expect(res.text).toBe("Groq recuperado com sucesso!");
    expect(circuitBreaker.getRecord("groq").state).toBe("closed");
    expect(circuitBreaker.getRecord("groq").consecutiveFailures).toBe(0);
  });

  // 9. Provider sem secret → ignorado sem quebrar a cadeia
  it("Cenário 9: Provider sem API key configurada → ignorado como CONFIG_INCOMPLETE sem quebrar o roteamento", async () => {
    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("api.mistral.ai")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "Mistral atendeu (Groq sem chave)" }, finish_reason: "stop" }],
          }),
        };
      }
      return { ok: false, status: 500 };
    });
    globalThis.fetch = fetchSpy;

    // Groq sem apiKey
    const partialSecrets = {
      groq: { apiKey: "" },
      mistral: { apiKey: "valid-key", model: "mistral-small-latest" },
    };

    const router = new AIRouter({ overrideSecrets: partialSecrets, supabaseAdmin: mockSupabase });
    const res = await router.generate({
      messages: [{ role: "user", content: "Teste sem chave" }],
    });

    expect(res.providerId).toBe("mistral");
    expect(res.text).toBe("Mistral atendeu (Groq sem chave)");
  });

  // 10. Todos falham → somente então FRIENDLY_EXHAUSTED_MESSAGE
  it("Cenário 10: Todos os providers candidatos falham → somente então retorna FRIENDLY_EXHAUSTED_MESSAGE", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Total provider outage",
    } as any);

    const router = new AIRouter({ overrideSecrets: testSecrets, supabaseAdmin: mockSupabase });
    const res = await router.generate({
      messages: [{ role: "user", content: "Teste esgotamento" }],
    });

    expect(res.text).toBe(FRIENDLY_EXHAUSTED_MESSAGE);
    expect(res.modelId).toBe("exhausted");
  });

  // 11. Erro em telemetria NÃO impede resposta da GIA
  it("Cenário 11: Falha no banco de dados ao registrar telemetria NÃO afeta nem impede a resposta da GIA", async () => {
    const errorSupabase = {
      from: vi.fn(() => ({
        insert: vi.fn().mockRejectedValue(new Error("Supabase Postgres timeout in ai_usage_events")),
        select: vi.fn(),
        update: vi.fn(),
      })),
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "Resposta garantida apesar de erro na telemetria" }, finish_reason: "stop" }],
      }),
    } as any);

    const router = new AIRouter({ overrideSecrets: testSecrets, supabaseAdmin: errorSupabase });
    const res = await router.generate({
      messages: [{ role: "user", content: "Teste resiliência de telemetria" }],
    });

    expect(res.providerId).toBe("groq");
    expect(res.text).toBe("Resposta garantida apesar de erro na telemetria");
  });

  // 12. Uma falha anterior NÃO faz mensagens posteriores ficarem permanentemente sem resposta
  it("Cenário 12: Uma falha transitória anterior não bloqueia a mensagem seguinte", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      if (url.includes("api.groq.com")) {
        if (callCount <= 2) {
          // Mensagem 1: Groq falha 429 no initial e no retry
          return { ok: false, status: 429, headers: new Headers({ "retry-after": "1" }), text: async () => "Transient 429" };
        }
        // Mensagem 2: Groq disponível normalmente
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "Groq recuperado para a mensagem 2" }, finish_reason: "stop" }],
          }),
        };
      }
      if (url.includes("api.mistral.ai")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "Mistral respondeu à mensagem 1" }, finish_reason: "stop" }],
          }),
        };
      }
      return { ok: false, status: 500 };
    });

    const router = new AIRouter({ overrideSecrets: testSecrets, supabaseAdmin: mockSupabase });

    // Mensagem 1 (sofre 429 no Groq, Mistral assume)
    const res1 = await router.generate({ messages: [{ role: "user", content: "Msg 1" }] });
    expect(res1.providerId).toBe("mistral");

    // Mensagem 2 subsequente: Groq NÃO ficou preso em circuito aberto
    const res2 = await router.generate({ messages: [{ role: "user", content: "Msg 2" }] });
    expect(res2.providerId).toBe("groq");
    expect(res2.text).toContain("Groq recuperado");
  });
});
