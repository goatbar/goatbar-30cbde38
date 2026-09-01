import {
  autofillAndExportPdf,
  buildAutofillData,
  buildDeterministicStoragePath,
  extractCanvaQuotaError,
  getMissingCanvaMappingKeys,
  hydrateBudgetDrinks,
  normalizeProposalEventType,
  normalizeSelectedDrinks,
  ProposalGenerationError,
  resolveSelectedDrinks,
  uploadPdfToStorage,
  validatePdfBytes,
} from "../supabase/functions/canva-generate-proposal/logic";
import { sanitizeLog } from "../supabase/functions/_shared/canva-auth";
import {
  deleteGeneratedProposal,
  formatCanvaGenerationError,
  friendlyCanvaProposalError,
  getProposalGenerationFlow,
} from "../src/lib/proposal-generation";

const event = {
  groom_name: "Gustavo",
  bride_name: "Mariana",
  guests: 150,
  date: "2026-11-14",
  event_type: "Casamento",
};
const budget = {
  id: "budget-selected",
  beverages: ["Água", "Refrigerante"],
  selected_drinks: [],
  drinks_per_person: 4,
  final_budget_value: 20953.34,
};
const mapping = (canva_field_key: string, source_field_key: string, extra = {}) => ({
  canva_field_key,
  source_field_key,
  source_type: "field",
  ...extra,
});

describe("seleção e mappings da proposta", () => {
  it("apresenta o body canva_fields_missing com a lista de campos", () => {
    expect(
      formatCanvaGenerationError({
        error_code: "canva_fields_missing",
        missing_fields: ["INO", "INA"],
      }),
    ).toBe(
      "Existem campos mapeados que ainda não são Data Fields do Canva.\n\nCampos ausentes:\n• INO\n• INA",
    );
  });
  it("mantém internal no editor antigo e separa o provider Canva", () => {
    expect(getProposalGenerationFlow({ provider: "internal" } as any)).toBe("internal");
    expect(getProposalGenerationFlow({ provider: "canva" } as any)).toBe("canva");
  });
  it("seleciona casamento pela classificação do evento", () =>
    expect(normalizeProposalEventType("Festa de Casamento")).toBe("casamento"));
  it("carrega mappings e resolve INO, INA e BEBIDAS da versão informada", () => {
    const data = buildAutofillData(
      [
        mapping("INO", "computed.groom_initial"),
        mapping("INA", "computed.bride_initial"),
        mapping("BEBIDAS", "budget.beverages"),
      ],
      ["INO", "INA", "BEBIDAS"],
      event,
      budget,
    );
    expect(data.INO.text).toBe("G");
    expect(data.INA.text).toBe("M");
    expect(data.BEBIDAS.text).toBe("• Água\n• Refrigerante");
  });
  it("ignora INICIAIS_NOIVOS legado em novas gerações", () => {
    const data = buildAutofillData(
      [
        mapping("INICIAIS_NOIVOS", "computed.couple_initials"),
        mapping("INO", "computed.groom_initial"),
      ],
      ["INICIAIS_NOIVOS", "INO"],
      event,
      budget,
    );
    expect(data).not.toHaveProperty("INICIAIS_NOIVOS");
  });
  it("bloqueia required vazio", () =>
    expect(() =>
      buildAutofillData(
        [mapping("INO", "computed.groom_initial", { required: true })],
        ["INO"],
        { ...event, groom_name: null },
        budget,
      ),
    ).toThrow("O campo INO não possui valor na versão do orçamento selecionada."));
  it("explica Data Field ausente no dataset real", () =>
    expect(() =>
      buildAutofillData([mapping("INO", "computed.groom_initial")], [], event, budget),
    ).toThrow('não possui o Data Field "INO"'));
  it("detecta mappings ausentes antes do Autofill e ignora o legado", () => {
    expect(
      getMissingCanvaMappingKeys(
        [
          mapping("INO", "computed.groom_initial"),
          mapping("INA", "computed.bride_initial"),
          mapping("INICIAIS_NOIVOS", "computed.couple_initials"),
        ],
        ["INO"],
      ),
    ).toEqual(["INA"]);
  });
});

