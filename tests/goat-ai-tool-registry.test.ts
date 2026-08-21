import { describe, it, expect, vi } from "vitest";
import { defaultToolRegistry, GoatAIToolRegistry } from "../supabase/functions/_shared/goat-ai/tools/registry";
import { ToolContext } from "../supabase/functions/_shared/goat-ai/types";

describe("Goat AI - Tool Registry & Safety Validation", () => {
  it("registers all required business tools", () => {
    const registry = defaultToolRegistry;
    const tools = registry.listTools();

    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("search_events");
    expect(toolNames).toContain("get_event_details");
    expect(toolNames).toContain("search_events_by_guest_count");
    expect(toolNames).toContain("aggregate_event_consumption");
    expect(toolNames).toContain("create_sales_session");
    expect(toolNames).toContain("get_sales_sessions");
    expect(toolNames).toContain("create_controller_entry");
    expect(toolNames).toContain("search_controller_entries");
    expect(toolNames).toContain("create_event_purchase");
    expect(toolNames).toContain("get_financial_summary");
  });

  it("generates valid Gemini function declarations", () => {
    const declarations = defaultToolRegistry.getGeminiFunctionDeclarations();
    expect(declarations.length).toBeGreaterThanOrEqual(10);

    const salesTool = declarations.find((d) => d.name === "create_sales_session");
    expect(salesTool).toBeDefined();
    expect(salesTool?.parameters.type).toBe("object");
    expect(salesTool?.parameters.required).toContain("unit_name");
    expect(salesTool?.parameters.required).toContain("responsible");
  });

  it("validates missing fields when executing create_sales_session", async () => {
    const mockContext: ToolContext = {
      supabaseAdmin: {},
      conversationId: "conv-test",
      channel: "web",
    };

    // Missing 'responsible' and 'total_amount'
    const result = await defaultToolRegistry.executeTool(
      "create_sales_session",
      { unit_name: "7 Steak House", start_date: "2026-08-12" },
      mockContext
    );

    expect(result.success).toBe(false);
    expect(result.missing_fields).toContain("responsible");
    expect(result.missing_fields).toContain("total_amount");
  });

  it("validates missing fields when executing create_controller_entry", async () => {
    const mockContext: ToolContext = {
      supabaseAdmin: {},
      conversationId: "conv-test",
      channel: "web",
    };

    const result = await defaultToolRegistry.executeTool(
      "create_controller_entry",
      { supplier_name: "Distribuidora XPTO" }, // missing amount and date
      mockContext
    );

    expect(result.success).toBe(false);
    expect(result.missing_fields).toContain("amount");
    expect(result.missing_fields).toContain("date");
  });

  it("executes get_sales_sessions filtering by dates array or date range and returns clean message on zero results", async () => {
    const mockSessionsData = [
      {
        id: "sess-1",
        date: "2026-07-31",
        modality: "Goat Botequim",
        labor_names: "Jhansen",
        labor_value: 200,
        financial_session_items: [
          { id: "item-1", drink_name: "Caipirinha", quantity: 10, unit_price: 25 },
        ],
      },
    ];

    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === "ai_tool_calls") {
          return {
            insert: async () => ({ data: null, error: null }),
          };
        }
        if (table === "financial_sessions") {
          return {
            select: () => ({
              order: () => ({
                limit: () => ({
                  ilike: () => ({
                    in: async () => ({ data: mockSessionsData, error: null }),
                    gte: () => ({
                      lte: async () => ({ data: [], error: null }),
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

    const mockContext: ToolContext = {
      supabaseAdmin: mockAdmin,
      conversationId: "conv-test",
      channel: "web",
    };

    // Test with specific dates
    const result = await defaultToolRegistry.executeTool(
      "get_sales_sessions",
      { unit_name: "Goat Botequim", dates: ["31/07", "07/08"] },
      mockContext
    );

    expect(result.success).toBe(true);
    expect(result.data.count).toBe(1);
    expect(result.data.sessions[0].gross_revenue).toBe(250);
  });
});
