import { describe, expect, it } from "vitest";
import {
  getPendingPublicBudgetRequests,
  isPendingPublicBudgetRequest,
  splitPublicBudgetRequests,
} from "./public-budget-requests";

const event = (id: string, origin: string, created_at: string, has_budget_version = false) =>
  ({ id, origin, created_at, status: "novo_orcamento", has_budget_version }) as any;

describe("getPendingPublicBudgetRequests", () => {
  it("inclui somente solicitações públicas pendentes, da mais recente para a mais antiga", () => {
    const result = getPendingPublicBudgetRequests([
      event("old", "public_budget_form", "2026-01-01T10:00:00Z"),
      event("manual", "manual", "2026-01-03T10:00:00Z"),
      event("handled", "public_budget_form", "2026-01-04T10:00:00Z", true),
      event("new", "public_budget_form", "2026-01-02T10:00:00Z"),
    ]);
    expect(result.map(({ id }) => id)).toEqual(["new", "old"]);
    expect(result).toHaveLength(2);
  });

  it("move para o pipeline e atualiza o contador após persistir a primeira versão", () => {
    const unsaved = event("request", "public_budget_form", "2026-01-01T10:00:00Z");
    expect(splitPublicBudgetRequests([unsaved])).toMatchObject({
      pending: [unsaved],
      pipeline: [],
    });

    const saved = { ...unsaved, has_budget_version: true };
    const result = splitPublicBudgetRequests([saved]);
    expect(result.pending).toHaveLength(0);
    expect(result.pipeline).toEqual([saved]);
  });

  it("usa a existência canônica da versão, independentemente do status", () => {
    const legacyEvent = event("legacy", "public_budget_form", "2026-01-01");

    expect(isPendingPublicBudgetRequest({ ...legacyEvent, status: "confirmado" } as any)).toBe(
      true,
    );
    expect(isPendingPublicBudgetRequest({ ...legacyEvent, has_budget_version: true } as any)).toBe(
      false,
    );
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
        { ...persistedByLp, has_budget_version: true },
      ] as any),
    ).toEqual([]);
  });
});