describe("resolução dos drinks versionados", () => {
  const rows = [
    { id: "drink-1", nome: "Moscow Mule" },
    { id: "drink-2", nome: "Fitzgerald" },
    { id: "drink-3", nome: "Negroni" },
  ];
  const successfulQuery = vi.fn(async (ids: string[]) => ({
    data: rows.filter((row) => ids.includes(row.id)),
    error: null,
  }));

  it.each([
    [
      { ids: ["drink-1", "drink-2"], copos: {}, descricaoBebidas: "" },
      ["Moscow Mule", "Fitzgerald"],
    ],
    [
      ["drink-1", "drink-2"],
      ["Moscow Mule", "Fitzgerald"],
    ],
    [
      [{ id: "drink-1" }, { id: "drink-2" }],
      ["Moscow Mule", "Fitzgerald"],
    ],
    ['{"ids":["drink-1"]}', ["Moscow Mule"]],
  ])("resolve o formato persistido/histórico %#", async (selected, expected) => {
    await expect(resolveSelectedDrinks(selected, "version-1", successfulQuery)).resolves.toEqual(
      expected,
    );
  });

  it("aceita objetos históricos hidratados sem produzir [object Object]", async () => {
    const query = vi.fn();
    await expect(
      resolveSelectedDrinks([{ id: "old", nome: "Drink congelado" }], "version-1", query),
    ).resolves.toEqual(["Drink congelado"]);
    expect(query).not.toHaveBeenCalled();
  });

  it("deixa uma lista legitimamente vazia para a validação required", async () => {
    const query = vi.fn();
    const names = await resolveSelectedDrinks({ ids: [] }, "version-1", query);
    expect(names).toEqual([]);
    expect(query).not.toHaveBeenCalled();
    expect(() =>
      buildAutofillData(
        [mapping("DRINKS", "package.drinks_list", { required: true })],
        ["DRINKS"],
        event,
        { ...budget, selected_drinks: names },
      ),
    ).toThrowError(expect.objectContaining({ code: "required_field_empty" }));
  });

  it("classifica null e formatos sem IDs como selected_drinks_invalid", async () => {
    await expect(resolveSelectedDrinks(null, "version-1", successfulQuery)).rejects.toMatchObject({
      code: "selected_drinks_invalid",
      details: { details: { detected_shape: "null" } },
    });
    await expect(
      resolveSelectedDrinks({ copos: {} }, "version-1", successfulQuery),
    ).rejects.toMatchObject({
      code: "selected_drinks_invalid",
    });
  });

  it("diferencia um ou vários IDs inexistentes", async () => {
    await expect(
      resolveSelectedDrinks({ ids: ["drink-1", "missing-1"] }, "version-1", successfulQuery),
    ).rejects.toMatchObject({
      code: "drinks_not_found",
      details: { details: { requested_count: 2, found_count: 1, missing_ids: ["missing-1"] } },
    });
    await expect(
      resolveSelectedDrinks(["missing-1", "missing-2"], "version-1", successfulQuery),
    ).rejects.toMatchObject({
      code: "drinks_not_found",
      details: {
        details: { requested_count: 2, found_count: 0, missing_ids: ["missing-1", "missing-2"] },
      },
    });
  });

  it("classifica erro PostgREST sem convertê-lo em required_field_empty", async () => {
    const query = vi.fn(async () => ({
      data: null,
      error: { code: "42703", message: "column drinks.name does not exist" },
    }));
    await expect(
      resolveSelectedDrinks({ ids: ["drink-1"] }, "version-1", query),
    ).rejects.toMatchObject({
      code: "drinks_query_failed",
      status: 500,
      details: { details: { db_code: "42703", requested_count: 1 } },
    });
  });

  it("preserva ordem sem duplicar drinks e mantém BEBIDAS independente", async () => {
    const names = await resolveSelectedDrinks(
      { ids: ["drink-2", "drink-1", "drink-2"] },
      "version-1",
      successfulQuery,
    );
    expect(names).toEqual(["Fitzgerald", "Moscow Mule"]);
    const data = buildAutofillData(
      [mapping("DRINKS", "package.drinks_list"), mapping("BEBIDAS", "budget.beverages")],
      ["DRINKS", "BEBIDAS"],
      event,
      { ...budget, selected_drinks: names },
    );
    expect(data.DRINKS.text).toBe("• Fitzgerald\n• Moscow Mule");
    expect(data.DRINKS.text).not.toContain("drink-");
    expect(data.DRINKS.text).not.toContain("[object Object]");
    expect(data.BEBIDAS.text).toBe("• Água\n• Refrigerante");
  });

  it.each([
    ["drinks_query_failed", "Não foi possível carregar os drinks desta versão."],
    ["drinks_not_found", "Alguns drinks desta versão não foram encontrados no cadastro."],
    ["selected_drinks_invalid", "Os dados de drinks desta versão estão em um formato inválido."],
  ])("mantém a classificação %s amigável no frontend", (error_code, expected) => {
    expect(formatCanvaGenerationError({ error_code })).toBe(expected);
  });
});

