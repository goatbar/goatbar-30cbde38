import fs from "node:fs";
import path from "node:path";
import * as mupdf from "mupdf";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { ProposalPdfRenderer } from "@/lib/pdf-engine/renderer";
import { resolveCanonicalProposalData } from "@/lib/proposal-field-resolver";
import { GOATBAR_COMMERCIAL_V1_TEMPLATE } from "@/templates/proposals/goatbar-commercial-v1/template";
import { GOATBAR_ANIVERSARIO_V1_TEMPLATE } from "@/templates/proposals/goatbar-aniversario-v1/template";
import { GOATBAR_COMEMORACAO_V1_TEMPLATE } from "@/templates/proposals/goatbar-comemoracao-v1/template";

const artifactDir = "C:/Users/mcmar/.gemini/antigravity/brain/45fbbc49-86b4-44fc-8269-3df17b921c7d";

const sampleContexts = {
  casamento: {
    event: {
      id: "sidney-lucia",
      event_name: "Sidney & Lúcia",
      client_name: "Mariana Campos Moreira",
      groom_name: null,
      bride_name: null,
      guests: 90,
      date: "2026-10-10",
      duration_hours: 6,
      event_type: "casamento",
    },
    budget: {
      id: "budget-sidney-lucia",
      created_at: "2026-08-26",
      bartender_quantity: 3,
      keeper_quantity: 1,
      copeira_quantity: 1,
      final_budget_value: 2350.3,
      drinks_per_person: 4,
      beverages: ["Vodka Smirnoff", "Cachaça artesanal", "Gelo filtrado"],
      payment_terms: "30% na assinatura do contrato - Restante até dia 03.10.2026",
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
  },
  aniversario: {
    event: {
      id: "juliana-30",
      event_name: "Juliana 30 Anos",
      client_name: "Juliana Silva",
      guests: 70,
      date: "2026-11-15",
      duration_hours: 5,
      event_type: "aniversario",
    },
    budget: {
      id: "budget-juliana-30",
      created_at: "2026-08-26",
      bartender_quantity: 2,
      keeper_quantity: 1,
      copeira_quantity: 1,
      final_budget_value: 1950.0,
      drinks_per_person: 4,
      beverages: ["Vodka Smirnoff", "Cachaça artesanal", "Gelo filtrado"],
      payment_terms: "30% na assinatura do contrato - Restante até dia 01.11.2026",
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
  },
  comemoracao: {
    event: {
      id: "festa-firm",
      event_name: "Comemoração Anual Tech",
      client_name: "Tech Corp",
      guests: 120,
      date: "2026-12-05",
      duration_hours: 6,
      event_type: "comemoracao",
    },
    budget: {
      id: "budget-festa-firm",
      created_at: "2026-08-26",
      bartender_quantity: 4,
      keeper_quantity: 2,
      copeira_quantity: 1,
      final_budget_value: 3500.0,
      drinks_per_person: 5,
      beverages: ["Vodka Smirnoff", "Cachaça artesanal", "Gelo filtrado"],
      payment_terms: "30% na assinatura do contrato - Restante até dia 25.11.2026",
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
  },
};

describe("Propostas Goat Bar - Regressão e Validação Visual (Casamento, Aniversário, Comemoração)", () => {
  it("mantém a golden implementation de P6 e P7 idêntica no Casamento e replica para Aniversário e Comemoração", async () => {
    const testCases = [
      {
        name: "casamento",
        templateDef: GOATBAR_COMMERCIAL_V1_TEMPLATE,
        context: sampleContexts.casamento,
        cleanPdfFile: "src/templates/proposals/goatbar-commercial-v1/clean-template.pdf",
      },
      {
        name: "aniversario",
        templateDef: GOATBAR_ANIVERSARIO_V1_TEMPLATE,
        context: sampleContexts.aniversario,
        cleanPdfFile: "src/templates/proposals/goatbar-aniversario-v1/clean-template.pdf",
      },
      {
        name: "comemoracao",
        templateDef: GOATBAR_COMEMORACAO_V1_TEMPLATE,
        context: sampleContexts.comemoracao,
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
      const document = await pdfjs.getDocument({ data: result.pdfBytes.slice() }).promise;

      expect(document.numPages).toBe(8);

      // Validações da Página 6
      const p6Def = template.pages[5];
      expect(p6Def.isMenuPage).toBe(true);

      const drinksSlot = p6Def.slots.find((slot) => slot.id === "drinks-list")!;
      const beveragesSlot = p6Def.slots.find((slot) => slot.id === "bebidas-list")!;
      expect(drinksSlot).toMatchObject({ x: 81, y: 311, width: 600, height: 280 });
      expect(drinksSlot.style).toMatchObject({ font: "Helvetica", fontSize: 20, lineHeight: 31 });
      expect(beveragesSlot.style).toMatchObject({ fontSize: 20, lineHeight: 27.5 });

      // Extrai PNGs das Páginas 6 e 7 para o diretório de artefatos
      const mupdfDoc = mupdf.Document.openDocument(result.pdfBytes, "application/pdf");
      for (const pageNum of [6, 7]) {
        const page = mupdfDoc.loadPage(pageNum - 1);
        const pix = page.toPixmap(mupdf.Matrix.scale(1, 1), mupdf.ColorSpace.DeviceRGB, false);
        const outPath = path.join(artifactDir, `p${pageNum}-${testCase.name}.png`);
        fs.writeFileSync(outPath, pix.asPNG());

        // Verificação de ausência de faixa branca
        const pixels = pix.getPixels();
        const w = pix.getWidth();
        const h = pix.getHeight();
        let bottomWhiteCount = 0;
        for (let x = 0; x < w; x++) {
          const idx = ((h - 1) * w + x) * 3;
          if (pixels[idx] > 240 && pixels[idx + 1] > 240 && pixels[idx + 2] > 240) {
            bottomWhiteCount++;
          }
        }
        expect(bottomWhiteCount, `faixa branca na página ${pageNum} (${testCase.name})`).toBe(0);
      }
    }
  });
});
