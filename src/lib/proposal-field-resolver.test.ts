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
  formatBulletList,
  formatCanvaProposalField,
  formatCurrency,
  formatDateDot,
  formatProposalDateText,
  formatProposalFieldValue,
  resolveCanonicalProposalData,
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
  it("prioriza iniciais explícitas e deriva do nome do evento quando ausentes", () => {
    expect(resolveProposalField("computed.groom_initial", context)).toBe("P");
    expect(resolveProposalField("computed.bride_initial", context)).toBe("R");
    expect(resolveExplicitInitial(undefined)).toBeNull();
    expect(
      resolveProposalField("computed.groom_initial", {
        ...context,
        event: { ...context.event, groom_name: null },
      }),
    ).toBe("C");
  });
  it("mantém o resolver legado para mappings persistidos", () => {
    expect(isValidSourceFieldKey("computed.couple_initials")).toBe(true);
    expect(PROPOSAL_FIELD_CATALOG.some((field) => field.key === "computed.couple_initials")).toBe(
      false,
    );
    expect(resolveProposalField("computed.couple_initials", context)).toBeNull();
  });
});

describe("matriz canônica dos campos", () => {
  it("mantém cada opção do catálogo conectada a um resolver explícito", async () => {
    const { hasProposalFieldResolver } = await import("./proposal-field-resolver");
    for (const field of PROPOSAL_FIELD_CATALOG)
      expect(hasProposalFieldResolver(field.key)).toBe(true);
    expect(PROPOSAL_FIELD_CATALOG).toHaveLength(16);
  });

  it("resolve e formata o payload completo sem valores técnicos acidentais e com dados limpos", async () => {
    const { OFFICIAL_CANVA_SOURCE_MAP } = await import("./proposal-field-catalog");
    const complete = {
      event: { ...context.event, event_name: "Casamento Roberta e Paulo", duration_hours: 6 },
      budget: context.budget,
      hydratedData: { selectedDrinkNames: ["Moscow Mule", "Fitzgerald"] },
    };
    const formatters: Record<string, string> = {
      DATA_ORCAMENTO: "date_dot",
      DATA_EVENTO: "date_dot",
      VALOR_INVESTIMENTO: "currency",
      DATA_FINAL_PAGAMENTO: "date_dot",
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
      DATA_ORCAMENTO: "18.08.2026",
      DATA_EVENTO: "20.10.2026",
      INO: "P",
      INA: "R",
      QUANTIDADE_PESSOAS: "150",
      DRINKS: "Moscow Mule, Fitzgerald",
      BEBIDAS: "Água com gás, Refrigerante zero, Vinho branco",
      QTD_BARTENDERS: "3",
      QTD_COPEIRAS: "1",
      QTD_BAR_KEEPERS: "2",
      QUANTIDADE_DRINKS: "2",
      VALOR_INVESTIMENTO: "R$ 6.850,00",
      DATA_FINAL_PAGAMENTO: "13.10.2026",
      QUANTIDADE_HORAS_EVENTO: "6",
    });
    for (const value of Object.values(payload))
      expect(value).not.toMatch(/undefined|null|NaN|\[object Object\]|^[0-9a-f-]{36}$/);
  });
});

describe("cálculo operacional de QUANTIDADE TOTAL DE DRINKS (computed.total_drinks)", () => {
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
});

describe("cálculo de VARIEDADES DE DRINKS (computed.total_drink_varieties)", () => {
  it("calcula a quantidade de drinks distintos no cardápio", () => {
    const ctx = {
      event: { guests: 150 },
      budget: {
        drinks_per_person: 4,
        selected_drinks: [
          "Caipivodka limão cravo e mel",
          "Caip Maracujá com baunilha",
          "Caipivodka Morango",
          "Fitzgerald",
          "Tom Collins",
          "Moscow Mule",
        ],
      },
    };
    expect(resolveProposalField("computed.total_drink_varieties", ctx)).toBe(6);
  });

  it("deduplica drinks com nomes repetidos", () => {
    const ctx = {
      event: { guests: 100 },
      budget: {
        selected_drinks: ["Moscow Mule", "Fitzgerald", "Moscow Mule"],
      },
    };
    expect(resolveProposalField("computed.total_drink_varieties", ctx)).toBe(2);
  });

  it("calcula a partir de objetos hidratados ou IDs", () => {
    const ctx = {
      event: { guests: 100 },
      budget: {
        selected_drinks: [{ nome: "Gin Tônica" }, { nome: "Negroni" }, { nome: "Gin Tônica" }],
      },
    };
    expect(resolveProposalField("computed.total_drink_varieties", ctx)).toBe(2);
  });

  it("retorna null se o cardápio estiver vazio", () => {
    const ctx = {
      event: { guests: 100 },
      budget: { selected_drinks: [] },
    };
    expect(resolveProposalField("computed.total_drink_varieties", ctx)).toBeNull();
  });
});