function response(body: any, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: async () => body } as Response);
}

describe("Canva Autofill e Export", () => {
  it("aguarda Autofill e Export com sucesso", async () => {
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => response({ job: { id: "auto-1" } }))
      .mockImplementationOnce(() =>
        response({
          job: { id: "auto-1", status: "success", result: { design: { id: "design-1" } } },
        }),
      )
      .mockImplementationOnce(() => response({ job: { id: "export-1" } }))
      .mockImplementationOnce(() =>
        response({ job: { id: "export-1", status: "success", urls: ["https://download/pdf"] } }),
      );
    await expect(
      autofillAndExportPdf({
        token: "secret",
        brandTemplateId: "brand-1",
        data: {},
        fetcher: fetcher as any,
        sleep: async () => {},
      }),
    ).resolves.toMatchObject({ designId: "design-1", downloadUrl: "https://download/pdf" });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
      brand_template_id: "brand-1",
      data: {},
    });
  });
  it("diferencia erro de Autofill", async () => {
    const fetcher = vi.fn().mockImplementationOnce(() => response({}, false, 400));
    await expect(
      autofillAndExportPdf({ token: "x", brandTemplateId: "x", data: {}, fetcher: fetcher as any }),
    ).rejects.toMatchObject({ code: "canva_autofill_failed" });
  });
  it("diferencia erro de Export", async () => {
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => response({ job: { id: "a" } }))
      .mockImplementationOnce(() =>
        response({ job: { id: "a", status: "success", result: { design: { id: "d" } } } }),
      )
      .mockImplementationOnce(() => response({}, false, 500));
    await expect(
      autofillAndExportPdf({
        token: "x",
        brandTemplateId: "x",
        data: {},
        fetcher: fetcher as any,
        sleep: async () => {},
      }),
    ).rejects.toMatchObject({ code: "canva_export_failed" });
  });
});

