import fs from "node:fs";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { ProposalPdfRenderer } from "@/lib/pdf-engine/renderer";
import { resolveCanonicalProposalData } from "@/lib/proposal-field-resolver";
import { GOATBAR_COMMERCIAL_V1_TEMPLATE } from "@/templates/proposals/goatbar-commercial-v1/template";

const gustavoMarianaContext = {
  event: {
    id: "gustavo-mariana",
    event_name: "Casamento Gustavo & Mariana",
    client_name: "Gustavo & Mariana",
    groom_name: "Gustavo",
    bride_name: "Mariana",
    guests: 90,
    date: "2026-11-14",
    duration_hours: 6,
    event_type: "casamento",
  },
  budget: {
    id: "budget-gustavo-mariana",
    created_at: "2026-08-28",
    bartender_quantity: 3,
    keeper_quantity: 1,
    copeira_quantity: 0,
    final_budget_value: 2350.3,
    drinks_per_person: 4,
    beverages: ["Vodka Smirnoff", "Cachaça artesanal", "Gelo filtrado"],
    payment_terms: "30% na assinatura do contrato - Restante até dia 07.11.2026",
  },
  hydratedData: {
    selectedDrinkNames: ["Moscow Mule", "Fitzgerald", "Gin Tropical", "Aperol Spritz"],
  },
};

describe("Proposta Comercial Goat Bar - regressão visual", () => {
  it("mantém todas as páginas visualmente preenchidas e os campos dinâmicos dentro da página", async () => {
    const cleanTemplate = fs.readFileSync(
      path.resolve("src/templates/proposals/goatbar-commercial-v1/clean-template.pdf"),
    );
    const template = {
      ...GOATBAR_COMMERCIAL_V1_TEMPLATE,
      basePdfPath: undefined,
      basePdfBytes: new Uint8Array(cleanTemplate),
    };
    const canonical = resolveCanonicalProposalData(gustavoMarianaContext);
    const result = await ProposalPdfRenderer.render(template, canonical);
    const document = await pdfjs.getDocument({ data: result.pdfBytes.slice() }).promise;
    const auditDirectory = path.resolve("scratch/gustavo-mariana-visual-audit");
    if (process.env.SAVE_PROPOSAL_VISUAL_AUDIT === "1") {
      fs.mkdirSync(auditDirectory, { recursive: true });
      fs.writeFileSync(path.join(auditDirectory, "proposta-gustavo-mariana.pdf"), result.pdfBytes);
    }

    expect(document.numPages).toBe(8);
    expect(canonical.quantidadePessoasFormatted).toBe("90");
    expect(canonical.quantidadeHorasEventoFormatted).toBe("6");
    expect(canonical.valorInvestimentoFormatted).toMatch(/2\.350,30/);
    expect(canonical.dataFinalPagamento).toBe("07.11.2026");
    expect(template.pages[5].slots.every((slot) => slot.style.color !== "#FFFFFF")).toBe(true);

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 0.25 });
      const canvas = createCanvas(viewport.width, viewport.height);
      await page.render({ canvasContext: canvas.getContext("2d") as any, viewport }).promise;
      if (process.env.SAVE_PROPOSAL_VISUAL_AUDIT === "1") {
        fs.writeFileSync(
          path.join(auditDirectory, `pagina-${pageNumber}.png`),
          canvas.toBuffer("image/png"),
        );
      }
      const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      let nonWhitePixels = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245) {
          nonWhitePixels++;
        }
      }
      expect(
        nonWhitePixels / (canvas.width * canvas.height),
        `página ${pageNumber}`,
      ).toBeGreaterThan(0.08);
    }

    for (const pageDefinition of template.pages) {
      for (const slot of pageDefinition.slots) {
        expect(slot.x, slot.id).toBeGreaterThanOrEqual(0);
        expect(slot.y, slot.id).toBeGreaterThanOrEqual(0);
        expect(slot.x + slot.width, slot.id).toBeLessThanOrEqual(template.pageSize.width);
        expect(slot.y + slot.height, slot.id).toBeLessThanOrEqual(template.pageSize.height);
        expect(slot.style.fontSize, slot.id).toBeGreaterThan(0);
      }
    }
  });
});
