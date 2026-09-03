import fs from "node:fs";
import path from "node:path";
import * as mupdf from "mupdf";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { ProposalPdfRenderer } from "@/lib/pdf-engine/renderer";
import { resolveCanonicalProposalData } from "@/lib/proposal-field-resolver";
import { GOATBAR_COMMERCIAL_V1_TEMPLATE } from "@/templates/proposals/goatbar-commercial-v1/template";
import { GOATBAR_ANIVERSARIO_V1_TEMPLATE } from "@/templates/proposals/goatbar-aniversario-v1/template";
import { GOATBAR_COMEMORACAO_V1_TEMPLATE } from "@/templates/proposals/goatbar-comemoracao-v1/template";

const artifactDir = "C:/Users/mcmar/.gemini/antigravity/brain/45fbbc49-86b4-44fc-8269-3df17b921c7d";

const contexts = {
  casamento: {
    event: { id: "e1", event_name: "Sidney & Lúcia", client_name: "Mariana Campos", date: "2026-10-10", guests: 90, duration_hours: 6, event_type: "casamento" },
    budget: { id: "b1", created_at: "2026-08-26", bartender_quantity: 3, keeper_quantity: 1, copeira_quantity: 1, final_budget_value: 2350.3, beverages: ["Vodka Smirnoff", "Gelo filtrado"], payment_terms: "30% na assinatura - Restante até 03.10.2026" },
    hydratedData: { selectedDrinkNames: ["Moscow Mule", "Fitzgerald", "Gin Tropical"] },
  },
  aniversario: {
    event: { id: "e2", event_name: "Juliana 30 Anos", client_name: "Juliana Silva", date: "2026-11-15", guests: 70, duration_hours: 5, event_type: "aniversario" },
    budget: { id: "b2", created_at: "2026-08-26", bartender_quantity: 2, keeper_quantity: 1, copeira_quantity: 1, final_budget_value: 1950.0, beverages: ["Vodka Smirnoff", "Gelo filtrado"], payment_terms: "30% na assinatura - Restante até 01.11.2026" },
    hydratedData: { selectedDrinkNames: ["Moscow Mule", "Fitzgerald", "Gin Tropical"] },
  },
  comemoracao: {
    event: { id: "e3", event_name: "Comemoração Anual Tech", client_name: "Tech Corp", date: "2026-12-05", guests: 120, duration_hours: 6, event_type: "comemoracao" },
    budget: { id: "b3", created_at: "2026-08-26", bartender_quantity: 4, keeper_quantity: 2, copeira_quantity: 1, final_budget_value: 3500.0, beverages: ["Vodka Smirnoff", "Gelo filtrado"], payment_terms: "30% na assinatura - Restante até 25.11.2026" },
    hydratedData: { selectedDrinkNames: ["Moscow Mule", "Fitzgerald", "Gin Tropical"] },
  },
};