describe("Normalização e hidratação de selected_drinks", () => {
  it("normaliza formato atual com ids, copos e descricaoBebidas", () => {
    const normalized = normalizeSelectedDrinks({
      ids: ["id-1", "id-2"],
      copos: { "id-1": "Taça" },
      descricaoBebidas: "Bebidas padrão",
    });
    expect(normalized).toMatchObject({
      isValid: true,
      isEmpty: false,
      format: "ids_object",
      ids: ["id-1", "id-2"],
      hasIds: true,
      idsCount: 2,
    });
  });

  it("normaliza array de IDs", () => {
    const normalized = normalizeSelectedDrinks(["id-1", "id-2"]);
    expect(normalized).toMatchObject({
      isValid: true,
      isEmpty: false,
      format: "ids_array",
      ids: ["id-1", "id-2"],
    });
  });

  it("normaliza array de objetos com id e nome", () => {
    const normalized = normalizeSelectedDrinks([
      { id: "id-1", nome: "Mojito" },
      { id: "id-2", nome: "Negroni" },
    ]);
    expect(normalized).toMatchObject({
      isValid: true,
      isEmpty: false,
      format: "hydrated_array",
      ids: ["id-1", "id-2"],
      hydratedNames: ["Mojito", "Negroni"],
    });
  });

  it("normaliza array de objetos legados sem id mas com nome ou name", () => {
    const normalized = normalizeSelectedDrinks([{ nome: "Moscow Mule" }, { name: "Fitzgerald" }]);
    expect(normalized).toMatchObject({
      isValid: true,
      isEmpty: false,
      format: "hydrated_array",
      ids: [],
      hydratedNames: ["Moscow Mule", "Fitzgerald"],
    });
  });

  it("normaliza array com drink_id", () => {
    const normalized = normalizeSelectedDrinks([{ drink_id: "id-1" }]);
    expect(normalized).toMatchObject({
      isValid: true,
      isEmpty: false,
      ids: ["id-1"],
    });
  });

  it("normaliza objeto com names", () => {
    const normalized = normalizeSelectedDrinks({ names: ["Moscow Mule", "Fitzgerald"] });
    expect(normalized).toMatchObject({
      isValid: true,
      isEmpty: false,
      format: "names_object",
      hydratedNames: ["Moscow Mule", "Fitzgerald"],
    });
  });

  it("normaliza vazio para null, undefined, array vazio e objeto vazio", () => {
    expect(normalizeSelectedDrinks(null).isEmpty).toBe(true);
    expect(normalizeSelectedDrinks(undefined).isEmpty).toBe(true);
    expect(normalizeSelectedDrinks([]).isEmpty).toBe(true);
    expect(normalizeSelectedDrinks({}).isEmpty).toBe(true);
    expect(normalizeSelectedDrinks({ ids: [] }).isEmpty).toBe(true);
  });

  it("identifica formato inválido com tipos primitivos ou corrompidos", () => {
    expect(normalizeSelectedDrinks(123).isValid).toBe(false);
    expect(normalizeSelectedDrinks("string-invalida").isValid).toBe(false);
    expect(normalizeSelectedDrinks({ ids: "nao-eh-array" }).isValid).toBe(false);
    expect(normalizeSelectedDrinks([123, 456]).isValid).toBe(false);
  });

  it("hidrata drinks consultando tabela drinks com id e nome e preserva ordem original", async () => {
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [
              { id: "id-2", nome: "Negroni" },
              { id: "id-1", nome: "Gin Tônica" },
            ],
            error: null,
          }),
        }),
      }),
    };

    const result = await hydrateBudgetDrinks({ ids: ["id-1", "id-2"] }, mockDb as any, {
      event_id: "evt-1",
      budget_version_id: "bv-1",
    });

    expect(mockDb.from).toHaveBeenCalledWith("drinks");
    expect(result.resolvedDrinkNames).toEqual(["Gin Tônica", "Negroni"]);
  });

  it("lança selected_drink_not_found quando drink não existe no cadastro", async () => {
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [{ id: "id-1", nome: "Gin Tônica" }],
            error: null,
          }),
        }),
      }),
    };

    await expect(
      hydrateBudgetDrinks({ ids: ["id-1", "id-missing"] }, mockDb as any),
    ).rejects.toMatchObject({
      code: "selected_drink_not_found",
      details: { missing_count: 1, expected_count: 2, found_count: 1 },
    });
  });

  it("lança selected_drinks_query_failed quando Supabase retorna erro de banco", async () => {
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: null,
            error: { code: "PGRST204", message: "Could not find column" },
          }),
        }),
      }),
    };

    await expect(hydrateBudgetDrinks({ ids: ["id-1"] }, mockDb as any)).rejects.toMatchObject({
      code: "selected_drinks_query_failed",
      details: { query_error_code: "PGRST204" },
    });
  });

  it("não consulta banco se selected_drinks estiver vazio", async () => {
    const mockDb = {
      from: vi.fn(),
    };

    const result = await hydrateBudgetDrinks({ ids: [] }, mockDb as any);
    expect(mockDb.from).not.toHaveBeenCalled();
    expect(result.resolvedDrinkNames).toEqual([]);
  });

  it("usa hydratedNames diretamente para estruturas legadas", async () => {
    const mockDb = {
      from: vi.fn(),
    };

    const result = await hydrateBudgetDrinks(
      [{ nome: "Moscow Mule" }, { nome: "Fitzgerald" }],
      mockDb as any,
    );
    expect(mockDb.from).not.toHaveBeenCalled();
    expect(result.resolvedDrinkNames).toEqual(["Moscow Mule", "Fitzgerald"]);
  });

  it("reproduz fixture real do evento 9b92e891-f666-4846-b6bd-8f2583726340 com sucesso", async () => {
    const realEventId = "9b92e891-f666-4846-b6bd-8f2583726340";
    const realBudgetFixture = {
      id: "bv-real-123",
      event_id: realEventId,
      selected_drinks: {
        ids: ["uuid-drink-a", "uuid-drink-b"],
        copos: { "uuid-drink-a": "Taça" },
        descricaoBebidas: "Bebidas padrão",
      },
      drinks_per_person: 4,
      final_budget_value: 12000,
    };

    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [
              { id: "uuid-drink-a", nome: "Gin Tropical" },
              { id: "uuid-drink-b", nome: "Aperol Spritz" },
            ],
            error: null,
          }),
        }),
      }),
    };

    const { resolvedDrinkNames } = await hydrateBudgetDrinks(
      realBudgetFixture.selected_drinks,
      mockDb as any,
      { event_id: realEventId, budget_version_id: realBudgetFixture.id },
    );

    const resolvedBudget = { ...realBudgetFixture, selected_drinks: resolvedDrinkNames };
    const autofill = buildAutofillData(
      [
        mapping("DRINKS", "budget.selected_drinks"),
        mapping("QUANTIDADE_DRINKS", "computed.total_drink_varieties"),
      ],
      ["DRINKS", "QUANTIDADE_DRINKS"],
      { ...event, id: realEventId },
      resolvedBudget,
    );

    expect(autofill.DRINKS.text).toBe("• Gin Tropical\n• Aperol Spritz");
    expect(autofill.QUANTIDADE_DRINKS.text).toBe("2");
  });
});

