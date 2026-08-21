import { describe, it, expect, vi } from "vitest";
import { aggregateEventConsumptionTool } from "../supabase/functions/_shared/goat-ai/tools/definitions/events";
import { ToolContext } from "../supabase/functions/_shared/goat-ai/types";

describe("Goat AI - Statistical Aggregations & Analytics", () => {
  it("calculates accurate ice consumption averages for ~100 guest events without hallucinating numbers", async () => {
    const mockEvents = [
      { id: "ev-1", client_name: "Event 1", date: "2026-07-01", guests: 100 },
      { id: "ev-2", client_name: "Event 2", date: "2026-07-10", guests: 100 },
      { id: "ev-3", client_name: "Event 3", date: "2026-07-20", guests: 95 },
    ];

    const mockBudgets = [
      { event_id: "ev-1", ice_packages_quantity: 8, drinks_per_person: 4 }, // 8 * 5 = 40kg
      { event_id: "ev-2", ice_packages_quantity: 10, drinks_per_person: 4.5 }, // 10 * 5 = 50kg
      { event_id: "ev-3", ice_packages_quantity: 9, drinks_per_person: 4 }, // 9 * 5 = 45kg
    ];

    const mockSupabase: any = {
      from: (table: string) => {
        if (table === "events") {
          return {
            select: () => ({
              gte: () => ({
                lte: () => ({
                  limit: async () => ({ data: mockEvents, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "event_budget_versions") {
          return {
            select: () => ({
              in: () => ({
                eq: async () => ({ data: mockBudgets, error: null }),
              }),
            }),
          };
        }
        return {};
      },
    };

    const context: ToolContext = {
      supabaseAdmin: mockSupabase,
      conversationId: "conv-1",
      channel: "web",
    };

    const result = await aggregateEventConsumptionTool.execute(context, { target_guests: 100 });

    expect(result.success).toBe(true);
    expect(result.data.events_analyzed_count).toBe(3);
    expect(result.data.ice_consumption_kg.average_kg).toBe(45); // (40+50+45)/3 = 45
    expect(result.data.ice_consumption_kg.median_kg).toBe(45);
    expect(result.data.ice_consumption_kg.min_kg).toBe(40);
    expect(result.data.ice_consumption_kg.max_kg).toBe(50);
  });
});
