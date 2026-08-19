import { describe, expect, it } from "vitest";
import { mergeOfficialCanvaFields, OFFICIAL_CANVA_PROPOSAL_FIELDS } from "./proposal-field-catalog";
import { resolveCoupleInitials, resolveProposalField, subtractUtcDays } from "./proposal-field-resolver";

const context = {
  event: {
    id: "event-1", client_name: "Roberta & Paulo", event_name: "Casamento R&P",
    date: "2027-01-03", event_type: "Casamento", guests: 150, duration_hours: 6,
    status: "proposal", is_paid_full: false, created_at: "2026-08-01", updated_at: "2026-08-01",
  },
  budget: {
    id: "budget-1", event_id: "event-1", version_number: 2, is_current: true, status: "draft",
    selected_drinks: [{ nome: "Moscow Mule" }, { name: "Negroni" }], drinks_per_person: 4,
    drinks_markup_percentage: 0, drinks_cost_sum: 0, average_drink_cost: 0, drinks_base_cost: 0,
    drinks_final_value: 5000, has_welcome_drinks: true, welcome_drinks_per_person: 1,
    welcome_drinks_profit_percentage: 0, welcome_drinks_selected: [], welcome_drinks_cost: 0,
    welcome_drinks_final_value: 500, has_shots: true, shots_items: [], shots_total_value: 300,
    bartender_quantity: 3, bartender_unit_value: 200, keeper_quantity: 2, keeper_unit_value: 200,
    copeira_quantity: 1, copeira_unit_value: 200, team_total_value: 1200, ice_packages_quantity: 0,
    ice_package_unit_value: 0, ice_total_value: 0, has_travel: false, fuel_value: 0,
    miscellaneous_items: [], miscellaneous_total_value: 100, discount_value: 250, profit_value: 0,
    final_budget_value: 6850, average_value_per_person: 0, paid_percentage: 0, paid_value: 0,
    pending_percentage: 100, pending_value: 6850, created_at: "2026-08-18T15:00:00Z",
    updated_at: "2026-08-18T15:00:00Z",
  },
};

describe("catálogo fixo do mapper Canva", () => {
  it("dataset vazio gera os 13 campos oficiais", () => {
    expect(mergeOfficialCanvaFields([]).map((field) => field.key)).toEqual(OFFICIAL_CANVA_PROPOSAL_FIELDS);
  });

  it("dataset parcial complementa metadata sem duplicar e preserva extras", () => {
    const fields = mergeOfficialCanvaFields([
      { key: "NOME_EVENTO", name: "Título Canva", type: "string" },
      { key: "CAMPO_EXTRA", name: "Extra", type: "number" },
    ]);
    expect(fields.filter((field) => field.key === "NOME_EVENTO")).toHaveLength(1);
    expect(fields[0]).toEqual({ key: "NOME_EVENTO", name: "Título Canva", type: "string" });
    expect(fields).toHaveLength(14);
  });

  it("dataset completo ainda mantém exatamente o catálogo oficial", () => {
    const fields = mergeOfficialCanvaFields(OFFICIAL_CANVA_PROPOSAL_FIELDS.map((key) => ({ key })));
    expect(fields.map((field) => field.key)).toEqual(OFFICIAL_CANVA_PROPOSAL_FIELDS);
  });
});

describe("resolver central da proposta", () => {
  it("resolve iniciais somente quando identifica os dois nomes", () => {
    expect(resolveCoupleInitials("Roberta & Paulo")).toBe("R | P");
    expect(resolveCoupleInitials("Roberta")).toBeNull();
  });

  it("subtrai sete dias atravessando mês e ano", () => {
    expect(subtractUtcDays("2027-01-03", 7)).toBe("2026-12-27");
  });

  it("usa valores reais do orçamento para total, drinks e equipe", () => {
    expect(resolveProposalField("budget.total_value", context)).toBe(6850);
    expect(resolveProposalField("budget.total_drinks", context)).toBe(600);
    expect(resolveProposalField("budget.bartenders_count", context)).toBe(3);
    expect(resolveProposalField("budget.copeiras_count", context)).toBe(1);
    expect(resolveProposalField("budget.bar_keepers_count", context)).toBe(2);
    expect(resolveProposalField("package.drinks_list", context)).toEqual(["Moscow Mule", "Negroni"]);
    expect(resolveProposalField("budget.created_at", context)).toBe("2026-08-18T15:00:00Z");
  });
});
