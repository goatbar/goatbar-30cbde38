import { describe, it, expect, vi } from "vitest";
import { defaultToolRegistry } from "../supabase/functions/_shared/goat-ai/tools/registry";
import { normalizeDateInput, calculateSalesSessionMetrics } from "../supabase/functions/_shared/goat-ai/tools/definitions/financial";
import { resolveBusinessUnit } from "../supabase/functions/_shared/goat-ai/matchers/unit-matcher";
import { ToolContext } from "../supabase/functions/_shared/goat-ai/types";

describe("GIA Sales Sessions Debug & Business Domain Unification", () => {
  describe("1. Date Normalization (Brazilian Format & Determinism)", () => {
    it("normalizes '07/08' strictly as 7 de agosto (2026-08-07) and NEVER 8 de julho", () => {
      expect(normalizeDateInput("07/08", 2026)).toBe("2026-08-07");
      expect(normalizeDateInput("7/8", 2026)).toBe("2026-08-07");
      expect(normalizeDateInput("07-08", 2026)).toBe("2026-08-07");
    });

    it("normalizes full dates with 4-digit and 2-digit years", () => {
      expect(normalizeDateInput("07/08/2026")).toBe("2026-08-07");
      expect(normalizeDateInput("07/08/26")).toBe("2026-08-07");
      expect(normalizeDateInput("07-08-2026")).toBe("2026-08-07");
    });

    it("preserves standard ISO date YYYY-MM-DD and handles ISO timestamps without timezone shift", () => {
      expect(normalizeDateInput("2026-08-07")).toBe("2026-08-07");
      expect(normalizeDateInput("2026-08-07T00:00:00.000Z")).toBe("2026-08-07");
      expect(normalizeDateInput("2026-08-07T23:59:59Z")).toBe("2026-08-07");
      expect(normalizeDateInput("2026-08-07 15:30:00")).toBe("2026-08-07");
    });

    it("normalizes Portuguese textual dates", () => {
      expect(normalizeDateInput("7 de agosto", 2026)).toBe("2026-08-07");
      expect(normalizeDateInput("07 de agosto de 2026")).toBe("2026-08-07");
      expect(normalizeDateInput("7 de ago de 2026")).toBe("2026-08-07");
      expect(normalizeDateInput("15 de setembro", 2026)).toBe("2026-09-15");
      expect(normalizeDateInput("31 de dezembro de 2026")).toBe("2026-12-31");
    });

    it("uses deterministic year when year is omitted vs explicitly provided", () => {
      expect(normalizeDateInput("07/08")).toBe(`${new Date().getFullYear()}-08-07`);
      expect(normalizeDateInput("07/08", 2027)).toBe("2027-08-07");
    });
  });

  describe("2. Canonical Business Unit Resolver & Aliases", () => {
    it("resolves all Goat Botequim aliases to canonical database modality 'Goat Botequim'", () => {
      const aliases = [
        "Goat Botequim",
        "goat botequim",
        "botequim",
        "boteco",
        "goatbotequim",
        "goat boteco",
        "unidade botequim",
      ];
      for (const alias of aliases) {
        const res = resolveBusinessUnit(alias);
        expect(res.id).toBe("goat_botequim");
        expect(res.canonicalName).toBe("Goat Botequim");
        expect(res.dbModality).toBe("Goat Botequim");
        expect(res.matched).toBe(true);
      }
    });

    it("resolves all 7Steakhouse aliases to canonical database modality '7Steakhouse'", () => {
      const aliases = [
        "7Steakhouse",
        "7 Steakhouse",
        "7 Steak House",
        "7 Steak",
        "sete steakhouse",
        "sete steak",
        "steakhouse",
        "7steakhouse",
      ];
      for (const alias of aliases) {
        const res = resolveBusinessUnit(alias);
        expect(res.id).toBe("steakhouse");
        expect(res.canonicalName).toBe("7 Steak House");
        expect(res.dbModality).toBe("7Steakhouse");
        expect(res.matched).toBe(true);
      }
    });

    it("resolves Eventos aliases correctly", () => {
      const aliases = ["Eventos", "evento", "casamento", "aniversario", "formatura", "corporativo"];
      for (const alias of aliases) {
        const res = resolveBusinessUnit(alias);
        expect(res.id).toBe("eventos");
        expect(res.canonicalName).toBe("Eventos");
        expect(res.dbModality).toBe("Evento");
        expect(res.matched).toBe(true);
      }
    });
  });

  describe("3. Production Fixture & Calculation Verification (Goat Botequim)", () => {
    const productionSession = {
      id: "prod-sess-0708",
      date: "2026-08-07",
      modality: "Goat Botequim",
      labor_names: "Barman Joao",
      labor_value: 200.0,
      labor_quantity: 1,
      reposicao_restaurante: 0,
      financial_session_items: [
        { id: "i1", drink_name: "Caipirinha Classica", quantity: 16, unit_price: 22.0, unit_cost: 4.8 },
        { id: "i2", drink_name: "Gin Tropical", quantity: 12, unit_price: 25.0, unit_cost: 5.5 },
        { id: "i3", drink_name: "Moscow Mule", quantity: 8, unit_price: 19.875, unit_cost: 4.075 },
      ],
    };

    it("calculates exact production metrics according to frontend financial formulas", () => {
      const metrics = calculateSalesSessionMetrics(productionSession);

      expect(metrics.total_drinks).toBe(36);
      expect(metrics.gross_revenue).toBe(811.0);
      expect(metrics.cost_drinks).toBe(175.4);
      expect(metrics.gross_profit).toBe(635.6);
      expect(metrics.repasse_restaurante).toBe(254.24);
      expect(metrics.saldo_goat).toBe(381.36);
      expect(metrics.labor_value).toBe(200.0);
      expect(metrics.final_profit).toBe(181.36);
    });

    it("finds production fixture when querying via get_sales_sessions with Brazilian date '07/08'", async () => {
      const mockDatabase = [productionSession];

      const mockAdmin = {
        from: vi.fn((table: string) => {
          if (table === "ai_tool_calls") {
            return { insert: async () => ({ data: null, error: null }) };
          }
          if (table === "financial_sessions") {
            const queryMock: any = {
              order: () => queryMock,
              limit: () => queryMock,
              or: () => queryMock,
              ilike: () => queryMock,
              eq: (field: string, val: any) => {
                const filtered = mockDatabase.filter((s: any) => s[field] === val);
                return Promise.resolve({ data: filtered, error: null });
              },
              in: (field: string, vals: any[]) => {
                const filtered = mockDatabase.filter((s: any) => vals.includes(s[field]));
                return Promise.resolve({ data: filtered, error: null });
              },
            };
            return { select: () => queryMock };
          }
          return {};
        }),
      };

      const context: ToolContext = {
        supabaseAdmin: mockAdmin,
        conversationId: "conv-debug-0708",
        channel: "whatsapp",
        correlationId: "corr-debug-0708",
        toolCallId: "call_0708",
      };

      const result = await defaultToolRegistry.executeTool(
        "get_sales_sessions",
        { unit_name: "goat botequim", date: "07/08" },
        context
      );

      expect(result.success).toBe(true);
      expect(result.data.count).toBe(1);
      const session = result.data.sessions[0];
      expect(session.date).toBe("2026-08-07");
      expect(session.unit).toBe("Goat Botequim");
      expect(session.total_drinks).toBe(36);
      expect(session.gross_revenue).toBe(811.0);
      expect(session.final_profit).toBeCloseTo(181.36, 1);
    });
  });

  describe("4. 7Steakhouse Calculations & Modality Separation", () => {
    const steakSession = {
      id: "sess-steak-1",
      date: "2026-08-14",
      modality: "7Steakhouse",
      labor_names: "Jhansen",
      labor_value: 250.0,
      labor_quantity: 1,
      reposicao_restaurante: 50.0,
      financial_session_items: [
        { id: "s1", drink_name: "Chopp Artesanal", quantity: 30, unit_price: 18.0, unit_cost: 6.0 },
        { id: "s2", drink_name: "Drink Especial Steak", quantity: 20, unit_price: 32.0, unit_cost: 8.5 },
      ],
    };

    const botequimSession = {
      id: "sess-bot-1",
      date: "2026-08-14",
      modality: "Goat Botequim",
      labor_names: "Carlos",
      labor_value: 200.0,
      labor_quantity: 1,
      reposicao_restaurante: 0,
      financial_session_items: [
        { id: "b1", drink_name: "Caipirinha", quantity: 25, unit_price: 20.0, unit_cost: 4.0 },
      ],
    };

    it("calculates 7Steakhouse metrics with Steakhouse rules (gross_profit - reposicao - labor)", () => {
      const metrics = calculateSalesSessionMetrics(steakSession);

      expect(metrics.unit).toBe("7 Steak House");
      expect(metrics.modality).toBe("7Steakhouse");
      expect(metrics.total_drinks).toBe(50);
      expect(metrics.gross_revenue).toBe(30 * 18 + 20 * 32);
      expect(metrics.cost_drinks).toBe(30 * 6 + 20 * 8.5);
      expect(metrics.gross_profit).toBe(1180 - 350);
      expect(metrics.repasse_restaurante).toBe(0);
      expect(metrics.reposicao_restaurante).toBe(50);
      expect(metrics.labor_value).toBe(250);
      expect(metrics.final_profit).toBe(830 - 50 - 250);
    });

    it("filters and isolates Goat Botequim and 7Steakhouse without cross-contamination", async () => {
      const mockDatabase = [steakSession, botequimSession];

      const createAdmin = () => ({
        from: vi.fn((table: string) => {
          if (table === "ai_tool_calls") {
            return { insert: async () => ({ data: null, error: null }) };
          }
          if (table === "financial_sessions") {
            const queryMock: any = {
              order: () => queryMock,
              limit: () => queryMock,
              or: () => queryMock,
              ilike: () => queryMock,
              eq: (field: string, val: any) => {
                return Promise.resolve({ data: mockDatabase.filter((s) => s[field] === val), error: null });
              },
            };
            return { select: () => queryMock };
          }
          return {};
        }),
      });

      const context: ToolContext = {
        supabaseAdmin: createAdmin(),
        conversationId: "conv-isolation-test",
        channel: "web",
      };

      const steakResult = await defaultToolRegistry.executeTool(
        "get_sales_sessions",
        { unit_name: "7 Steakhouse", date: "2026-08-14" },
        context
      );
      expect(steakResult.success).toBe(true);
      expect(steakResult.data.count).toBe(1);
      expect(steakResult.data.sessions[0].unit).toBe("7 Steak House");

      const botResult = await defaultToolRegistry.executeTool(
        "get_sales_sessions",
        { unit_name: "botequim", date: "2026-08-14" },
        context
      );
      expect(botResult.success).toBe(true);
      expect(botResult.data.count).toBe(1);
      expect(botResult.data.sessions[0].unit).toBe("Goat Botequim");

      const allResult = await defaultToolRegistry.executeTool(
        "get_sales_sessions",
        { date: "2026-08-14" },
        context
      );
      expect(allResult.success).toBe(true);
      expect(allResult.data.count).toBe(2);
    });

    it("returns clean message with count: 0 when no session exists for date", async () => {
      const mockAdmin = {
        from: vi.fn((table: string) => {
          if (table === "ai_tool_calls") {
            return { insert: async () => ({ data: null, error: null }) };
          }
          if (table === "financial_sessions") {
            const queryMock: any = {
              order: () => queryMock,
              limit: () => queryMock,
              or: () => queryMock,
              eq: async () => ({ data: [], error: null }),
            };
            return { select: () => queryMock };
          }
          return {};
        }),
      };

      const context: ToolContext = {
        supabaseAdmin: mockAdmin,
        conversationId: "conv-empty-test",
        channel: "web",
      };

      const result = await defaultToolRegistry.executeTool(
        "get_sales_sessions",
        { unit_name: "Goat Botequim", date: "2026-08-01" },
        context
      );

      expect(result.success).toBe(true);
      expect(result.data.count).toBe(0);
      expect(result.data.sessions).toHaveLength(0);
      expect(result.message).toContain("Nenhuma sessão de vendas encontrada");
    });
  });

  describe("5. Tool Domain Architecture & Structured Logging", () => {
    it("ensures all registered tools have domain and sourceTable configured", () => {
      const tools = defaultToolRegistry.listTools();
      expect(tools.length).toBeGreaterThanOrEqual(10);

      for (const tool of tools) {
        expect(tool.domain).toBeDefined();
        expect(["EVENTS", "FINANCIAL", "SALES", "CONTROLLER", "PURCHASES", "ANALYTICS", "OPERATIONS"]).toContain(
          tool.domain
        );
        expect(tool.sourceTable).toBeDefined();
      }
    });

    it("logs structured [GOAT-AI][TOOL][CALL] and [GOAT-AI][TOOL][RESULT] with correlationId and businessUnit", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const mockAdmin = {
        from: vi.fn(() => ({
          insert: async () => ({ data: null, error: null }),
          select: () => ({
            order: () => ({
              limit: () => ({
                or: () => ({
                  eq: async () => ({ data: [], error: null }),
                }),
              }),
            }),
          }),
        })),
      };

      const context: ToolContext = {
        supabaseAdmin: mockAdmin,
        conversationId: "conv-log-test",
        channel: "whatsapp",
        correlationId: "corr-log-123",
        toolCallId: "call_abc_456",
      };

      await defaultToolRegistry.executeTool(
        "get_sales_sessions",
        { unit_name: "Goat Botequim", date: "07/08" },
        context
      );

      const loggedCalls = consoleSpy.mock.calls.map((c) => c[0]);

      const callLog = loggedCalls.find((l) => typeof l === "string" && l.includes("[GOAT-AI][TOOL][CALL]"));
      expect(callLog).toBeDefined();
      expect(callLog).toContain("correlationId=corr-log-123");
      expect(callLog).toContain("toolName=get_sales_sessions");
      expect(callLog).toContain("toolCallId=call_abc_456");
      expect(callLog).toContain('businessUnit="Goat Botequim"');
      expect(callLog).toContain('canonicalBusinessUnit="Goat Botequim"');

      const resultLog = loggedCalls.find((l) => typeof l === "string" && l.includes("[GOAT-AI][TOOL][RESULT]"));
      expect(resultLog).toBeDefined();
      expect(resultLog).toContain("correlationId=corr-log-123");
      expect(resultLog).toContain('source="financial_sessions"');
      expect(resultLog).toContain("success=true");

      consoleSpy.mockRestore();
    });
  });
});