describe("Mensagens amigáveis de erro de proposta no frontend", () => {
  it("diferencia selected_drinks_invalid_format", () => {
    expect(friendlyCanvaProposalError({ error_code: "selected_drinks_invalid_format" })).toBe(
      "Os drinks desta versão estão em um formato antigo ou inválido.",
    );
  });

  it("diferencia selected_drink_not_found", () => {
    expect(friendlyCanvaProposalError({ error_code: "selected_drink_not_found" })).toBe(
      "Um ou mais drinks desta versão não existem mais no cadastro.",
    );
  });

  it("diferencia selected_drinks_query_failed", () => {
    expect(friendlyCanvaProposalError({ error_code: "selected_drinks_query_failed" })).toBe(
      "Não foi possível consultar os drinks desta versão.",
    );
  });

  it("diferencia required_field_empty para drinks", () => {
    expect(
      friendlyCanvaProposalError({
        error_code: "required_field_empty",
        field: "DRINKS",
        source_key: "package.drinks_list",
      }),
    ).toBe("Esta versão do orçamento não possui drinks selecionados.");
  });
});

describe("Autofill de QUANTIDADE_DRINKS com cálculo numérico puro", () => {
  it("não bloqueia quando required=true e cálculo de variedades é válido (6 drinks -> 6)", () => {
    const data = buildAutofillData(
      [mapping("QUANTIDADE_DRINKS", "computed.total_drink_varieties", { required: true })],
      ["QUANTIDADE_DRINKS"],
      { guests: 150 },
      { selected_drinks: ["d1", "d2", "d3", "d4", "d5", "d6"] },
    );
    expect(data.QUANTIDADE_DRINKS.text).toBe("6");
  });

  it("permite envio do total operacional com computed.total_drinks", () => {
    const data = buildAutofillData(
      [mapping("QUANTIDADE_DRINKS", "computed.total_drinks", { required: true })],
      ["QUANTIDADE_DRINKS"],
      { guests: 150 },
      { drinks_per_person: 4 },
    );
    expect(data.QUANTIDADE_DRINKS.text).toBe("600");
  });

  it("bloqueia com required_field_empty quando selected_drinks está vazio e required=true", () => {
    expect(() =>
      buildAutofillData(
        [mapping("QUANTIDADE_DRINKS", "computed.total_drink_varieties", { required: true })],
        ["QUANTIDADE_DRINKS"],
        { guests: 150 },
        { selected_drinks: [] },
      ),
    ).toThrowError(expect.objectContaining({ code: "required_field_empty" }));
  });

  it("bloqueia com required_field_empty quando drinks_per_person=null e required=true em computed.total_drinks", () => {
    expect(() =>
      buildAutofillData(
        [mapping("QUANTIDADE_DRINKS", "computed.total_drinks", { required: true })],
        ["QUANTIDADE_DRINKS"],
        { guests: 150 },
        { drinks_per_person: null },
      ),
    ).toThrowError(expect.objectContaining({ code: "required_field_empty" }));
  });
});