describe("Validação Visual das Capas (Casamento, Aniversário, Comemoração)", () => {
  it("gera versões finais e de debug com marcação do centro visual e raios dos arcos", async () => {
    const testCases = [
      {
        name: "casamento",
        templateDef: GOATBAR_COMMERCIAL_V1_TEMPLATE,
        context: contexts.casamento,
        cleanPdfFile: "src/templates/proposals/goatbar-commercial-v1/clean-template.pdf",
      },
      {
        name: "aniversario",
        templateDef: GOATBAR_ANIVERSARIO_V1_TEMPLATE,
        context: contexts.aniversario,
        cleanPdfFile: "src/templates/proposals/goatbar-aniversario-v1/clean-template.pdf",
      },
      {
        name: "comemoracao",
        templateDef: GOATBAR_COMEMORACAO_V1_TEMPLATE,
        context: contexts.comemoracao,
        cleanPdfFile: "src/templates/proposals/goatbar-comemoracao-v1/clean-template.pdf",
      },
    ];

    for (const testCase of testCases) {
      const cleanTemplateBytes = fs.readFileSync(path.resolve(testCase.cleanPdfFile));
      const template = {
        ...testCase.templateDef,
        basePdfPath: undefined,
        basePdfBytes: new Uint8Array(cleanTemplateBytes),
      };
      const canonical = resolveCanonicalProposalData(testCase.context);
      const result = await ProposalPdfRenderer.render(template, canonical);

      // 1. Salva PNG final da Capa sem marcações de debug
      const mupdfDoc = mupdf.Document.openDocument(result.pdfBytes, "application/pdf");
      const page1 = mupdfDoc.loadPage(0);
      const pixFinal = page1.toPixmap(mupdf.Matrix.scale(1, 1), mupdf.ColorSpace.DeviceRGB, false);
      const finalOutPath = path.join(artifactDir, `capa-${testCase.name}-final.png`);
      fs.writeFileSync(finalOutPath, pixFinal.asPNG());

      // 2. Cria versão de debug adicionando guia visual de centro e raios no PDF
      const pdfDoc = await PDFDocument.load(result.pdfBytes);
      const pdfPage1 = pdfDoc.getPages()[0];
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const { height: pageHeight } = template.pageSize;

      const topSlot = template.pages[0].slots.find((s) => s.id === "capa-nome-evento-topo");
      const botSlot = template.pages[0].slots.find((s) => s.id === "capa-data-evento");

      if (topSlot && topSlot.arcConfig && botSlot && botSlot.arcConfig) {
        const cx = topSlot.x;
        const cyPdf = pageHeight - topSlot.y; // Converte Y top-down para Y PDF
        const radiusTop = topSlot.arcConfig.radius;
        const radiusBot = botSlot.arcConfig.radius;

        // Desenha mira do centro visual em vermelho
        pdfPage1.drawLine({ start: { x: cx - 35, y: cyPdf }, end: { x: cx + 35, y: cyPdf }, color: rgb(1, 0.1, 0.1), thickness: 2.5 });
        pdfPage1.drawLine({ start: { x: cx, y: cyPdf - 35 }, end: { x: cx, y: cyPdf + 35 }, color: rgb(1, 0.1, 0.1), thickness: 2.5 });

        // Desenha círculo do arco superior em verde brilhante
        pdfPage1.drawCircle({ x: cx, y: cyPdf, radius: radiusTop, borderColor: rgb(0, 1, 0.2), borderWidth: 2 });

        // Desenha círculo do arco inferior em amarelo ouro
        pdfPage1.drawCircle({ x: cx, y: cyPdf, radius: radiusBot, borderColor: rgb(1, 0.84, 0), borderWidth: 2 });

        // Adiciona legenda técnica na prancheta
        pdfPage1.drawText(`CENTRO VISUAL: X=${cx.toFixed(1)}, Y=${topSlot.y.toFixed(1)}`, { x: cx + 45, y: cyPdf + 20, size: 14, font: fontBold, color: rgb(1, 1, 1) });
        pdfPage1.drawText(`RAIO SUPERIOR: ${radiusTop}px`, { x: cx + 45, y: cyPdf, size: 14, font: fontBold, color: rgb(0, 1, 0.2) });
        pdfPage1.drawText(`RAIO INFERIOR: ${radiusBot}px`, { x: cx + 45, y: cyPdf - 20, size: 14, font: fontBold, color: rgb(1, 0.84, 0) });
      }

      const debugPdfBytes = await pdfDoc.save();
      const debugDoc = mupdf.Document.openDocument(debugPdfBytes, "application/pdf");
      const debugPage1 = debugDoc.loadPage(0);
      const pixDebug = debugPage1.toPixmap(mupdf.Matrix.scale(1, 1), mupdf.ColorSpace.DeviceRGB, false);
      const debugOutPath = path.join(artifactDir, `capa-${testCase.name}-debug.png`);
      fs.writeFileSync(debugOutPath, pixDebug.asPNG());

      expect(fs.existsSync(finalOutPath)).toBe(true);
      expect(fs.existsSync(debugOutPath)).toBe(true);
    }
  });
});
