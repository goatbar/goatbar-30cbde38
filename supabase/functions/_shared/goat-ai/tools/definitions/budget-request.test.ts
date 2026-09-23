import { describe, expect, it, vi } from "vitest";
import { listPendingBudgetRequestsTool } from "./budget-request.ts";

describe("list_pending_budget_requests", () => {
  it("returns only public events without persisted budget versions, newest first", async () => {
    const rows = [
      { id: "public-open", origin: "public_budget_form", created_at: "2026-09-03", client_name: "Nova", event_budget_versions: [] },
      { id: "public-budgeted", origin: "public_budget_form", created_at: "2026-09-02", client_name: "Com versão", event_budget_versions: [{ id: "v1" }] },
    ];
    const order = vi.fn().mockResolvedValue({ data: rows, error: null });
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const context: any = { supabaseAdmin: { from: vi.fn(() => ({ select })) } };

    const result = await listPendingBudgetRequestsTool.execute(context, {});
    expect(eq).toHaveBeenCalledWith("origin", "public_budget_form");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result.data.requests.map((item: any) => item.id)).toEqual(["public-open"]);
  });
});
