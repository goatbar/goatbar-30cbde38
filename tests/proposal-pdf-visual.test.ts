import fs from "node:fs";
import path from "node:path";
import * as mupdf from "mupdf";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { ProposalPdfRenderer } from "@/lib/pdf-engine/renderer";
import { resolveCanonicalProposalData } from "@/lib/proposal-field-resolver";
import { GOATBAR_COMMERCIAL_V1_TEMPLATE } from "@/templates/proposals/goatbar-commercial-v1/template";

const sidneyLuciaContext = {
  event: {
    id: "sidney-lucia",
    event_name: "Sidney & Lúcia",
    client_name: "Mariana Campos Moreira",
    groom_name: null,
    bride_name: null,
    guests: 90,
    date: "2026-11-14",
    duration_hours: 6,
    event_type: "casamento",
  },
  budget: {
    id: "budget-sidney-lucia",
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
    const canonical = resolveCanonicalProposalData(sidneyLuciaContext);
    const result = await ProposalPdfRenderer.render(template, canonical);
    const document = await pdfjs.getDocument({ data: result.pdfBytes.slice() }).promise;
    const auditDirectory = path.resolve("scratch/sidney-lucia-visual-audit");
    if (process.env.SAVE_PROPOSAL_VISUAL_AUDIT === "1") {
      fs.mkdirSync(auditDirectory, { recursive: true });
      fs.writeFileSync(path.join(auditDirectory, "proposta-sidney-lucia.pdf"), result.pdfBytes);
    }

    expect(document.numPages).toBe(8);
    expect(canonical.quantidadePessoasFormatted).toBe("90");
    expect(canonical.quantidadeHorasEventoFormatted).toBe("6");
    expect(canonical.valorInvestimentoFormatted).toMatch(/2\.350,30/);
    expect(canonical.dataFinalPagamento).toBe("07.11.2026");
    expect(canonical.nomeEvento).toBe("Sidney & Lúcia");
    expect(canonical.nomeEvento).not.toBe(sidneyLuciaContext.event.client_name);
    expect([canonical.inicialNoivo, canonical.inicialNoiva]).toEqual(["S", "L"]);
    expect(template.pages[5].slots.every((slot) => slot.style.color !== "#FFFFFF")).toBe(true);
    const coverName = template.pages[0].slots.find((slot) => slot.id === "capa-nome-evento-topo")!;
    const coverDate = template.pages[0].slots.find((slot) => slot.id === "capa-data-evento")!;
    expect(coverName.type).toBe("arc");
    expect(coverName.arcConfig).toMatchObject({ radius: 135, startDeg: 160, endDeg: 20 });
    expect(coverDate.arcConfig).toMatchObject({ radius: 135, startDeg: 205, endDeg: 335 });

    const drinks = template.pages[5].slots.find((slot) => slot.id === "drinks-list")!;
    const beverages = template.pages[5].slots.find((slot) => slot.id === "bebidas-list")!;
    expect(drinks).toMatchObject({ x: 81, y: 311, width: 600 });
    expect(drinks.style).toMatchObject({ font: "Helvetica", fontSize: 20, lineHeight: 31 });
    expect(beverages).toMatchObject({ x: 81, y: 600, width: 600 });
    expect(beverages.style).toMatchObject({ fontSize: 20, lineHeight: 27.5 });

    const investment = template.pages[6].slots.find(
      (slot) => slot.id === "resumo-investimento-total",
    )!;
    expect(investment.style.font).toBe("Helvetica");

    const mupdfDoc = mupdf.Document.openDocument(result.pdfBytes, "application/pdf");
    for (let pageNumber = 0; pageNumber < mupdfDoc.countPages(); pageNumber++) {
      const page = mupdfDoc.loadPage(pageNumber);
      const pix = page.toPixmap(mupdf.Matrix.scale(1, 1), mupdf.ColorSpace.DeviceRGB, false);
      if (process.env.SAVE_PROPOSAL_VISUAL_AUDIT === "1") {
        fs.writeFileSync(
          path.join(auditDirectory, `pagina-${pageNumber + 1}.png`),
          pix.asPNG(),
        );
      }
      const pixels = pix.getPixels();
      const w = pix.getWidth();
      const h = pix.getHeight();

      // Audit the bottom rows: no page should end with a white band
      let bottomWhiteCount = 0;
      for (let x = 0; x < w; x++) {
        const idx = ((h - 1) * w + x) * 3;
        if (pixels[idx] > 240 && pixels[idx + 1] > 240 && pixels[idx + 2] > 240) {
          bottomWhiteCount++;
        }
      }
      expect(bottomWhiteCount, `faixa branca na página ${pageNumber + 1}`).toBe(0);

      let nonWhitePixels = 0;
      for (let index = 0; index < pixels.length; index += 3) {
        if (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245) {
          nonWhitePixels++;
        }
      }
      expect(
        nonWhitePixels / (w * h),
        `página ${pageNumber + 1}`,
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
