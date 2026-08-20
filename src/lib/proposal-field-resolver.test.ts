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
  it("mantém Data Fields extras fora das 15 linhas oficiais", () => {
    const fields = mergeOfficialCanvaFields([{ key: "CAMPO_EXTRA_CANVA" }]);
    expect(fields).toHaveLength(15);
    expect(fields.map((field) => field.key)).not.toContain("CAMPO_EXTRA_CANVA");
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
  it("resolve os nomes hidratados do formato real { ids } sem serializar objetos", () => {
    const value = resolveProposalField("package.drinks_list", {
      ...context,
      hydratedData: { selectedDrinkNames: ["Moscow Mule", "Fitzgerald"] },
    });
    expect(value).toEqual(["Moscow Mule", "Fitzgerald"]);
    expect(formatProposalFieldValue(value)).toBe("Moscow Mule, Fitzgerald");
  });
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

describe("matriz canônica dos 15 campos", () => {
  it("mantém cada opção do catálogo conectada a um resolver explícito", async () => {
    const { hasProposalFieldResolver } = await import("./proposal-field-resolver");
    for (const field of PROPOSAL_FIELD_CATALOG)
      expect(hasProposalFieldResolver(field.key)).toBe(true);
    expect(PROPOSAL_FIELD_CATALOG).toHaveLength(15);
  });

  it("resolve e formata o payload completo sem valores técnicos acidentais", async () => {
    const { OFFICIAL_CANVA_SOURCE_MAP } = await import("./proposal-field-catalog");
    const complete = {
      event: { ...context.event, event_name: "Casamento Roberta e Paulo", duration_hours: 6 },
      budget: context.budget,
      hydratedData: { selectedDrinkNames: ["Moscow Mule", "Fitzgerald"] },
    };
    const formatters: Record<string, string> = {
      DATA_ORCAMENTO: "date_short",
      DATA_EVENTO: "date_short",
      VALOR_INVESTIMENTO: "currency",
      DATA_FINAL_PAGAMENTO: "date_short",
      QUANTIDADE_PESSOAS: "integer",
      QUANTIDADE_DRINKS: "integer",
    };
    const payload = Object.fromEntries(
      OFFICIAL_CANVA_PROPOSAL_FIELDS.map((canvaKey) => {
        const raw = resolveProposalField(OFFICIAL_CANVA_SOURCE_MAP[canvaKey], complete);
        return [canvaKey, formatProposalFieldValue(raw, formatters[canvaKey] || "raw")];
      }),
    );
    expect(payload).toEqual({
      NOME_EVENTO: "Casamento Roberta e Paulo",
      DATA_ORCAMENTO: "18/08/2026",
      DATA_EVENTO: "20/10/2026",
      INO: "P",
      INA: "R",
      QUANTIDADE_PESSOAS: "150",
      DRINKS: "Moscow Mule, Fitzgerald",
      BEBIDAS: "Água com gás, Refrigerante zero, Vinho branco",
      QTD_BARTENDERS: "3",
      QTD_COPEIRAS: "1",
      QTD_BAR_KEEPERS: "2",
      QUANTIDADE_DRINKS: "600",
      VALOR_INVESTIMENTO: "R$ 6.850,00",
      DATA_FINAL_PAGAMENTO: "13/10/2026",
      QUANTIDADE_HORAS_EVENTO: "6",
    });
    for (const value of Object.values(payload))
      expect(value).not.toMatch(/undefined|null|NaN|\[object Object\]|^[0-9a-f-]{36}$/);
  });
});

describe("cálculo automático de QUANTIDADE_DRINKS (computed.total_drinks)", () => {
  it("calcula guests * drinks_per_person com números", () => {
    const res = resolveProposalField("computed.total_drinks", {
      event: { guests: 150 },
      budget: { drinks_per_person: 4 },
    });
    expect(res).toBe(600);
  });

  it("calcula guests * drinks_per_person com strings numéricas", () => {
    const res = resolveProposalField("computed.total_drinks", {
      event: { guests: "150" },
      budget: { drinks_per_person: "4" },
    });
    expect(res).toBe(600);
  });

  it("calcula 0 quando guests é 0", () => {
    const res = resolveProposalField("computed.total_drinks", {
      event: { guests: 0 },
      budget: { drinks_per_person: 4 },
    });
    expect(res).toBe(0);
  });

  it("retorna null quando drinks_per_person é null ou undefined", () => {
    expect(
      resolveProposalField("computed.total_drinks", {
        event: { guests: 150 },
        budget: { drinks_per_person: null },
      }),
    ).toBeNull();
    expect(
      resolveProposalField("computed.total_drinks", {
        event: { guests: 150 },
        budget: { drinks_per_person: undefined },
      }),
    ).toBeNull();
  });

  it("retorna null quando guests é null ou undefined", () => {
    expect(
      resolveProposalField("computed.total_drinks", {
        event: { guests: null },
        budget: { drinks_per_person: 4 },
      }),
    ).toBeNull();
    expect(
      resolveProposalField("computed.total_drinks", {
        event: { guests: undefined },
        budget: { drinks_per_person: 4 },
      }),
    ).toBeNull();
  });

  it("resolve aliases legados para computed.total_drinks", () => {
    const ctx = {
      event: { guests: 100 },
      budget: { drinks_per_person: 5 },
    };
    expect(resolveProposalField("budget.total_drinks", ctx)).toBe(500);
    expect(resolveProposalField("package.drinks_count", ctx)).toBe(500);
    expect(resolveProposalField("package.total_drinks", ctx)).toBe(500);
    expect(resolveProposalField("budget.quantity_drinks", ctx)).toBe(500);
    expect(resolveProposalField("budget.drinks_count", ctx)).toBe(500);
  });

  it("não confunde com a quantidade de tipos de drinks selecionados", () => {
    const ctx = {
      event: { guests: 150 },
      budget: {
        drinks_per_person: 4,
        selected_drinks: ["d1", "d2", "d3", "d4", "d5", "d6", "d7"],
      },
    };
    expect(resolveProposalField("computed.total_drinks", ctx)).toBe(600);
    expect(resolveProposalField("computed.total_drinks", ctx)).not.toBe(7);
  });
});
