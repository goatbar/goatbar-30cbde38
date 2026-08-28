import { describe, expect, it } from "vitest";
import {
  getPendingPublicBudgetRequests,
  isPendingPublicBudgetRequest,
} from "./public-budget-requests";

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

  it("ignora registros públicos legados sem status em vez de interromper a página", () => {
    const legacyEvent = event("legacy", "public_budget_form", "2026-01-01");

    expect(isPendingPublicBudgetRequest({ ...legacyEvent, status: null } as any)).toBe(false);
    expect(isPendingPublicBudgetRequest({ ...legacyEvent, status: undefined } as any)).toBe(false);
  });

  it("reconhece exatamente o formato persistido pela LP e não inclui origem manual", () => {
    const persistedByLp = event(
      "123e4567-e89b-42d3-a456-426614174000",
      "public_budget_form",
      "2026-08-28T21:31:00Z",
    );
    expect(getPendingPublicBudgetRequests([persistedByLp])).toEqual([persistedByLp]);
    expect(
      getPendingPublicBudgetRequests([
        { ...persistedByLp, origin: "manual" },
        { ...persistedByLp, status: "orcamento_enviado" },
      ] as any),
    ).toEqual([]);
  });
});
