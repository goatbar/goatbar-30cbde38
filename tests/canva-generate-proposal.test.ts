import { describe, expect, it, vi } from "vitest";
import {
  autofillAndExportPdf,
  buildAutofillData,
  getMissingCanvaMappingKeys,
  hydrateBudgetDrinks,
  normalizeProposalEventType,
  normalizeSelectedDrinks,
  resolveSelectedDrinks,
} from "../supabase/functions/canva-generate-proposal/logic";
import {
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
    expect(data.BEBIDAS.text).toBe("Água, Refrigerante");
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

  it("preserva ordem e duplicatas, retorna nomes em vez de IDs e mantém BEBIDAS independente", async () => {
    const names = await resolveSelectedDrinks(
      { ids: ["drink-2", "drink-1", "drink-2"] },
      "version-1",
      successfulQuery,
    );
    expect(names).toEqual(["Fitzgerald", "Moscow Mule", "Fitzgerald"]);
    const data = buildAutofillData(
      [mapping("DRINKS", "package.drinks_list"), mapping("BEBIDAS", "budget.beverages")],
      ["DRINKS", "BEBIDAS"],
      event,
      { ...budget, selected_drinks: names },
    );
    expect(data.DRINKS.text).toBe("Fitzgerald, Moscow Mule, Fitzgerald");
    expect(data.DRINKS.text).not.toContain("drink-");
    expect(data.DRINKS.text).not.toContain("[object Object]");
    expect(data.BEBIDAS.text).toBe("Água, Refrigerante");
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
    const normalized = normalizeSelectedDrinks([
      { nome: "Moscow Mule" },
      { name: "Fitzgerald" },
    ]);
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

    const result = await hydrateBudgetDrinks(
      { ids: ["id-1", "id-2"] },
      mockDb as any,
      { event_id: "evt-1", budget_version_id: "bv-1" },
    );

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

    await expect(
      hydrateBudgetDrinks({ ids: ["id-1"] }, mockDb as any),
    ).rejects.toMatchObject({
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
        mapping("QUANTIDADE_DRINKS", "computed.total_drinks"),
      ],
      ["DRINKS", "QUANTIDADE_DRINKS"],
      { ...event, id: realEventId },
      resolvedBudget,
    );

    expect(autofill.DRINKS.text).toBe("Gin Tropical, Aperol Spritz");
    expect(autofill.QUANTIDADE_DRINKS.text).toBe("600");
  });
});

describe("Mensagens amigáveis de erro de proposta no frontend", () => {
  it("diferencia selected_drinks_invalid_format", () => {
    expect(
      friendlyCanvaProposalError({ error_code: "selected_drinks_invalid_format" }),
    ).toBe("Os drinks desta versão estão em um formato antigo ou inválido.");
  });

  it("diferencia selected_drink_not_found", () => {
    expect(
      friendlyCanvaProposalError({ error_code: "selected_drink_not_found" }),
    ).toBe("Um ou mais drinks desta versão não existem mais no cadastro.");
  });

  it("diferencia selected_drinks_query_failed", () => {
    expect(
      friendlyCanvaProposalError({ error_code: "selected_drinks_query_failed" }),
    ).toBe("Não foi possível consultar os drinks desta versão.");
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
