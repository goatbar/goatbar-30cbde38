import { describe, it, expect, vi, beforeEach } from "vitest";
import { AIRouter } from "../supabase/functions/_shared/goat-ai/router/ai-router";
import { CircuitBreakerManager } from "../supabase/functions/_shared/goat-ai/router/circuit-breaker";
import { BaseAIProvider } from "../supabase/functions/_shared/goat-ai/router/providers/base-provider";
import { NormalizedAIRequest, NormalizedAIResponse } from "../supabase/functions/_shared/goat-ai/router/types";
import { ConversationManager } from "../supabase/functions/_shared/goat-ai/conversation/manager";
import { GoatAIGeminiAgent } from "../supabase/functions/_shared/goat-ai/agent/gemini-agent";
import { GoatAIToolRegistry } from "../supabase/functions/_shared/goat-ai/tools/registry";
import { compactToolResultForAgent } from "../supabase/functions/_shared/goat-ai/tools/dto";
import { TurnManager } from "../supabase/functions/_shared/goat-ai/turn/turn-manager";

class MockProvider extends BaseAIProvider {
  public id: any;
  public name: string;
  public defaultModel: string;
  public freeType: any = "FREE";
  public capabilities: any = {
    supportsText: true,
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    supportsAudio: false,
    supportsStreaming: false,
  };
  public priority: number;
  private generateFn: (req: NormalizedAIRequest) => Promise<NormalizedAIResponse>;

  constructor(id: string, name: string, priority: number, generateFn: (req: NormalizedAIRequest) => Promise<NormalizedAIResponse>) {
    super();
    this.id = id;
    this.name = name;
    this.defaultModel = `${id}-model`;
    this.priority = priority;
    this.generateFn = generateFn;
  }

  public isAvailable() {
    return { available: true };
  }
  public getModel() {
    return this.defaultModel;
  }
  public generate(req: NormalizedAIRequest) {
    return this.generateFn(req);
  }
}

