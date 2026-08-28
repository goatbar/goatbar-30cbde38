import { describe, expect, it } from "vitest";
import {
  createBudgetEventSnapshot,
  getBudgetVersionEventContext,
  getBudgetVersionGuestCount,
} from "./budget-version-snapshot";
import { resolveProposalField } from "./proposal-field-resolver";

describe("snapshot histórico de propostas", () => {
  it("mantém convidados, cálculos e Canva de duas versões após editar o evento", () => {
    const event = { guests: 80, date: "2026-09-01", duration_hours: 5, event_location: "A" };
    const proposalA = {
      guest_count: 80,
      drinks_per_person: 4,
      final_budget_value: 12_500,
      event_snapshot: createBudgetEventSnapshot(event),
    };
    const originalA = structuredClone(proposalA);

    // Editing the event and saving B never mutates A.
    event.guests = 120;
    event.duration_hours = 7;
    event.event_location = "B";
    const proposalB = {
      guest_count: event.guests,
      drinks_per_person: 4,
      final_budget_value: 16_800,
      event_snapshot: createBudgetEventSnapshot(event),
    };

    expect(proposalA).toEqual(originalA);
    expect(getBudgetVersionGuestCount(proposalA, event)).toBe(80);
    expect(getBudgetVersionGuestCount(proposalB, event)).toBe(120);
    expect(resolveProposalField("computed.total_drinks", { event, budget: proposalA })).toBe(320);
    expect(resolveProposalField("computed.total_drinks", { event, budget: proposalB })).toBe(480);
    expect(resolveProposalField("event.guests", { event, budget: proposalA })).toBe(80);
    expect(resolveProposalField("event.guests", { event, budget: proposalB })).toBe(120);
    expect(proposalA.final_budget_value).toBe(12_500);
    expect(getBudgetVersionEventContext(proposalA, event)).toMatchObject({
      duration_hours: 5,
      event_location: "A",
    });
  });

  it("usa o evento somente como fallback explícito para registros legados", () => {
    expect(getBudgetVersionGuestCount({}, { guests: 90 })).toBe(90);
  });
});
