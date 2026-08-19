import { describe, expect, it } from "vitest";
import {
  isValidSourceFieldKey,
  mergeOfficialCanvaFields,
  OFFICIAL_CANVA_PROPOSAL_FIELDS,
  PROPOSAL_FIELD_CATALOG,
} from "./proposal-field-catalog";
import {
  formatProposalFieldValue,
  resolveExplicitInitial,
  resolveProposalField,
} from "./proposal-field-resolver";

const context: any = {
  event: {
    id: "event-1",
    client_name: "Roberta & Paulo",
    bride_name: "Roberta",
    groom_name: "Paulo",
    event_name: "Casamento",
    date: "2026-10-20",
    guests: 150,
  },
  budget: {
    selected_drinks: [{ nome: "Moscow Mule" }],
    beverages: ["Água", "Espumante"],
    drinks_per_person: 4,
    final_budget_value: 6850,
    bartender_quantity: 3,
    copeira_quantity: 1,
    keeper_quantity: 2,
    created_at: "2026-08-18T15:00:00Z",
  },
};

describe("campos oficiais Canva", () => {
  it("oferece os 15 campos na ordem oficial para dataset vazio", () => {
    expect(OFFICIAL_CANVA_PROPOSAL_FIELDS).toHaveLength(15);
    expect(mergeOfficialCanvaFields([]).map((field) => field.key)).toEqual(
      OFFICIAL_CANVA_PROPOSAL_FIELDS,
    );
  });
  it("mescla dataset parcial e completo sem duplicar", () => {
    expect(mergeOfficialCanvaFields([{ key: "INO", name: "Inicial" }])).toHaveLength(15);
    const full = mergeOfficialCanvaFields(OFFICIAL_CANVA_PROPOSAL_FIELDS.map((key) => ({ key })));
    expect(new Set(full.map((field) => field.key)).size).toBe(15);
  });
  it("inclui INO, INA e BEBIDAS, mas não oferece o legado", () => {
    expect(OFFICIAL_CANVA_PROPOSAL_FIELDS).toEqual(
      expect.arrayContaining(["INO", "INA", "BEBIDAS"]),
    );
    expect(OFFICIAL_CANVA_PROPOSAL_FIELDS).not.toContain("INICIAIS_NOIVOS");
  });
});

describe("resolver", () => {
  it("resolve bebidas como lista e formata separadamente", () => {
    const value = resolveProposalField("budget.beverages", context);
    expect(value).toEqual(["Água", "Espumante"]);
    expect(formatProposalFieldValue(value)).toBe("Água, Espumante");
    expect(PROPOSAL_FIELD_CATALOG.some((field) => field.key === "budget.beverages")).toBe(true);
  });
  it("resolve iniciais exclusivamente das fontes explícitas", () => {
    expect(resolveProposalField("computed.groom_initial", context)).toBe("P");
    expect(resolveProposalField("computed.bride_initial", context)).toBe("R");
    expect(resolveExplicitInitial(undefined)).toBeNull();
    expect(
      resolveProposalField("computed.groom_initial", {
        ...context,
        event: { ...context.event, groom_name: null },
      }),
    ).toBeNull();
  });
  it("mantém o resolver legado para mappings persistidos", () => {
    expect(isValidSourceFieldKey("computed.couple_initials")).toBe(true);
    expect(PROPOSAL_FIELD_CATALOG.some((field) => field.key === "computed.couple_initials")).toBe(
      false,
    );
    expect(resolveProposalField("computed.couple_initials", context)).toBe("R | P");
  });
});
