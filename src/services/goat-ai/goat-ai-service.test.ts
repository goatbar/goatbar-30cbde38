import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rows: [] as any[], upsert: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-a" } }, error: null }) },
    from: vi.fn((table: string) => {
      if (table === "ai_notification_reads") return { upsert: state.upsert };
      const chain: any = {};
      chain.select = vi.fn(() => chain);
      chain.contains = vi.fn(() => chain);
      chain.order = vi.fn(() => chain);
      chain.limit = vi.fn().mockImplementation(async () => ({ data: state.rows, error: null }));
      return chain;
    }),
    functions: { invoke: vi.fn() },
  },
}));

import { goatAIService } from "./goat-ai-service";

describe("budget notification reads", () => {
  beforeEach(() => {
    state.rows = [];
    state.upsert.mockReset().mockResolvedValue({ error: null });
  });

  it("deriva unread/read da leitura visível ao usuário e não usa approval_status", async () => {
    state.rows = [
      { id: "new", approval_status: "approved", ai_notification_reads: [] },
      { id: "read", approval_status: "pending", ai_notification_reads: [{ read_at: "2026-09-23" }] },
    ];
    const items = await goatAIService.listBudgetNotifications();
    expect(items.map((item) => [item.id, item.is_read])).toEqual([["new", false], ["read", true]]);
    expect(await goatAIService.getPendingCount()).toBe(1);
  });

  it("grava leitura exclusivamente para o usuário autenticado", async () => {
    await goatAIService.markBudgetNotificationRead("notification-1");
    expect(state.upsert).toHaveBeenCalledWith(
      { ai_inbox_item_id: "notification-1", user_id: "user-a" },
      { onConflict: "ai_inbox_item_id,user_id" },
    );
  });
});
