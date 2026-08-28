import { describe, it, expect, vi } from "vitest";
import {
  ProposalPdfRenderer,
  layoutTextOnArc,
  measureBulletList,
  sanitizePdfText,
  wrapTextLines,
} from "./renderer";
import { ProposalTemplateRegistry, DEV_DEBUG_TEMPLATE } from "./registry";
import {
  resolveCanonicalProposalData,
  type CanonicalProposalData,
} from "@/lib/proposal-field-resolver";
import { PDFDocument } from "pdf-lib";

const mockContext = {
  event: {
    id: "event-123",
    event_name: "Casamento Ana e Bruno",
    client_name: "Ana & Bruno",
    groom_name: "Bruno",
    bride_name: "Ana",
    guests: 120,
    date: "2026-11-20",
    duration_hours: 6,
    event_type: "casamento",
  },
  budget: {
    id: "budget-v1",
    created_at: "2026-08-20",
    bartender_quantity: 2,
    copeira_quantity: 1,
    keeper_quantity: 1,
    final_budget_value: 15400,
    drinks_per_person: 4,
    beverages: ["Água mineral", "Refrigerantes variados", "Gelo filtrado"],
    payment_terms: "Entrada de 30% e saldo até 7 dias antes do evento",
  },
  hydratedData: {
    selectedDrinkNames: [
      "Moscow Mule",
      "Fitzgerald",
      "Gin Tropical",
      "Aperol Spritz",
      "Negroni",
      "Caipivodka Morango",
    ],
  },
};

