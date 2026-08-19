import { describe, expect, it, vi } from "vitest";
import { autofillAndExportPdf, buildAutofillData, getMissingCanvaMappingKeys, normalizeProposalEventType } from "../supabase/functions/canva-generate-proposal/logic";
import { formatCanvaGenerationError, getProposalGenerationFlow } from "../src/lib/proposal-generation";

const event = { groom_name: "Gustavo", bride_name: "Mariana", guests: 150, date: "2026-11-14", event_type: "Casamento" };
const budget = { id: "budget-selected", beverages: ["Água", "Refrigerante"], selected_drinks: [], drinks_per_person: 4, final_budget_value: 20953.34 };
const mapping = (canva_field_key: string, source_field_key: string, extra = {}) => ({ canva_field_key, source_field_key, source_type: "field", ...extra });

describe("seleção e mappings da proposta", () => {
  it("apresenta o body canva_fields_missing com a lista de campos", () => {
    expect(formatCanvaGenerationError({ error_code: "canva_fields_missing", missing_fields: ["INO", "INA"] }))
      .toBe("Existem campos mapeados que ainda não são Data Fields do Canva.\n\nCampos ausentes:\n• INO\n• INA");
  });
  it("mantém internal no editor antigo e separa o provider Canva", () => {
    expect(getProposalGenerationFlow({ provider: "internal" } as any)).toBe("internal");
    expect(getProposalGenerationFlow({ provider: "canva" } as any)).toBe("canva");
  });
  it("seleciona casamento pela classificação do evento", () => expect(normalizeProposalEventType("Festa de Casamento")).toBe("casamento"));
  it("carrega mappings e resolve INO, INA e BEBIDAS da versão informada", () => {
    const data = buildAutofillData([
      mapping("INO", "computed.groom_initial"), mapping("INA", "computed.bride_initial"), mapping("BEBIDAS", "budget.beverages"),
    ], ["INO", "INA", "BEBIDAS"], event, budget);
    expect(data.INO.text).toBe("G");
    expect(data.INA.text).toBe("M");
    expect(data.BEBIDAS.text).toBe("Água, Refrigerante");
  });
  it("ignora INICIAIS_NOIVOS legado em novas gerações", () => {
    const data = buildAutofillData([mapping("INICIAIS_NOIVOS", "computed.couple_initials"), mapping("INO", "computed.groom_initial")], ["INICIAIS_NOIVOS", "INO"], event, budget);
    expect(data).not.toHaveProperty("INICIAIS_NOIVOS");
  });
  it("bloqueia required vazio", () => expect(() => buildAutofillData([mapping("INO", "computed.groom_initial", { required: true })], ["INO"], { ...event, groom_name: null }, budget)).toThrow("Nome do noivo não preenchido"));
  it("explica Data Field ausente no dataset real", () => expect(() => buildAutofillData([mapping("INO", "computed.groom_initial")], [], event, budget)).toThrow('não possui o Data Field "INO"'));
  it("detecta mappings ausentes antes do Autofill e ignora o legado", () => {
    expect(getMissingCanvaMappingKeys([
      mapping("INO", "computed.groom_initial"),
      mapping("INA", "computed.bride_initial"),
      mapping("INICIAIS_NOIVOS", "computed.couple_initials"),
    ], ["INO"])).toEqual(["INA"]);
  });
});

function response(body: any, ok = true, status = 200) { return Promise.resolve({ ok, status, json: async () => body } as Response); }

describe("Canva Autofill e Export", () => {
  it("aguarda Autofill e Export com sucesso", async () => {
    const fetcher = vi.fn()
      .mockImplementationOnce(() => response({ job: { id: "auto-1" } }))
      .mockImplementationOnce(() => response({ job: { id: "auto-1", status: "success", result: { design: { id: "design-1" } } } }))
      .mockImplementationOnce(() => response({ job: { id: "export-1" } }))
      .mockImplementationOnce(() => response({ job: { id: "export-1", status: "success", urls: ["https://download/pdf"] } }));
    await expect(autofillAndExportPdf({ token: "secret", brandTemplateId: "brand-1", data: {}, fetcher: fetcher as any, sleep: async () => {} })).resolves.toMatchObject({ designId: "design-1", downloadUrl: "https://download/pdf" });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ brand_template_id: "brand-1", data: {} });
  });
  it("diferencia erro de Autofill", async () => {
    const fetcher = vi.fn().mockImplementationOnce(() => response({}, false, 400));
    await expect(autofillAndExportPdf({ token: "x", brandTemplateId: "x", data: {}, fetcher: fetcher as any })).rejects.toMatchObject({ code: "canva_autofill_failed" });
  });
  it("diferencia erro de Export", async () => {
    const fetcher = vi.fn().mockImplementationOnce(() => response({ job: { id: "a" } })).mockImplementationOnce(() => response({ job: { id: "a", status: "success", result: { design: { id: "d" } } } })).mockImplementationOnce(() => response({}, false, 500));
    await expect(autofillAndExportPdf({ token: "x", brandTemplateId: "x", data: {}, fetcher: fetcher as any, sleep: async () => {} })).rejects.toMatchObject({ code: "canva_export_failed" });
  });
});