describe("Apresentação visual da proposta Canva (formatCanvaProposalField)", () => {
  const fixture = {
    event: {
      guests: 82,
      duration_hours: 6,
      date: "2026-11-14",
    },
    budget: {
      bartender_quantity: 2,
      keeper_quantity: 1,
      copeira_quantity: 0,
      drinks_per_person: 3,
      final_budget_value: 2035.34,
      created_at: "2026-08-19",
    },
    drinks: [
      "Caipivodka limão cravo e mel",
      "Caip Maracujá com baunilha",
      "Caipivodka Morango",
      "Fitzgerald",
      "Tom Collins",
      "Moscow Mule",
    ],
    beverages: ["Gin O'gin ou Gordons", "Vodka Smirnoff"],
    finalPaymentDate: "2026-11-07",
  };

  it("formata QUANTIDADE_PESSOAS enviando apenas o número", () => {
    expect(formatCanvaProposalField("QUANTIDADE_PESSOAS", 82)).toBe("82");
    expect(formatCanvaProposalField("QUANTIDADE_PESSOAS", 1)).toBe("1");
    expect(formatCanvaProposalField("QUANTIDADE_PESSOAS", null)).toBe("");
  });

  it("formata QUANTIDADE_HORAS_EVENTO enviando apenas o número", () => {
    expect(formatCanvaProposalField("QUANTIDADE_HORAS_EVENTO", 6)).toBe("6");
    expect(formatCanvaProposalField("QUANTIDADE_HORAS_EVENTO", 1)).toBe("1");
    expect(formatCanvaProposalField("QUANTIDADE_HORAS_EVENTO", null)).toBe("");
  });

  it("formata equipe como ÚNICA exceção que combina quantidade + nome da função", () => {
    expect(formatCanvaProposalField("QTD_BARTENDERS", 2)).toBe("2 Bartenders");
    expect(formatCanvaProposalField("QTD_BARTENDERS", 1)).toBe("1 Bartender");
    expect(formatCanvaProposalField("QTD_BARTENDERS", 0)).toBe("");
    expect(formatCanvaProposalField("QTD_BAR_KEEPERS", 1)).toBe("1 Bar Keeper");
    expect(formatCanvaProposalField("QTD_BAR_KEEPERS", 2)).toBe("2 Bar Keepers");
    expect(formatCanvaProposalField("QTD_BAR_KEEPERS", 0)).toBe("");
    expect(formatCanvaProposalField("QTD_COPEIRAS", 0)).toBe("");
    expect(formatCanvaProposalField("QTD_COPEIRAS", 1)).toBe("1 Copeira");
    expect(formatCanvaProposalField("QTD_COPEIRAS", 3)).toBe("3 Copeiras");
  });

  it("formata DRINKS e BEBIDAS com um único marcador • por item", () => {
    expect(formatCanvaProposalField("DRINKS", fixture.drinks)).toBe(
      "• Caipivodka limão cravo e mel\n• Caip Maracujá com baunilha\n• Caipivodka Morango\n• Fitzgerald\n• Tom Collins\n• Moscow Mule",
    );
    expect(formatCanvaProposalField("BEBIDAS", fixture.beverages)).toBe(
      "• Gin O'gin ou Gordons\n• Vodka Smirnoff",
    );
  });

  it("formata datas no padrão DD.MM.AAAA com ponto exclusivamente", () => {
    expect(formatCanvaProposalField("DATA_EVENTO", "2026-11-14")).toBe("14.11.2026");
    expect(formatCanvaProposalField("DATA_ORCAMENTO", "2026-08-19")).toBe("19.08.2026");
  });

  it("formata DATA_FINAL_PAGAMENTO enviando somente a data DD.MM.AAAA", () => {
    expect(formatCanvaProposalField("DATA_FINAL_PAGAMENTO", "2026-11-07")).toBe("07.11.2026");
  });

  it("formata VALOR_INVESTIMENTO enviando somente o valor monetário formatado", () => {
    expect(formatCanvaProposalField("VALOR_INVESTIMENTO", 2035.34)).toMatch(/R\$\s*2\.035,34/);
  });

  it("formata QUANTIDADE_DRINKS enviando somente o número de variedades", () => {
    expect(formatCanvaProposalField("QUANTIDADE_DRINKS", 6)).toBe("6");
    expect(formatCanvaProposalField("QUANTIDADE_DRINKS", 1)).toBe("1");
    expect(formatCanvaProposalField("QUANTIDADE_DRINKS", null)).toBe("");
  });
});