describe("Goat AI - Turn Resilience & Architectural Directives Test Suite", () => {
  let circuitBreaker: CircuitBreakerManager;

  beforeEach(() => {
    vi.restoreAllMocks();
    circuitBreaker = CircuitBreakerManager.getInstance();
    circuitBreaker.reset();
  });

  it("1. Bug Repro & Fix: HTTP 200 with empty text and no tools must be classified as empty_response and trigger failover", async () => {
    let providerACalled = false;
    let providerBCalled = false;

    const providerA = new MockProvider("provider_a", "Provider A", 10, async () => {
      providerACalled = true;
      // HTTP 200 but content is empty string and no tool calls
      return {
        text: "",
        toolCalls: undefined,
        providerId: "provider_a",
        modelId: "model-a",
        durationMs: 50,
      };
    });

    const providerB = new MockProvider("provider_b", "Provider B", 20, async () => {
      providerBCalled = true;
      return {
        text: "Resposta válida do Provider B",
        toolCalls: undefined,
        providerId: "provider_b",
        modelId: "model-b",
        durationMs: 70,
      };
    });

    const router = new AIRouter({
      customProviders: [providerA, providerB],
    });

    const response = await router.generate({
      correlationId: "test_empty_resp",
      messages: [{ role: "user", content: "Olá" }],
      tools: [],
    });

    expect(providerACalled).toBe(true);
    expect(providerBCalled).toBe(true);
    expect(response.text).toBe("Resposta válida do Provider B");
    expect(response.providerId).toBe("provider_b");

    // Provider A should NOT be marked as successful in circuit breaker
    const breakerA = circuitBreaker.isAvailable("provider_a");
    expect(breakerA.available).toBe(true); // closed, but recorded a failure
    const stateA = circuitBreaker.getRecord("provider_a");
    expect(stateA.consecutiveFailures).toBe(1);
    expect(stateA.lastFailureReason).toContain("empty_response");
  });

  it("2. Bug Repro & Fix: Web conversation continuity retains conversation UUID across multiple turns without creating duplicates", async () => {
    const memoryConversations: any[] = [];
    const memoryMessages: any[] = [];

    const mockSupabase: any = {
      from: vi.fn((table: string) => {
        if (table === "ai_conversations") {
          return {
            select: () => {
              const filters: Record<string, any> = {};
              const builder: any = {
                eq: (col: string, val: any) => {
                  filters[col] = val;
                  return builder;
                },
                order: () => builder,
                limit: () => builder,
                maybeSingle: async () => {
                  const found = memoryConversations.find((c) => {
                    for (const [k, v] of Object.entries(filters)) {
                      if (c[k] !== v) return false;
                    }
                    return c.status === "active";
                  });
                  return { data: found || null, error: null };
                },
                single: async () => {
                  const found = memoryConversations.find((c) => {
                    for (const [k, v] of Object.entries(filters)) {
                      if (c[k] !== v) return false;
                    }
                    return c.status === "active";
                  });
                  return { data: found || null, error: null };
                },
              };
              return builder;
            },
            insert: (row: any) => ({
              select: () => ({
                single: async () => {
                  const newConv = {
                    id: row.id || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    user_id: row.user_id,
                    channel: row.channel,
                    external_conversation_id: row.external_conversation_id || null,
                    title: row.title,
                    status: row.status || "active",
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  };
                  memoryConversations.push(newConv);
                  return { data: newConv, error: null };
                },
              }),
            }),
            update: (updates: any) => ({
              eq: async (col: string, val: any) => {
                const idx = memoryConversations.findIndex((c) => c[col] === val);
                if (idx >= 0) {
                  memoryConversations[idx] = { ...memoryConversations[idx], ...updates };
                }
                return { data: null, error: null };
              },
            }),
          };
        }
        if (table === "ai_messages") {
          return {
            select: () => ({
              eq: (col: string, val: any) => ({
                order: () => ({
                  limit: async () => {
                    const msgs = memoryMessages
                      .filter((m) => m[col] === val)
                      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
                    return { data: msgs, error: null };
                  },
                }),
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
            insert: (row: any) => ({
              select: () => ({
                single: async () => {
                  const newMsg = {
                    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    ...row,
                    created_at: new Date(Date.now() + memoryMessages.length * 1000).toISOString(),
                  };
                  memoryMessages.push(newMsg);
                  return { data: newMsg, error: null };
                },
              }),
            }),
          };
        }
        return {};
      }),
    };

    const manager = new ConversationManager(mockSupabase);

    // Turn 1: Create initial conversation
    const conv1 = await manager.getOrCreateConversation("web", "user_abc", undefined, "Mensagem inicial");
    expect(conv1.id).toBeDefined();
    expect(memoryConversations.length).toBe(1);

    await manager.saveMessage(conv1.id, "user", "Mensagem 1 do turno 1");
    await manager.saveMessage(conv1.id, "assistant", "Resposta 1 do turno 1");

    // Turn 2: Frontend sends the exact same conversationId (UUID)
    const conv2 = await manager.getOrCreateConversation("web", "user_abc", conv1.id, "Mensagem 2");
    
    // Invariant: MUST remain in the same conversation!
    expect(conv2.id).toBe(conv1.id);
    expect(memoryConversations.length).toBe(1);

    // Turn 3: Frontend sends conversationId again
    const conv3 = await manager.getOrCreateConversation("web", "user_abc", conv1.id, "Mensagem 3");
    expect(conv3.id).toBe(conv1.id);
    expect(memoryConversations.length).toBe(1);

    // Verify history contains all previous messages
    const recent = await manager.getRecentMessages(conv1.id, 10);
    expect(recent.length).toBe(2);
    expect(recent[0].content).toBe("Mensagem 1 do turno 1");
  });

  it("3. Canonical multi-tool call format: single assistant message with tool_calls followed by tool messages", async () => {
    let capturedMessages: any[] = [];

    const providerA = new MockProvider("prov_a", "Provider A", 10, async (req) => {
      if (req.messages.length === 1) {
        // Step 1: LLM returns 2 tool calls at once
        return {
          text: "",
          toolCalls: [
            { id: "call_1", name: "search_events", arguments: { query: "Isidora" } },
            { id: "call_2", name: "get_event_details", arguments: { event_id: "ev_123" } },
          ],
          providerId: "prov_a",
          modelId: "model-a",
          durationMs: 50,
        };
      } else {
        capturedMessages = req.messages;
        return {
          text: "Síntese dos eventos encontrados.",
          toolCalls: undefined,
          providerId: "prov_a",
          modelId: "model-a",
          durationMs: 60,
        };
      }
    });

    const registry = new GoatAIToolRegistry();
    registry.register({
      name: "search_events",
      description: "search",
      parameters: { type: "object", properties: { query: { type: "string" } } },
      requiresConfirmation: false,
      execute: async () => ({ success: true, data: { events: [{ id: "ev_123", name: "Isidora" }] } }),
    });
    registry.register({
      name: "get_event_details",
      description: "details",
      parameters: { type: "object", properties: { event_id: { type: "string" } } },
      requiresConfirmation: false,
      execute: async () => ({ success: true, data: { event: { id: "ev_123", drinks: ["Mojito", "Gin"] } } }),
    });

    const createMockBuilder = (convData: any = { id: "conv-x", status: "active", metadata: {} }) => {
      const b: any = {
        select: () => b,
        eq: () => b,
        in: () => b,
        gt: () => b,
        gte: () => b,
        lt: () => b,
        lte: () => b,
        is: () => b,
        neq: () => b,
        order: () => b,
        limit: (n?: number) => {
          if (n === 1) return { maybeSingle: async () => ({ data: convData, error: null }) };
          return { ...b, then: (resolve: any) => resolve({ data: [], error: null }) };
        },
        maybeSingle: async () => ({ data: convData, error: null }),
        single: async () => ({ data: convData, error: null }),
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: "msg-x" }, error: null }),
          }),
        }),
        update: () => b,
        upsert: () => ({ error: null }),
      };
      return b;
    };

    const mockSupabase: any = {
      from: vi.fn(() => createMockBuilder()),
    };

    const agent = new GoatAIGeminiAgent(
      mockSupabase,
      "dummy_key",
      registry,
      "dummy_model",
      new AIRouter({ customProviders: [providerA] })
    );

    const result = await agent.processTurn({
      conversationId: "conv-x",
      message: "Drinks de Isidora",
      channel: "web",
    });

    expect(result.reply).toBe("Síntese dos eventos encontrados.");
    expect(result.toolCallsExecuted?.length).toBe(2);

    // Invariant: The prompt for step 2 MUST contain:
    // 1 user message
    // 1 assistant message with 2 tool_calls
    // 2 tool messages
    const assistantToolCallMsg = capturedMessages.find((m) => m.role === "assistant" && m.toolCalls?.length === 2);
    expect(assistantToolCallMsg).toBeDefined();
    expect(assistantToolCallMsg.toolCalls.length).toBe(2);

    const toolMessages = capturedMessages.filter((m) => m.role === "tool");
    expect(toolMessages.length).toBe(2);
    expect(toolMessages[0].toolCallId).toBe("call_1");
    expect(toolMessages[1].toolCallId).toBe("call_2");
  });

  it("4. Tool payload semantic compacting reduces token weight without losing critical business fields", () => {
    const rawEventData = {
      id: "ev-12345",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      deleted_at: null,
      internal_audit_trace: "trace_9999_very_long_unneeded_string_abcdef1234567890",
      raw_db_dump: { col1: 1, col2: 2, junk: "junk".repeat(200) },
      client_name: "Isidora",
      event_name: "Casamento Isidora & Christian",
      date: "2026-09-05",
      city: "Belo Horizonte",
      guests: 150,
      status: "confirmed",
      drinks: [
        { id: "d1", name: "Caipirinha Clássica", description: "Cachaça e limão", internal_cost_cents: 250 },
        { id: "d2", name: "Gin Tônica Floral", description: "Gin e especiarias", internal_cost_cents: 350 },
      ],
    };

    const compacted = compactToolResultForAgent("get_event_details", { event: rawEventData });
    
    // Invariant: Critical fields are preserved
    expect(compacted.data.event.client_name).toBe("Isidora");
    expect(compacted.data.event.event_name).toBe("Casamento Isidora & Christian");
    expect(compacted.data.event.drinks.length).toBe(2);
    expect(compacted.data.event.drinks[0].name).toBe("Caipirinha Clássica");

    // Invariant: Unneeded technical bloating keys are pruned
    expect(compacted.data.event.raw_db_dump).toBeUndefined();
    expect(compacted.data.event.internal_audit_trace).toBeUndefined();

    // Metrics are recorded
    expect(compacted.metrics.rawBytes).toBeGreaterThan(compacted.metrics.compactedBytes);
    expect(compacted.metrics.estimatedTokensSaved).toBeGreaterThan(0);
  });

  it("5. TurnManager mutual exclusion lock rejects concurrent turn on same conversation", async () => {
    let mockMetadata: any = {};
    const mockSupabase: any = {
      from: vi.fn((table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: table === "ai_conversations" ? { id: "conv-lock-1", metadata: mockMetadata } : null,
              error: null,
            }),
          }),
        }),
        update: (updateData: any) => ({
          eq: async () => {
            if (updateData.metadata) mockMetadata = { ...updateData.metadata };
            return { data: null, error: null };
          },
        }),
        upsert: async () => ({ error: null }),
      })),
    };

    const turnManager1 = new TurnManager(mockSupabase, "turn-1", "conv-lock-1", "req-1");
    const turnManager2 = new TurnManager(mockSupabase, "turn-2", "conv-lock-1", "req-2");

    // Turn 1 acquires lock
    const lock1 = await turnManager1.acquireConversationLock(500);
    expect(lock1.acquired).toBe(true);

    // Turn 2 tries to acquire lock on same conversation -> MUST BE REJECTED after 500ms
    const lock2 = await turnManager2.acquireConversationLock(500);
    expect(lock2.acquired).toBe(false);
    expect(lock2.reason).toContain("Conversa ocupada");

    // Turn 1 completes and releases lock
    await turnManager1.completeTurn({
      reply: "Resposta do turno 1",
      timings: { totalMs: 100, llmMs: 50, toolsMs: 30, dbMs: 10, retriesMs: 0, failoverMs: 0 },
    });

    // Now Turn 2 can acquire lock
    const lock2After = await turnManager2.acquireConversationLock(5000);
    expect(lock2After.acquired).toBe(true);

    await turnManager2.releaseConversationLock();
  });

  it("6. TurnManager records 'partial' status with proven data when time limit budget is reached", async () => {
    let storedTurn: any = null;
    let storedMetadata: any = {};
    const mockSupabase: any = {
      from: vi.fn((table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: table === "ai_conversations" ? { id: "conv-p", metadata: storedMetadata } : null,
              error: null,
            }),
          }),
        }),
        update: (u: any) => ({
          eq: async () => {
            if (u.metadata) storedMetadata = u.metadata;
            return { data: null, error: null };
          },
        }),
        upsert: async (row: any) => {
          storedTurn = row;
          return { error: null };
        },
      })),
    };

    const turnManager = new TurnManager(mockSupabase, "turn-partial-1", "conv-p", "req-p");
    await turnManager.initTurn("msg-user-1");
    await turnManager.recordToolExecution("search_events");
    await turnManager.recordToolExecution("get_drinks_catalog");

    // Partial completion
    await turnManager.partialTurn({
      reply: "Foram encontrados 2 eventos, mas a síntese não pôde ser completada.",
      reason: "turn_budget_timeout",
      timings: { totalMs: 42000, llmMs: 30000, toolsMs: 11000, dbMs: 1000, retriesMs: 0, failoverMs: 0 },
    });

    expect(storedTurn).toBeDefined();
    expect(storedTurn.status).toBe("partial");
    expect(storedTurn.tools_executed).toEqual(["search_events", "get_drinks_catalog"]);
    expect(storedTurn.reply).toContain("Foram encontrados");

    // Also mirrored into conversation metadata
    expect(storedMetadata.last_turn?.status).toBe("partial");
    expect(storedMetadata.last_turn?.toolsExecuted).toEqual(["search_events", "get_drinks_catalog"]);
  });

  it("7. reconcileTurn retrieves persisted turn after transport interruption", async () => {
    const mockConvMetadata = {
      last_turn: {
        id: "turn-recon-123",
        requestId: "req-recon-123",
        conversationId: "conv-recon-1",
        status: "completed",
        currentStage: "done",
        reply: "Esta é a resposta persistida no servidor após o cliente perder a conexão HTTP.",
        toolsExecuted: ["get_event_details"],
        timings: { totalMs: 59740 },
        startedAt: new Date(Date.now() - 60000).toISOString(),
        completedAt: new Date().toISOString(),
      },
      recent_turns: [
        {
          id: "turn-recon-123",
          status: "completed",
          reply: "Esta é a resposta persistida no servidor após o cliente perder a conexão HTTP.",
        },
      ],
    };

    const mockSupabase: any = {
      from: vi.fn((table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              if (table === "ai_turns") {
                // Simulate table not queried or fallback to conv metadata
                return { data: null, error: null };
              }
              if (table === "ai_conversations") {
                return { data: { id: "conv-recon-1", metadata: mockConvMetadata }, error: null };
              }
              return { data: null, error: null };
            },
          }),
        }),
      })),
    };

    // Client invokes reconcileTurn
    const reconciled = await TurnManager.reconcileTurn(mockSupabase, "turn-recon-123", "conv-recon-1");

    expect(reconciled).toBeDefined();
    expect(reconciled?.id).toBe("turn-recon-123");
    expect(reconciled?.status).toBe("completed");
    expect(reconciled?.reply).toContain("Esta é a resposta persistida no servidor");
  });
});
