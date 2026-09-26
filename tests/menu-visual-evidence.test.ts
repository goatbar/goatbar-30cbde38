import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import * as mupdf from "mupdf";
import { buildEventMenuModel } from "@/lib/event-menu";

const basePdfBytes = fs.readFileSync("src/assets/menu/modelo-cardapio-oficial.pdf");

interface TestFontOptions {
  boldFontBytes?: Uint8Array | ArrayBuffer;
  regularFontBytes?: Uint8Array | ArrayBuffer;
  forceEmergencyFallback?: boolean;
}

async function renderPdf(menu: any, fontOptions?: TestFontOptions) {
  const baseDoc = await PDFDocument.load(basePdfBytes);
  const outDoc = await PDFDocument.create();
  outDoc.registerFontkit(fontkit);

  let fontBold: any = null;
  let fontRegular: any = null;

  if (fontOptions?.boldFontBytes) {
    try {
      fontBold = await outDoc.embedFont(fontOptions.boldFontBytes);
    } catch {
      fontBold = null;
    }
  }

  if (fontOptions?.regularFontBytes) {
    try {
      fontRegular = await outDoc.embedFont(fontOptions.regularFontBytes);
    } catch {
      fontRegular = null;
    }
  }

  // Carrega os arquivos oficiais adicionados ao projeto em public/assets/fonts/
  if (!fontOptions?.forceEmergencyFallback && (!fontBold || !fontRegular)) {
    try {
      const mediumPath = "public/assets/fonts/NeueMontreal-Medium.otf";
      const regularPath = "public/assets/fonts/NeueMontreal-Regular.otf";
      if (!fontBold && fs.existsSync(mediumPath)) {
        fontBold = await outDoc.embedFont(fs.readFileSync(mediumPath));
      }
      if (!fontRegular && fs.existsSync(regularPath)) {
        fontRegular = await outDoc.embedFont(fs.readFileSync(regularPath));
      }
    } catch {
      // Ignora erro e usa fallback de emergência
    }
  }

  // Fallback de emergência caso os arquivos não possam ser carregados
  if (!fontBold) fontBold = await outDoc.embedFont(StandardFonts.HelveticaBold);
  if (!fontRegular) fontRegular = await outDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await outDoc.embedFont(StandardFonts.TimesRomanItalic);

  const wine = rgb(0x70 / 255, 0x11 / 255, 0x17 / 255);
  const dark = rgb(0x0f / 255, 0x14 / 255, 0x14 / 255);

  for (const pageLayout of menu.computedLayout.pages) {
    const [copied] = await outDoc.copyPages(baseDoc, [0]);
    outDoc.addPage(copied);

    let currentY = pageLayout.drinksTop + pageLayout.topPadding;

    for (const drink of pageLayout.drinks) {
      for (const line of drink.nameLines) {
        const tw = fontBold.widthOfTextAtSize(line, 20);
        const x = (567 - tw) / 2;
        const y = 850.5 - (currentY + 20);
        copied.drawText(line, { x, y, size: 20, font: fontBold, color: wine });
        currentY += 24;
      }

      if (drink.descriptionLines.length > 0) {
        currentY += 4;
        for (const line of drink.descriptionLines) {
          const tw = fontRegular.widthOfTextAtSize(line, 16);
          const x = (567 - tw) / 2;
          const y = 850.5 - (currentY + 16);
          copied.drawText(line, { x, y, size: 16, font: fontRegular, color: dark });
          currentY += 20;
        }
      }

      currentY += pageLayout.gap;
    }

    if (pageLayout.isLastPage && pageLayout.personalization) {
      const p = pageLayout.personalization;
      if (p.kind === "wedding") {
        const twInit = fontItalic.widthOfTextAtSize(p.initials, 38);
        copied.drawText(p.initials, {
          x: (567 - twInit) / 2,
          y: 850.5 - 710,
          size: 38,
          font: fontItalic,
          color: wine,
        });
        if (p.label) {
          const twLabel = fontBold.widthOfTextAtSize(p.label.toUpperCase(), 11);
          copied.drawText(p.label.toUpperCase(), {
            x: (567 - twLabel) / 2,
            y: 850.5 - 728,
            size: 11,
            font: fontBold,
            color: wine,
          });
        }
        if (p.date) {
          const twDate = fontRegular.widthOfTextAtSize(p.date, 9.5);
          copied.drawText(p.date, {
            x: (567 - twDate) / 2,
            y: 850.5 - 744,
            size: 9.5,
            font: fontRegular,
            color: wine,
          });
        }
      } else if (p.kind === "birthday") {
        const tw = fontItalic.widthOfTextAtSize("Happy Birthday", 34);
        copied.drawText("Happy Birthday", {
          x: (567 - tw) / 2,
          y: 850.5 - 725,
          size: 34,
          font: fontItalic,
          color: wine,
        });
      } else if (p.kind === "corporate") {
        const text = (p.label || "CHEERS!").toUpperCase();
        const tw = fontBold.widthOfTextAtSize(text, 12);
        copied.drawText(text, {
          x: (567 - tw) / 2,
          y: 850.5 - 730,
          size: 12,
          font: fontBold,
          color: wine,
        });
      }
    }
  }

  return await outDoc.save();
}