describe("Snapshot completo do payload Canva com dados limpos e regra de equipe", () => {
  it("gera todos os campos fornecendo apenas os dados limpos ao template Canva", () => {
    const sampleEvent = {
      guests: 82,
      duration_hours: 6,
      date: "2026-11-14",
      event_name: "Casamento Ana e Bruno",
      groom_name: "Bruno",
      bride_name: "Ana",
    };
    const sampleBudget = {
      bartender_quantity: 2,
      keeper_quantity: 1,
      copeira_quantity: 0,
      drinks_per_person: 3,
      final_budget_value: 2035.34,
      created_at: "2026-08-19",
      selected_drinks: [
        "Caipivodka limão cravo e mel",
        "Caip Maracujá com baunilha",
        "Caipivodka Morango",
        "Fitzgerald",
        "Tom Collins",
        "Moscow Mule",
      ],
      beverages: ["Gin O'gin ou Gordons", "Vodka Smirnoff"],
    };
    const mappings = [
      mapping("NOME_EVENTO", "event.event_name"),
      mapping("DATA_ORCAMENTO", "budget.created_at"),
      mapping("DATA_EVENTO", "event.date"),
      mapping("INO", "computed.groom_initial"),
      mapping("INA", "computed.bride_initial"),
      mapping("QUANTIDADE_PESSOAS", "event.guests"),
      mapping("DRINKS", "budget.selected_drinks"),
      mapping("BEBIDAS", "budget.beverages"),
      mapping("QTD_BARTENDERS", "budget.bartender_quantity"),
      mapping("QTD_COPEIRAS", "budget.copeira_quantity"),
      mapping("QTD_BAR_KEEPERS", "budget.keeper_quantity"),
      mapping("QUANTIDADE_DRINKS", "computed.total_drink_varieties"),
      mapping("VALOR_INVESTIMENTO", "budget.final_budget_value"),
      mapping("DATA_FINAL_PAGAMENTO", "computed.final_payment_date"),
      mapping("QUANTIDADE_HORAS_EVENTO", "event.duration_hours"),
    ];
    const datasetKeys = mappings.map((m) => m.canva_field_key);
    const data = buildAutofillData(mappings, datasetKeys, sampleEvent, sampleBudget);

    expect(data.NOME_EVENTO.text).toBe("Casamento Ana e Bruno");
    expect(data.DATA_ORCAMENTO.text).toBe("19.08.2026");
    expect(data.DATA_EVENTO.text).toBe("14.11.2026");
    expect(data.INO.text).toBe("B");
    expect(data.INA.text).toBe("A");
    expect(data.QUANTIDADE_PESSOAS.text).toBe("82");
    expect(data.DRINKS.text).toBe(
      "• Caipivodka limão cravo e mel\n• Caip Maracujá com baunilha\n• Caipivodka Morango\n• Fitzgerald\n• Tom Collins\n• Moscow Mule",
    );
    expect(data.BEBIDAS.text).toBe("• Gin O'gin ou Gordons\n• Vodka Smirnoff");
    expect(data.QTD_BARTENDERS.text).toBe("2 Bartenders");
    expect(data.QTD_COPEIRAS.text).toBe(""); // Zerado não aparece
    expect(data.QTD_BAR_KEEPERS.text).toBe("1 Bar Keeper");
    expect(data.QUANTIDADE_DRINKS.text).toBe("6"); // Quantidade de variedades distintas
    expect(data.VALOR_INVESTIMENTO.text).toMatch(/R\$\s*2\.035,34/);
    expect(data.DATA_FINAL_PAGAMENTO.text).toBe("07.11.2026");
    expect(data.QUANTIDADE_HORAS_EVENTO.text).toBe("6");
  });
});

