import { describe, expect, it } from "vitest";
import {
  auditCanvaFields,
  isValidSourceFieldKey,
  mergeOfficialCanvaFields,
  normalizeCanvaFieldKey,
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
    beverages: ["Água com gás", "Refrigerante zero", "Vinho branco"],
    drinks_per_person: 4,
    final_budget_value: 6850,
    bartender_quantity: 3,
    copeira_quantity: 1,
    keeper_quantity: 2,
    created_at: "2026-08-18T15:00:00Z",
  },
};

describe("campos oficiais Canva", () => {
  it("mantém catálogo oficial e dataset real como conceitos independentes", () => {
    expect(auditCanvaFields([], [])).toMatchObject({ officialCount: 15, datasetCount: 0 });
    expect(auditCanvaFields([{ key: "INO" }, { key: "INA" }], [])).toMatchObject({
      officialCount: 15,
      datasetCount: 2,
    });
  });
  it("mantém mappings ausentes e os valida automaticamente quando o dataset muda", () => {
    const mappingKeys = [...OFFICIAL_CANVA_PROPOSAL_FIELDS];
    const before = auditCanvaFields([{ key: "INO" }, { key: "INA" }], mappingKeys);
    expect(before).toMatchObject({ configuredMappingCount: 15, validMappingCount: 2 });
    expect(before.missingMappingKeys).toHaveLength(13);
    expect(mappingKeys).toHaveLength(15);
    expect(
      auditCanvaFields(
        mappingKeys.map((key) => ({ key })),
        mappingKeys,
      ),
    ).toMatchObject({
      configuredMappingCount: 15,
      validMappingCount: 15,
      missingMappingKeys: [],
    });
  });
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
  it("não reintroduz INICIAIS_NOIVOS mesmo quando o dataset legado ainda o contém", () => {
    expect(
      mergeOfficialCanvaFields([{ key: "INICIAIS_NOIVOS" }]).map((field) => field.key),
    ).not.toContain("INICIAIS_NOIVOS");
  });
  it("normaliza espaços sem alterar a key real e deduplica catálogo, dataset e mapping", () => {
    expect(normalizeCanvaFieldKey(" quantidade_ pessoas ")).toBe("QUANTIDADE_PESSOAS");
    const merged = mergeOfficialCanvaFields([{ key: "QUANTIDADE_ PESSOAS", type: "number" }]);
    expect(
      merged.filter((field) => normalizeCanvaFieldKey(field.key) === "QUANTIDADE_PESSOAS"),
    ).toEqual([{ key: "QUANTIDADE_ PESSOAS", name: "QUANTIDADE_PESSOAS", type: "number" }]);
    expect(
      auditCanvaFields([{ key: "QUANTIDADE_ PESSOAS" }], ["QUANTIDADE_PESSOAS"]),
    ).toMatchObject({ configuredMappingCount: 1, validMappingCount: 1, missingMappingKeys: [] });
  });
  it("conta mapping legado separadamente sem tratá-lo como campo oficial", () => {
    expect(auditCanvaFields([{ key: "INO" }], ["INO", "INICIAIS_NOIVOS"])).toMatchObject({
      officialCount: 15,
      datasetCount: 1,
      configuredMappingCount: 2,
      validMappingCount: 1,
      legacyMappingKeys: ["INICIAIS_NOIVOS"],
    });
  });
  it("inclui INO, INA e BEBIDAS, mas não oferece o legado", () => {
    expect(OFFICIAL_CANVA_PROPOSAL_FIELDS).toEqual(
      expect.arrayContaining(["INO", "INA", "BEBIDAS"]),
    );
    expect(OFFICIAL_CANVA_PROPOSAL_FIELDS).not.toContain("INICIAIS_NOIVOS");
  });
  it("sugere as fontes oficiais separadas para INO, INA e BEBIDAS", async () => {
    const { suggestAutoMatches } = await import("./proposal-field-catalog");
    expect(suggestAutoMatches([{ key: "INO" }, { key: "INA" }, { key: "BEBIDAS" }])).toEqual({
      INO: "computed.groom_initial",
      INA: "computed.bride_initial",
      BEBIDAS: "budget.beverages",
    });
  });
});

describe("resolver", () => {
  it("resolve bebidas como lista e formata separadamente", () => {
    const value = resolveProposalField("budget.beverages", context);
    expect(value).toEqual(["Água com gás", "Refrigerante zero", "Vinho branco"]);
    expect(formatProposalFieldValue(value)).toBe("Água com gás, Refrigerante zero, Vinho branco");
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