describe("Testes Obrigatórios de Auditoria da Proposta Comercial", () => {
  it("usa somente event_name no nome e no monograma, sem fallback para o solicitante", () => {
    const proposalContext = {
      event: {
        event_name: "Sidney & Lúcia",
        client_name: "Mariana Campos Moreira",
        groom_name: null,
        bride_name: null,
      },
      budget: {},
    };

    const canonical = resolveCanonicalProposalData(proposalContext);
    expect(canonical.nomeEvento).toBe("Sidney & Lúcia");
    expect(canonical.inicialNoivo).toBe("S");
    expect(canonical.inicialNoiva).toBe("L");
    expect(resolveProposalField("computed.couple_initials", proposalContext)).toBe("S | L");

    const missingEventName = resolveCanonicalProposalData({
      ...proposalContext,
      event: { ...proposalContext.event, event_name: "" },
    });
    expect(missingEventName.nomeEvento).toBe("");
    expect(missingEventName.inicialNoivo).toBe("");
    expect(missingEventName.inicialNoiva).toBe("");
  });

  it("formata data brasileira isolada sem alterar texto não semântico", () => {
    expect(formatProposalDateText("26/08/2026")).toBe("26.08.2026");
    expect(formatProposalFieldValue("26/08/2026", "date_canva")).toBe("26.08.2026");
    expect(formatProposalFieldValue("Código 26/08/2026", "raw")).toBe("Código 26/08/2026");
  });

  it("formata data de vencimento dentro do texto composto", () => {
    expect(formatProposalDateText("Restante até dia 03/10/2026")).toBe(
      "Restante até dia 03.10.2026",
    );
    expect(formatCanvaProposalField("DATA_FINAL_PAGAMENTO", "Restante até dia 03/10/2026")).toBe(
      "Restante até dia 03.10.2026",
    );
  });

  it("TESTE A — Datas: 2026-11-07 -> 07.11.2026", () => {
    expect(formatDateDot("2026-11-07")).toBe("07.11.2026");
    expect(formatProposalFieldValue("2026-11-07", "date_dot")).toBe("07.11.2026");
    expect(formatProposalFieldValue("2026-11-07", "date_short")).toBe("07.11.2026");
    expect(formatProposalFieldValue("2026-11-07", "date_canva")).toBe("07.11.2026");
  });

  it("TESTE B — Marcadores: nunca gerar • • Moscow Mule", () => {
    expect(formatBulletList(["• Moscow Mule"])).toBe("• Moscow Mule");
    expect(formatBulletList(["• • Moscow Mule"])).toBe("• Moscow Mule");
    expect(formatBulletList(["- Moscow Mule"])).toBe("• Moscow Mule");
    expect(formatBulletList(["Moscow Mule"])).toBe("• Moscow Mule");
    expect(formatBulletList("• Moscow Mule\n• • Fitzgerald\n- Negroni")).toBe(
      "• Moscow Mule\n• Fitzgerald\n• Negroni",
    );
  });

  it("TESTE C — Variedades de drinks: Cardápio com 6 drinks distintos -> 6", () => {
    const ctx = {
      event: { guests: 150 },
      budget: {
        drinks_per_person: 4,
        selected_drinks: [
          "Caipivodka limão cravo e mel",
          "Caip Maracujá com baunilha",
          "Caipivodka Morango",
          "Fitzgerald",
          "Tom Collins",
          "Moscow Mule",
        ],
      },
    };
    const count = resolveProposalField("computed.total_drink_varieties", ctx);
    expect(count).toBe(6);
    expect(formatCanvaProposalField("QUANTIDADE_DRINKS", count)).toBe("6");
    // Garante que não é o consumo total (600)
    expect(count).not.toBe(600);
  });

  it("TESTE D — Equipe completa: 2 bartenders, 1 bar keeper, 2 copeiras", () => {
    expect(formatCanvaProposalField("QTD_BARTENDERS", 2)).toBe("2 Bartenders");
    expect(formatCanvaProposalField("QTD_BAR_KEEPERS", 1)).toBe("1 Bar Keeper");
    expect(formatCanvaProposalField("QTD_COPEIRAS", 2)).toBe("2 Copeiras");
  });

  it("TESTE E — Equipe parcial: 2 bartenders, 1 bar keeper, 0 copeiras (sem '0 Copeiras')", () => {
    expect(formatCanvaProposalField("QTD_BARTENDERS", 2)).toBe("2 Bartenders");
    expect(formatCanvaProposalField("QTD_BAR_KEEPERS", 1)).toBe("1 Bar Keeper");
    expect(formatCanvaProposalField("QTD_COPEIRAS", 0)).toBe("");
    expect(formatCanvaProposalField("QTD_COPEIRAS", null)).toBe("");
  });

  it("não envia o zero default da duração que aparecia abaixo do número de convidados", () => {
    expect(formatCanvaProposalField("QUANTIDADE_HORAS_EVENTO", 0)).toBe("");
    expect(formatCanvaProposalField("QUANTIDADE_HORAS_EVENTO", "0")).toBe("");
    expect(formatCanvaProposalField("QUANTIDADE_HORAS_EVENTO", 6)).toBe("6");
  });

  it("TESTE F — Campo sem informação: Campo opcional = null -> campo vazio ''", () => {
    expect(formatCanvaProposalField("NOME_EVENTO", null)).toBe("");
    expect(formatCanvaProposalField("QUANTIDADE_PESSOAS", null)).toBe("");
    expect(formatCanvaProposalField("QUANTIDADE_HORAS_EVENTO", null)).toBe("");
    expect(formatCanvaProposalField("QUANTIDADE_DRINKS", null)).toBe("");
    expect(formatCanvaProposalField("DATA_ORCAMENTO", null)).toBe("");
    expect(formatCanvaProposalField("DATA_EVENTO", null)).toBe("");
    expect(formatCanvaProposalField("DATA_FINAL_PAGAMENTO", null)).toBe("");
    expect(formatCanvaProposalField("VALOR_INVESTIMENTO", null)).toBe("");
    expect(formatCanvaProposalField("DRINKS", null)).toBe("");
    expect(formatCanvaProposalField("BEBIDAS", null)).toBe("");
  });
});