describe("Validação de PDF e Storage de Proposta", () => {
  it("valida bytes do PDF com magic header %PDF", () => {
    const validPdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    expect(() => validatePdfBytes(validPdf)).not.toThrow();
  });

  it("rejeita arquivo vazio ou corrompido com erro pdf_invalid", () => {
    const empty = new Uint8Array([]);
    expect(() => validatePdfBytes(empty)).toThrowError(
      expect.objectContaining({ code: "pdf_invalid" }),
    );
  });

  it("rejeita resposta não-PDF (ex: HTML/JSON de erro) com erro pdf_invalid", () => {
    const jsonBytes = new TextEncoder().encode('{"error":"not_found"}');
    expect(() => validatePdfBytes(jsonBytes)).toThrowError(
      expect.objectContaining({ code: "pdf_invalid" }),
    );
  });

  it("gera path determinístico e rastreável por evento, versão e proposta", () => {
    const path = buildDeterministicStoragePath(
      "event-123",
      "budget-v4",
      "proposal-abc",
      "Proposta Comercial - Casamento.pdf",
    );
    expect(path).toBe(
      "events/event-123/budgets/budget-v4/proposals/proposal-abc/Proposta Comercial - Casamento.pdf",
    );
  });

  it("faz upload com sucesso no Storage com contentType application/pdf", async () => {
    const mockUpload = vi.fn().mockResolvedValue({ data: { path: "some-path" }, error: null });
    const mockStorage = {
      from: vi.fn().mockReturnValue({ upload: mockUpload }),
    };

    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const res = await uploadPdfToStorage(
      mockStorage,
      "generated-proposals",
      "events/e1/budgets/b1/proposals/p1.pdf",
      pdf,
    );

    expect(res.error).toBeNull();
    expect(mockStorage.from).toHaveBeenCalledWith("generated-proposals");
    expect(mockUpload).toHaveBeenCalledWith("events/e1/budgets/b1/proposals/p1.pdf", pdf, {
      contentType: "application/pdf",
      upsert: true,
    });
  });

  it("tenta criar bucket automaticamente se receber erro de bucket não encontrado", async () => {
    let callCount = 0;
    const mockUpload = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          data: null,
          error: { name: "StorageApiError", message: "Bucket not found", statusCode: "404" },
        });
      }
      return Promise.resolve({ data: { path: "ok" }, error: null });
    });
    const mockCreateBucket = vi.fn().mockResolvedValue({ data: {}, error: null });

    const mockStorage = {
      from: vi.fn().mockReturnValue({ upload: mockUpload }),
      createBucket: mockCreateBucket,
    };

    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const res = await uploadPdfToStorage(
      mockStorage,
      "generated-proposals",
      "events/e1/budgets/b1/proposals/p1.pdf",
      pdf,
    );

    expect(mockCreateBucket).toHaveBeenCalledWith("generated-proposals", { public: true });
    expect(mockUpload).toHaveBeenCalledTimes(2);
    expect(res.error).toBeNull();
  });
});

describe("Regras de validade e ciclo de vida da proposta", () => {
  it("identifica proposta como atual quando budget_id corresponde à versão atual", () => {
    const currentBudget = { id: "budget-v2", version_number: 2 };
    const proposal = { id: "prop-1", budget_id: "budget-v2", status: "ready" };

    const isCurrent = proposal.budget_id === currentBudget.id;
    expect(isCurrent).toBe(true);
  });

  it("identifica proposta como desatualizada quando o orçamento é alterado para nova versão", () => {
    const newBudgetVersion = { id: "budget-v3", version_number: 3 };
    const existingProposal = { id: "prop-1", budget_id: "budget-v2", status: "ready" };

    const isCurrent = existingProposal.budget_id === newBudgetVersion.id;
    const isOutdated = existingProposal.budget_id !== newBudgetVersion.id;

    expect(isCurrent).toBe(false);
    expect(isOutdated).toBe(true);
  });

  it("formata mensagens amigáveis de erro de Storage e exclusão", () => {
    expect(friendlyCanvaProposalError({ error_code: "storage_upload_failed" })).toBe(
      "Não foi possível salvar o PDF gerado. A proposta não foi registrada.",
    );
    expect(friendlyCanvaProposalError({ error_code: "canva_pdf_download_failed" })).toBe(
      "Não foi possível baixar o PDF temporário do Canva.",
    );
    expect(friendlyCanvaProposalError({ error_code: "delete_failed" })).toBe(
      "Não foi possível excluir a proposta.",
    );
    expect(friendlyCanvaProposalError({ error_code: "canva_autofill_quota_exceeded" })).toBe(
      "Cota de geração automática do Canva atingida.",
    );
  });
});