describe("menu visual evidence generation", () => {
  it("renders visual evidence PDFs and PNGs for real menu cases", async () => {
    const evidenceDir = "C:/Goatbar-system/scratch/evidence";
    if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });

    const cases = [
      {
        name: "3-drinks-casamento",
        menu: buildEventMenuModel({
          selectedDrinks: [
            { name: "Moscow Mule", description: "Vodka, limão e espuma de gengibre." },
            { name: "Gin Tônica", description: "Gin, tônica e botânicos." },
            { name: "Caipi Morango", description: "Vodka, morango e simple syrup." },
          ],
          catalog: [],
          eventType: "Casamento",
          groomName: "Sidney",
          brideName: "Lúcia",
          date: "2025-05-14",
        }),
      },
      {
        name: "7-drinks-aniversario-julia-sofia",
        menu: buildEventMenuModel({
          selectedDrinks: [
            { name: "Caipi Limão, Cravo e Mel", description: "Vodka, limão, simple syrup." },
            { name: "Caipi Maracujá & Baunilha", description: "Vodka, maracujá, simple syrup e açúcar de baunilha." },
            { name: "Cosmopolitan", description: "Vodka, limão, cranberry e cointreau." },
            { name: "Fitzgerald", description: "Gin, limão, simple syrup e angustura bitter." },
            { name: "Moscow Mule", description: "Vodka, suco limão, simple syrup e espuma de gengibre." },
            { name: "Bramble", description: "Gin, limão, simple syrup e xarope de amora." },
            { name: "Apple Martini", description: "Vodka, suco de limão e licor de maçã verde." },
          ],
          catalog: [],
          eventType: "Aniversário",
          eventName: "Julia & Sofia",
        }),
      },
      {
        name: "9-drinks-isidora-christian",
        menu: buildEventMenuModel({
          selectedDrinks: [
            { name: "Caipi Morango", description: "Vodka, morango e simple syrup." },
            { name: "Caipi Limão, Cravo e Mel", description: "Vodka, limão, xarope de açúcar, cravo e mel." },
            { name: "Caipi Maracujá & Baunilha", description: "Vodka, maracujá, simple syrup e açúcar de baunilha." },
            { name: "Caipi Abacaxi com Raspas de Limão Siciliano", description: "Vodka, abacaxi, simple syrup e raspas de limão siciliano." },
            { name: "Bossa Nova", description: "Vodka, uva verde, simple syrup e água de côco." },
            { name: "Mojito", description: "Rum, limão, simple syrup, hortelã e água com gás." },
            { name: "Moscow Mule", description: "Vodka, suco limão, simple syrup e espuma de gengibre." },
            { name: "Expresso Martini", description: "Vodka, café e licor de café." },
            { name: "Apple Martini", description: "Vodka, suco de limão e licor de maçã verde." },
          ],
          catalog: [],
          eventType: "Casamento",
          eventName: "Isidora & Christian",
          date: "2026-09-05",
        }),
      },
      {
        name: "10-drinks-casamento-paginado",
        menu: buildEventMenuModel({
          selectedDrinks: [
            { name: "Moscow Mule", description: "Vodka, limão e espuma de gengibre." },
            { name: "Gin Tônica", description: "Gin, tônica e botânicos." },
            { name: "Caipi Morango", description: "Vodka, morango e simple syrup." },
            { name: "Fitzgerald", description: "Gin, limão, simple syrup e angustura bitter." },
            { name: "Cosmopolitan", description: "Vodka, limão, cranberry e cointreau." },
            { name: "Bramble", description: "Gin, limão, simple syrup e xarope de amora." },
            { name: "Apple Martini", description: "Vodka, suco de limão e licor de maçã verde." },
            { name: "Bossa Nova", description: "Vodka, uva verde, simple syrup e água de côco." },
            { name: "Mojito", description: "Rum, limão, simple syrup, hortelã e água com gás." },
            { name: "Expresso Martini", description: "Vodka, café e licor de café." },
          ],
          catalog: [],
          eventType: "Casamento",
          groomName: "Sidney",
          brideName: "Lúcia",
          date: "2025-05-14",
        }),
      },
    ];

    for (const c of cases) {
      const pdfBytes = await renderPdf(c.menu);
      const pdfPath = path.join(evidenceDir, `${c.name}.pdf`);
      fs.writeFileSync(pdfPath, pdfBytes);
      expect(fs.existsSync(pdfPath)).toBe(true);

      const doc = mupdf.Document.openDocument(pdfBytes, "application/pdf");
      const pageCount = doc.countPages();
      for (let i = 0; i < pageCount; i++) {
        const page = doc.loadPage(i);
        const pixmap = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB, false, true);
        const pngPath = path.join(evidenceDir, `${c.name}-p${i + 1}.png`);
        fs.writeFileSync(pngPath, pixmap.asPNG());
        expect(fs.existsSync(pngPath)).toBe(true);
      }
    }
  });

  it("audits the embedded fonts in the generated PDF to confirm exactly which fonts are rendered", async () => {
    const menu = buildEventMenuModel({
      selectedDrinks: [
        { name: "Moscow Mule", description: "Vodka, limão e espuma de gengibre." },
        { name: "Gin Tônica", description: "Gin, tônica e botânicos." },
      ],
      catalog: [],
      eventType: "Casamento",
      groomName: "Sidney",
      brideName: "Lúcia",
      date: "2025-05-14",
    });

    const pdfBytes = await renderPdf(menu);
    const doc = mupdf.Document.openDocument(pdfBytes, "application/pdf");
    const page = doc.loadPage(0);
    const json = JSON.parse(page.toStructuredText().asJSON());

    const embeddedFonts = new Set<string>();
    for (const block of json.blocks) {
      if (block.lines) {
        for (const line of block.lines) {
          if (line.font?.name) embeddedFonts.add(line.font.name);
        }
      }
    }

    // 1. O template base oficial traz a fonte embutida no PDF Canva para o cabeçalho "Menu" e rodapé
    expect(embeddedFonts.has("AAAAAA+NeueMontreal-Regular")).toBe(true);

    // 2. Os drinks sobrepostos utilizam as fontes oficiais reais NeueMontreal-Medium e NeueMontreal-Regular
    const hasNeueMedium = Array.from(embeddedFonts).some((name) => name.includes("NeueMontreal-Medium"));
    const hasNeueRegular = Array.from(embeddedFonts).some((name) => name.includes("NeueMontreal-Regular") && !name.startsWith("AAAAAA"));
    expect(hasNeueMedium).toBe(true);
    expect(hasNeueRegular).toBe(true);

    // 3. Helvetica-Bold e Helvetica NÃO estão sendo usadas nos nomes e descrições
    expect(embeddedFonts.has("Helvetica-Bold")).toBe(false);
    expect(embeddedFonts.has("Helvetica")).toBe(false);
  });

  it("garante que Helvetica permanece como fallback de emergência funcional caso o carregamento falhe", async () => {
    const menu = buildEventMenuModel({
      selectedDrinks: [
        { name: "Moscow Mule", description: "Vodka, limão e espuma de gengibre." },
        { name: "Gin Tônica", description: "Gin, tônica e botânicos." },
      ],
      catalog: [],
      eventType: "Casamento",
      groomName: "Sidney",
      brideName: "Lúcia",
      date: "2025-05-14",
    });

    const pdfBytes = await renderPdf(menu, { forceEmergencyFallback: true });
    const doc = mupdf.Document.openDocument(pdfBytes, "application/pdf");
    const page = doc.loadPage(0);
    const json = JSON.parse(page.toStructuredText().asJSON());

    const embeddedFonts = new Set<string>();
    for (const block of json.blocks) {
      if (block.lines) {
        for (const line of block.lines) {
          if (line.font?.name) embeddedFonts.add(line.font.name);
        }
      }
    }

    // Em fallback forçado de emergência, utiliza Helvetica sem quebrar a execução
    expect(embeddedFonts.has("Helvetica-Bold")).toBe(true);
    expect(embeddedFonts.has("Helvetica")).toBe(true);
  });
});