describe("resolveCanonicalProposalData", () => {
  it("resolve todos os 15 campos canônicos oficiais e o dicionário de valores Canva", async () => {
    const { resolveCanonicalProposalData } = await import("./proposal-field-resolver");
    const canonical = resolveCanonicalProposalData(context);

    expect(canonical.nomeEvento).toBe("Casamento");
    expect(canonical.dataOrcamento).toBe("18.08.2026");
    expect(canonical.dataEvento).toBe("20.10.2026");
    expect(canonical.inicialNoivo).toBe("P");
    expect(canonical.inicialNoiva).toBe("R");
    expect(canonical.quantidadePessoas).toBe(150);
    expect(canonical.quantidadePessoasFormatted).toBe("150");
    expect(canonical.drinks).toEqual(["Moscow Mule"]);
    expect(canonical.drinksFormatted).toBe("• Moscow Mule");
    expect(canonical.bebidas).toEqual(["Água com gás", "Refrigerante zero", "Vinho branco"]);
    expect(canonical.bebidasFormatted).toBe("• Água com gás\n• Refrigerante zero\n• Vinho branco");
    expect(canonical.qtdBartenders).toBe(3);
    expect(canonical.qtdBartendersFormatted).toBe("3 Bartenders");
    expect(canonical.qtdCopeiras).toBe(1);
    expect(canonical.qtdCopeirasFormatted).toBe("1 Copeira");
    expect(canonical.qtdBarKeepers).toBe(2);
    expect(canonical.qtdBarKeepersFormatted).toBe("2 Bar Keepers");
    expect(canonical.quantidadeVariedadesDrinks).toBe(1);
    expect(canonical.quantidadeVariedadesDrinksFormatted).toBe("1");
    expect(canonical.valorInvestimento).toBe(6850);
    expect(canonical.valorInvestimentoFormatted).toMatch(/R\$\s*6\.850,00/);
    expect(canonical.dataFinalPagamento).toBe("13.10.2026");

    // Verifica que o dicionário officialCanvaValues contém as 15 chaves exatamente
    expect(Object.keys(canonical.officialCanvaValues)).toHaveLength(15);
    expect(canonical.officialCanvaValues.VALOR_INVESTIMENTO).toMatch(/R\$\s*6\.850,00/);
    expect(canonical.officialCanvaValues.DATA_FINAL_PAGAMENTO).toBe("13.10.2026");
  });
});
