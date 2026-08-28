import { describe, expect, it } from "vitest";
import { assertPersistedBudgetRequest } from "./budget-request-service";

describe("assertPersistedBudgetRequest", () => {
  const eventId = "123e4567-e89b-42d3-a456-426614174000";

  it("aceita sucesso somente com state USED e event_id persistido", () => {
    expect(
      assertPersistedBudgetRequest({ state: "USED", idempotent: false, event_id: eventId }),
    ).toEqual({ state: "USED", idempotent: false, event_id: eventId });
  });

  it.each([
    undefined,
    {},
    { state: "USED", idempotent: false },
    { state: "ACTIVE", event_id: eventId },
    { state: "USED", event_id: "not-an-id" },
  ])("rejeita resposta sem confirmação real de persistência: %j", (response) => {
    expect(() => assertPersistedBudgetRequest(response)).toThrow(/não confirmou a persistência/);
  });
});
