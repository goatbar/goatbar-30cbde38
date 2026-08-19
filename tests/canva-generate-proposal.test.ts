import { describe, expect, it, vi } from "vitest";
import {
  autofillAndExportPdf,
  buildAutofillData,
  getMissingCanvaMappingKeys,
  normalizeProposalEventType,
  resolveSelectedDrinks,
} from "../supabase/functions/canva-generate-proposal/logic";
import {
  formatCanvaGenerationError,
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