describe("ProposalPdfRenderer & Engine", () => {
  it("compõe nome e data como glifos vetoriais em arcos contidos na capa", async () => {
    const document = await PDFDocument.create();
    const font = await document.embedFont("Times-Roman");
    const top = layoutTextOnArc("Gustavo & Mariana", 282.5, 356, 122, 160, 20, 19, 14, font);
    const bottom = layoutTextOnArc("14.11.2026", 282.5, 356, 122, 200, 340, 19, 16, font);

    expect(top.map((glyph) => glyph.char).join("")).toBe("GUSTAVO & MARIANA");
    expect(new Set(top.map((glyph) => glyph.rotationDeg)).size).toBe(top.length);
    expect(bottom[0].rotationDeg).toBe(290);
    expect(bottom.at(-1)?.rotationDeg).toBe(430);
    expect(top.every((glyph) => glyph.y > 0 && glyph.y + glyph.fontSize < 810)).toBe(true);
    expect(bottom.every((glyph) => glyph.x > 0 && glyph.x < 1440)).toBe(true);
    expect(Math.max(...top.map((glyph) => glyph.y))).toBeGreaterThan(450);
    expect(Math.min(...bottom.map((glyph) => glyph.y))).toBeLessThan(280);
  });
  it("renderiza PDF válido com magic bytes %PDF", async () => {
    const canonicalData = resolveCanonicalProposalData(mockContext);
    const result = await ProposalPdfRenderer.render(DEV_DEBUG_TEMPLATE, canonicalData);

    expect(result.pdfBytes).toBeDefined();
    expect(result.pdfBytes.length).toBeGreaterThan(1000);

    const magic = new TextDecoder().decode(result.pdfBytes.subarray(0, 4));
    expect(magic).toBe("%PDF");

    // Valida carregamento pelo pdf-lib
    const parsedDoc = await PDFDocument.load(result.pdfBytes);
    expect(parsedDoc.getPageCount()).toBe(3); // Capa, Cardápio, Investimento
  });

  it("produz resultado imutável com metadados do template e snapshot canônico", async () => {
    const canonicalData = resolveCanonicalProposalData(mockContext);
    const result = await ProposalPdfRenderer.render(DEV_DEBUG_TEMPLATE, canonicalData);

    expect(result.templateId).toBe("dev-debug-pilot");
    expect(result.templateVersion).toBe("1.0.0-dev");
    expect(result.generatedAt).toBeDefined();
    expect(result.canonicalSnapshot.nomeEvento).toBe("Casamento Ana e Bruno");
    expect(result.canonicalSnapshot.valorInvestimentoFormatted).toMatch(/R\$\s*15\.400,00/);
    expect(result.canonicalSnapshot.dataFinalPagamento).toBe("13.11.2026");
  });

  it("sanitiza caracteres acentuados e bullets sem quebrar fontes padrão", () => {
    expect(sanitizePdfText("Água com gás • Limão & Açúcar")).toBe("Água com gás • Limão & Açúcar");
    expect(sanitizePdfText("Aspas “especiais” e travessão — teste")).toBe(
      'Aspas "especiais" e travessão - teste',
    );
  });

  it("calcula overflow dinâmico de cardápio e cria automaticamente página de continuação", async () => {
    // 25 drinks forçam overflow na área segura do cardápio
    const manyDrinks = Array.from(
      { length: 25 },
      (_, i) => `Drink Especial Goat Bar Nº ${i + 1} com Infusão Artesanal e Frutas Vermelhas`,
    );

    const contextWithOverflow = {
      ...mockContext,
      hydratedData: {
        selectedDrinkNames: manyDrinks,
      },
    };

    const canonicalData = resolveCanonicalProposalData(contextWithOverflow);
    expect(canonicalData.drinks.length).toBe(25);

    const result = await ProposalPdfRenderer.render(DEV_DEBUG_TEMPLATE, canonicalData);

    const parsedDoc = await PDFDocument.load(result.pdfBytes);
    // Em vez de 3 páginas, deve criar 4 páginas (com a página extra de continuação do cardápio)
    expect(parsedDoc.getPageCount()).toBe(4);
    expect(result.pageCount).toBe(4);
  });

  it("não cria página de continuação quando os drinks cabem perfeitamente na página segura", async () => {
    const fewDrinks = ["Moscow Mule", "Fitzgerald", "Gin Tônica"];
    const contextFew = {
      ...mockContext,
      hydratedData: {
        selectedDrinkNames: fewDrinks,
      },
    };

    const canonicalData = resolveCanonicalProposalData(contextFew);
    const result = await ProposalPdfRenderer.render(DEV_DEBUG_TEMPLATE, canonicalData);

    const parsedDoc = await PDFDocument.load(result.pdfBytes);
    expect(parsedDoc.getPageCount()).toBe(3);
  });

  it("carrega a arte base por URL e desenha os campos dinâmicos acima dela", async () => {
    const baseDoc = await PDFDocument.create();
    const basePage = baseDoc.addPage([595.28, 841.89]);
    basePage.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89 });
    const baseBytes = await baseDoc.save();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(baseBytes.buffer as ArrayBuffer, {
        status: 200,
        headers: { "content-type": "application/pdf" },
      }),
    );
    const canonicalData = resolveCanonicalProposalData(mockContext);
    const template = {
      ...DEV_DEBUG_TEMPLATE,
      basePdfPath: "/assets/proposta-goatbar.pdf",
      basePdfBytes: undefined,
      overflow: { ...DEV_DEBUG_TEMPLATE.overflow!, enabled: false },
      pages: [DEV_DEBUG_TEMPLATE.pages[0]],
    };

    const result = await ProposalPdfRenderer.render(template, canonicalData);
    const parsedDoc = await PDFDocument.load(result.pdfBytes);

    expect(fetchSpy).toHaveBeenCalledWith("/assets/proposta-goatbar.pdf");
    expect(parsedDoc.getPageCount()).toBe(1);
    expect(result.pdfBytes.length).toBeGreaterThan(baseBytes.length);
    fetchSpy.mockRestore();
  });

  it("interrompe a geração em vez de produzir páginas brancas quando a arte base falha", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 404 }));
    const canonicalData = resolveCanonicalProposalData(mockContext);
    const template = {
      ...DEV_DEBUG_TEMPLATE,
      basePdfPath: "/assets/ausente.pdf",
      basePdfBytes: undefined,
    };

    await expect(ProposalPdfRenderer.render(template, canonicalData)).rejects.toThrow("HTTP 404");
    fetchSpy.mockRestore();
  });

  it("gerencia busca e registro no ProposalTemplateRegistry", () => {
    const found = ProposalTemplateRegistry.getTemplate("dev-debug-pilot");
    expect(found).toBeDefined();
    expect(found?.id).toBe("dev-debug-pilot");

    // listTemplates filtra templates de dev por padrão
    const prodTemplates = ProposalTemplateRegistry.listTemplates(false);
    expect(prodTemplates.some((t) => t.id === "dev-debug-pilot")).toBe(false);

    const allTemplates = ProposalTemplateRegistry.listTemplates(true);
    expect(allTemplates.some((t) => t.id === "dev-debug-pilot")).toBe(true);
  });
});