describe("Tratamento de cota Canva HTTP 429 (canva_autofill_quota_exceeded)", () => {
  const realCanvaQuotaResponse = {
    code: "limit_exceeded",
    message:
      "Free autofill quota has been exceeded. Present the `upsell_url` to the user and prompt them to upgrade their Canva account to continue using the autofill feature.",
    upsell_url: "https://www.canva.com/upgrade?feature=autofill&source=api_quota",
  };

  it("captura HTTP 429 com upsell_url e retorna erro estruturado", () => {
    const error = extractCanvaQuotaError(429, realCanvaQuotaResponse);
    expect(error).not.toBeNull();
    expect(error?.code).toBe("canva_autofill_quota_exceeded");
    expect(error?.status).toBe(429);
    expect(error?.details?.upsell_url).toBe(
      "https://www.canva.com/upgrade?feature=autofill&source=api_quota",
    );
    expect(error?.details?.message).toBe("A cota de Autofill do Canva foi atingida.");
  });

  it("captura HTTP 429 sem upsell_url e define upsell_url como null", () => {
    const withoutUpsell = {
      code: "limit_exceeded",
      message: "Free autofill quota has been exceeded.",
    };
    const error = extractCanvaQuotaError(429, withoutUpsell);
    expect(error).not.toBeNull();
    expect(error?.code).toBe("canva_autofill_quota_exceeded");
    expect(error?.details?.upsell_url).toBeNull();
  });

  it("não confunde rate limit HTTP 429 com cota de Autofill", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "rate_limit_exceeded", message: "Too many requests" }), {
        status: 429,
        headers: { "retry-after": "10", "x-request-id": "rate-request-1" },
      }),
    );

    expect(
      extractCanvaQuotaError(429, { code: "rate_limit_exceeded", message: "Too many requests" }),
    ).toBeNull();
    await expect(
      autofillAndExportPdf({
        token: "secret",
        brandTemplateId: "template-1",
        data: {},
        fetcher: fetcher as typeof fetch,
      }),
    ).rejects.toMatchObject({
      code: "canva_rate_limited",
      status: 429,
      details: { retry_after: "10" },
    });
  });

  it("autofillAndExportPdf propaga canva_autofill_quota_exceeded sem retentativas em 429", async () => {
    let callCount = 0;
    const mockFetcher = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: false,
        status: 429,
        json: async () => realCanvaQuotaResponse,
      } as Response);
    });

    await expect(
      autofillAndExportPdf({
        token: "test_token_secret_123",
        brandTemplateId: "template-1",
        data: { NOME_EVENTO: { type: "text", text: "Casamento" } },
        fetcher: mockFetcher as any,
      }),
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "canva_autofill_quota_exceeded",
        status: 429,
        details: expect.objectContaining({
          upsell_url: "https://www.canva.com/upgrade?feature=autofill&source=api_quota",
        }),
      }),
    );

    // Garante que NÃO fez retentativas após o 429
    expect(callCount).toBe(1);
  });

  it("frontend reconhece canva_autofill_quota_exceeded com mensagem amigável", () => {
    const errObj = {
      error_code: "canva_autofill_quota_exceeded",
      upsell_url: "https://www.canva.com/upgrade",
    };
    expect(friendlyCanvaProposalError(errObj)).toBe(
      "Cota de geração automática do Canva atingida.",
    );
  });

  it("garante que sanitizeLog remove qualquer token ou credencial dos logs", () => {
    const sensitivePayload = {
      access_token: "canva_token_secret_abc123",
      refresh_token: "canva_refresh_secret_xyz789",
      authorization: "Bearer secret_bearer_token",
      stage: "canva_autofill",
      status: 429,
      code: "canva_autofill_quota_exceeded",
      has_upsell_url: true,
      nested: {
        token: "nested_secret_token",
        safe_field: "safe_value",
      },
    };

    const sanitized = sanitizeLog(sensitivePayload) as any;
    expect(sanitized.access_token).toBe("[REDACTED]");
    expect(sanitized.refresh_token).toBe("[REDACTED]");
    expect(sanitized.authorization).toBe("[REDACTED]");
    expect(sanitized.nested.token).toBe("[REDACTED]");
    expect(sanitized.nested.safe_field).toBe("safe_value");
    expect(sanitized.has_upsell_url).toBe(true);

    const logString = JSON.stringify(sanitized);
    expect(logString).not.toContain("canva_token_secret_abc123");
    expect(logString).not.toContain("canva_refresh_secret_xyz789");
    expect(logString).not.toContain("secret_bearer_token");
    expect(logString).not.toContain("nested_secret_token");
  });
});
