import { describe, expect, it } from "vitest";
import { getPendingPublicBudgetRequests } from "./public-budget-requests";

const event = (id: string, origin: string, created_at: string, status = "novo_orcamento") =>
  ({ id, origin, created_at, status }) as any;

describe("getPendingPublicBudgetRequests", () => {
  it("inclui somente solicitações públicas pendentes, da mais recente para a mais antiga", () => {
    const result = getPendingPublicBudgetRequests([
      event("old", "public_budget_form", "2026-01-01T10:00:00Z"),
      event("manual", "manual", "2026-01-03T10:00:00Z"),
      event("handled", "public_budget_form", "2026-01-04T10:00:00Z", "orcamento_enviado"),
      event("new", "public_budget_form", "2026-01-02T10:00:00Z"),
    ]);
    expect(result.map(({ id }) => id)).toEqual(["new", "old"]);
    expect(result).toHaveLength(2);
  });
});
