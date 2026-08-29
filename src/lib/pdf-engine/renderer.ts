import {
  PDFDocument,
  degrees,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import type { CanonicalProposalData } from "@/lib/proposal-field-resolver";
import type {
  ProposalFieldSlot,
  ProposalPageDefinition,
  ProposalRenderOptions,
  ProposalRenderResult,
  ProposalTemplateDefinition,
} from "./types";

function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    return rgb(r, g, b);
  }
  const num = parseInt(clean, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return rgb(r, g, b);
}

/**
 * Sanitiza o texto para as fontes padrão do PDF (WinAnsi / Latin-1).
 * Preserva acentuação e caracteres brasileiros comuns em ISO-8859-1.
 */
export function sanitizePdfText(text: string): string {
  if (!text) return "";
  return text.normalize("NFC").replace(/[^\x00-\xFF]/g, (char) => {
    const code = char.charCodeAt(0);
    if (char === "•" || code === 8226) return "•";
    if (char === "–" || char === "—") return "-";
    if (char === "“" || char === "”") return '"';
    if (char === "‘" || char === "’") return "'";
    return "";
  });
}

export function wrapTextLines(
  text: string,
  maxWidth: number,
  fontSize: number,
  font: PDFFont,
): string[] {
  const safeText = sanitizePdfText(text);
  const words = safeText.split(" ");
  const lines: string[] = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const testLine = `${currentLine} ${word}`;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export interface MeasuredTextItem {
  raw: string;
  lines: string[];
  height: number;
}

export interface ArcGlyphLayout {
  char: string;
  x: number;
  y: number;
  rotationDeg: number;
  fontSize: number;
}

/** Distribui glifos vetoriais pelo arco de forma perfeitamente simétrica e tangencial. */
export function layoutTextOnArc(
  text: string,
  centerX: number,
  centerY: number,
  radius: number,
  startDeg: number,
  endDeg: number,
  fontSize: number,
  minFontSize: number,
  font: PDFFont,
  position?: "top" | "bottom",
): ArcGlyphLayout[] {
  const chars = [...sanitizePdfText(text).toUpperCase()];
  if (chars.length === 0) return [];

  const isBottom = position === "bottom" || (startDeg + endDeg) / 2 > 180;
  const angleSpan = Math.abs(endDeg - startDeg);
  const arcLength = (angleSpan * Math.PI * radius) / 180;

  const naturalWidth = chars.reduce(
    (total, char) => total + font.widthOfTextAtSize(char === " " ? "n" : char, fontSize),
    0,
  );

  const fittedSize =
    naturalWidth > arcLength * 0.95
      ? Math.max(minFontSize, fontSize * ((arcLength * 0.95) / naturalWidth))
      : fontSize;

  const n = chars.length;
  const angleStep = n > 1 ? (endDeg - startDeg) / (n - 1) : 0;

  return chars.map((char, index) => {
    const angleDeg = n > 1 ? startDeg + index * angleStep : (startDeg + endDeg) / 2;
    const angleRad = (angleDeg * Math.PI) / 180;
    const glyphWidth = font.widthOfTextAtSize(char === " " ? "n" : char, fittedSize);

    let x: number;
    let y: number;
    let rotationDeg: number;

    if (!isBottom) {
      // Arco superior: texto corre da esquerda para a direita (sentido horário)
      rotationDeg = angleDeg - 90;
      x = centerX + radius * Math.cos(angleRad) - (glyphWidth / 2) * Math.sin(angleRad);
      y = centerY + radius * Math.sin(angleRad) + (glyphWidth / 2) * Math.cos(angleRad);
    } else {
      // Arco inferior: texto corre da esquerda para a direita (sentido anti-horário)
      rotationDeg = angleDeg + 90;
      x = centerX + radius * Math.cos(angleRad) + (glyphWidth / 2) * Math.sin(angleRad);
      y = centerY + radius * Math.sin(angleRad) - (glyphWidth / 2) * Math.cos(angleRad);
    }

    return {
      char,
      x,
      y,
      rotationDeg,
      fontSize: fittedSize,
    };
  });
}

export function measureBulletList(
  items: string[],
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
  font: PDFFont,
): { items: MeasuredTextItem[]; totalHeight: number } {
  let totalHeight = 0;
  const measuredItems: MeasuredTextItem[] = [];

  for (const item of items) {
    const bulletText = item.startsWith("•") ? item : `• ${item}`;
    const lines = wrapTextLines(bulletText, maxWidth, fontSize, font);
    const itemHeight = Math.max(1, lines.length) * lineHeight;
    measuredItems.push({ raw: item, lines, height: itemHeight });
    totalHeight += itemHeight;
  }

  return { items: measuredItems, totalHeight };
}

export class ProposalPdfRenderer {
  /**
   * Renderiza a proposta comercial completa em PDF vetorial de alta resolução.
   */
  static async render(
    template: ProposalTemplateDefinition,
    canonicalData: CanonicalProposalData,
    options: ProposalRenderOptions = {},
  ): Promise<ProposalRenderResult> {
    const doc = await PDFDocument.create();

    // Incorpora fontes padrão
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontTimes = await doc.embedFont(StandardFonts.TimesRoman);
    const fontTimesBold = await doc.embedFont(StandardFonts.TimesRomanBold);

    const fontMap: Record<string, PDFFont> = {
      Helvetica: fontRegular,
      "Helvetica-Bold": fontBold,
      "Times-Roman": fontTimes,
      "Times-Bold": fontTimesBold,
      "NeueMontreal-Regular": fontRegular,
      "NeueMontreal-Bold": fontBold,
      "NeueMontreal-Light": fontRegular,
      "AllrounderMonument-Regular": fontBold,
      "AllrounderMonument-Book": fontBold,
    };

    const getFont = (fontName?: string, isBold?: boolean): PDFFont => {
      if (fontName && fontMap[fontName]) return fontMap[fontName];
      return isBold ? fontBold : fontRegular;
    };

    const basePdfDoc = await this.loadBasePdf(template);

    const { width: pageWidth, height: pageHeight } = template.pageSize;

    // Processa páginas
    for (const pageDef of template.pages) {
      if (pageDef.isMenuPage && template.overflow?.enabled) {
        // Renderização com suporte a overflow dinâmico de cardápio
        await this.renderMenuPageWithOverflow({
          doc,
          basePdfDoc,
          pageDef,
          template,
          canonicalData,
          pageWidth,
          pageHeight,
          getFont,
        });
      } else {
        await this.renderStandardPage({
          doc,
          basePdfDoc,
          pageDef,
          template,
          canonicalData,
          pageWidth,
          pageHeight,
          getFont,
        });
      }
    }

    // Se for template de desenvolvimento, adiciona marca d'água discreta de teste
    if (template.isDevelopment || options.watermarkDev) {
      const pages = doc.getPages();
      for (const page of pages) {
        page.drawText("[DEV ONLY - AMBIENTE DE TESTE]", {
          x: 20,
          y: 15,
          size: 8,
          font: fontRegular,
          color: rgb(0.7, 0.3, 0.3),
        });
      }
    }

    const pdfBytes = await doc.save();

    return {
      pdfBytes,
      pageCount: doc.getPageCount(),
      templateId: template.id,
      templateVersion: template.version,
      generatedAt: new Date().toISOString(),
      canonicalSnapshot: canonicalData,
    };
  }

  private static async loadBasePdf(
    template: ProposalTemplateDefinition,
  ): Promise<PDFDocument | null> {
    if (template.basePdfBytes) {
      return PDFDocument.load(template.basePdfBytes);
    }

    if (!template.basePdfPath) return null;

    let response: Response;
    try {
      response = await fetch(template.basePdfPath);
    } catch (error) {
      throw new Error(`Não foi possível carregar a arte base da proposta "${template.name}".`, {
        cause: error,
      });
    }

    if (!response.ok) {
      throw new Error(
        `Não foi possível carregar a arte base da proposta "${template.name}" (HTTP ${response.status}).`,
      );
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const basePdf = await PDFDocument.load(bytes);
    const highestPageNumber = Math.max(...template.pages.map((page) => page.pageNumber));
    if (basePdf.getPageCount() < highestPageNumber) {
      throw new Error(
        `A arte base da proposta "${template.name}" possui ${basePdf.getPageCount()} páginas; eram esperadas pelo menos ${highestPageNumber}.`,
      );
    }
    return basePdf;
  }

  private static async embedCleanPage(doc: PDFDocument, sourcePage: PDFPage) {
    const mb = sourcePage.getMediaBox();
    return doc.embedPage(
      sourcePage,
      { left: 0, bottom: 0, right: mb.width, top: mb.height },
      [1, 0, 0, 1, -mb.x, -mb.y],
    );
  }

  private static async renderStandardPage(ctx: {
    doc: PDFDocument;
    basePdfDoc: PDFDocument | null;
    pageDef: ProposalPageDefinition;
    template: ProposalTemplateDefinition;
    canonicalData: CanonicalProposalData;
    pageWidth: number;
    pageHeight: number;
    getFont: (fontName?: string, isBold?: boolean) => PDFFont;
  }) {
    const { doc, basePdfDoc, pageDef, canonicalData, pageWidth, pageHeight, getFont } = ctx;
    const page = doc.addPage([pageWidth, pageHeight]);

    // Embed base clean PDF page if available
    if (basePdfDoc && basePdfDoc.getPageCount() >= pageDef.pageNumber) {
      const sourcePage = basePdfDoc.getPage(pageDef.pageNumber - 1);
      const embedded = await this.embedCleanPage(doc, sourcePage);
      page.drawPage(embedded, { x: 0, y: 0, width: pageWidth, height: pageHeight });
    } else {
      this.drawBackground(page, pageDef, pageWidth, pageHeight);
    }

    // Slots de campos
    for (const slot of pageDef.slots) {
      this.drawSlot(page, slot, canonicalData, pageHeight, getFont);
    }
  }

  private static async renderMenuPageWithOverflow(ctx: {
    doc: PDFDocument;
    basePdfDoc: PDFDocument | null;
    pageDef: ProposalPageDefinition;
    template: ProposalTemplateDefinition;
    canonicalData: CanonicalProposalData;
    pageWidth: number;
    pageHeight: number;
    getFont: (fontName?: string, isBold?: boolean) => PDFFont;
  }) {
    const { doc, basePdfDoc, pageDef, template, canonicalData, pageWidth, pageHeight, getFont } =
      ctx;

    const drinksSlot = pageDef.slots.find(
      (s) => s.fieldKey === "drinks" || s.id.includes("drinks"),
    );
    const font = getFont(drinksSlot?.style.font);
    const fontSize = drinksSlot?.style.fontSize || 22;
    const lineHeight = drinksSlot?.style.lineHeight || 30.7;
    const availableWidth = drinksSlot?.width || pageWidth - 160;

    // Mede todos os drinks
    const measuredDrinks = measureBulletList(
      canonicalData.drinks,
      availableWidth,
      fontSize,
      lineHeight,
      font,
    );

    const safeDrinksHeight = pageDef.menuSafeArea?.drinksMaxHeight || drinksSlot?.height || 280;

    // Determina se os drinks cabem na primeira página
    let page1Drinks: string[] = [];
    let overflowDrinks: string[] = [];

    let accumulatedDrinksHeight = 0;
    for (const item of measuredDrinks.items) {
      if (accumulatedDrinksHeight + item.height <= safeDrinksHeight) {
        accumulatedDrinksHeight += item.height;
        page1Drinks.push(item.raw);
      } else {
        overflowDrinks.push(item.raw);
      }
    }

    // Mede todas as bebidas
    const bebidasSlot = pageDef.slots.find(
      (s) => s.fieldKey === "bebidas" || s.id.includes("bebidas"),
    );
    const bebidasFont = getFont(bebidasSlot?.style.font);
    const bebidasFontSize = bebidasSlot?.style.fontSize || 20;
    const bebidasLineHeight = bebidasSlot?.style.lineHeight || 27.7;
    const safeBebidasHeight = pageDef.menuSafeArea?.bebidasMaxHeight || bebidasSlot?.height || 180;

    const measuredBebidas = measureBulletList(
      canonicalData.bebidas,
      availableWidth,
      bebidasFontSize,
      bebidasLineHeight,
      bebidasFont,
    );

    let page1Bebidas: string[] = [];
    let overflowBebidas: string[] = [];

    let accumulatedBebidasHeight = 0;
    for (const item of measuredBebidas.items) {
      if (accumulatedBebidasHeight + item.height <= safeBebidasHeight) {
        accumulatedBebidasHeight += item.height;
        page1Bebidas.push(item.raw);
      } else {
        overflowBebidas.push(item.raw);
      }
    }

    // Renderiza Página 1 do cardápio com os itens que cabem
    const page1Data: CanonicalProposalData = {
      ...canonicalData,
      drinks: page1Drinks,
      drinksFormatted: page1Drinks.map((d) => (d.startsWith("•") ? d : `• ${d}`)).join("\n"),
      bebidas: page1Bebidas,
      bebidasFormatted: page1Bebidas.map((b) => (b.startsWith("•") ? b : `• ${b}`)).join("\n"),
    };

    const page1 = doc.addPage([pageWidth, pageHeight]);
    if (basePdfDoc && basePdfDoc.getPageCount() >= pageDef.pageNumber) {
      const sourcePage = basePdfDoc.getPage(pageDef.pageNumber - 1);
      const embedded = await this.embedCleanPage(doc, sourcePage);
      page1.drawPage(embedded, { x: 0, y: 0, width: pageWidth, height: pageHeight });
    } else {
      this.drawBackground(page1, pageDef, pageWidth, pageHeight);
    }

    for (const slot of pageDef.slots) {
      this.drawSlot(page1, slot, page1Data, pageHeight, getFont);
    }

    // Se houve overflow de drinks ou bebidas, cria páginas de continuação em loop até renderizar TODOS os itens
    if (overflowDrinks.length > 0 || overflowBebidas.length > 0) {
      const continuationTitle = template.overflow?.continuationPageTitle || "Drinks & Experiências";
      const headerFont = getFont("Helvetica-Bold", true);
      const itemFont = getFont(drinksSlot?.style.font);
      const continuationStartY = 240.0;
      const continuationMaxHeight = 520.0; // Espaço vertical seguro na página de continuação

      let remainingDrinks = [...overflowDrinks];
      let remainingBebidas = [...overflowBebidas];

      while (remainingDrinks.length > 0 || remainingBebidas.length > 0) {
        const continuationPage = doc.addPage([pageWidth, pageHeight]);

        // Usa o mesmo background da página de cardápio limpa
        if (basePdfDoc && basePdfDoc.getPageCount() >= pageDef.pageNumber) {
          const sourcePage = basePdfDoc.getPage(pageDef.pageNumber - 1);
          const embedded = await this.embedCleanPage(doc, sourcePage);
          continuationPage.drawPage(embedded, { x: 0, y: 0, width: pageWidth, height: pageHeight });
        } else {
          this.drawBackground(continuationPage, pageDef, pageWidth, pageHeight);
        }

        // Título estilizado da continuação
        continuationPage.drawText(sanitizePdfText(continuationTitle), {
          x: drinksSlot?.x || 81,
          y: pageHeight - 112.4,
          size: 41,
          font: headerFont,
          color: hexToRgb("#FFFFFF"),
        });

        let currentY = pageHeight - continuationStartY - fontSize;
        let pageAccumHeight = 0;

        // Se ainda há drinks, desenha subtítulo de Drinks
        if (remainingDrinks.length > 0) {
          continuationPage.drawText(sanitizePdfText("Drinks (continuação)"), {
            x: drinksSlot?.x || 81,
            y: pageHeight - 180.0,
            size: 24,
            font: headerFont,
            color: hexToRgb("#D4AF37"),
          });

          while (remainingDrinks.length > 0) {
            const drink = remainingDrinks[0];
            const bulletText = drink.startsWith("•") ? drink : `• ${drink}`;
            const lines = wrapTextLines(bulletText, availableWidth, fontSize, itemFont);
            const itemH = Math.max(1, lines.length) * lineHeight;

            if (pageAccumHeight + itemH > continuationMaxHeight) {
              break; // Próxima página de continuação
            }

            pageAccumHeight += itemH;
            remainingDrinks.shift();

            for (const line of lines) {
              continuationPage.drawText(sanitizePdfText(line), {
                x: drinksSlot?.x || 81,
                y: currentY,
                size: fontSize,
                font: itemFont,
                color: hexToRgb(drinksSlot?.style.color || "#FFFFFF"),
              });
              currentY -= lineHeight;
            }
          }
        }

        // Se ainda há bebidas e sobrou espaço, ou começa bebidas
        if (remainingBebidas.length > 0 && pageAccumHeight + 80 <= continuationMaxHeight) {
          // Subtítulo de Bebidas
          currentY -= 20;
          continuationPage.drawText(sanitizePdfText("Bebidas (continuação)"), {
            x: bebidasSlot?.x || 81,
            y: currentY,
            size: 24,
            font: headerFont,
            color: hexToRgb("#D4AF37"),
          });
          currentY -= 35;
          pageAccumHeight += 55;

          while (remainingBebidas.length > 0) {
            const bebida = remainingBebidas[0];
            const bulletText = bebida.startsWith("•") ? bebida : `• ${bebida}`;
            const lines = wrapTextLines(bulletText, availableWidth, bebidasFontSize, bebidasFont);
            const itemH = Math.max(1, lines.length) * bebidasLineHeight;

            if (pageAccumHeight + itemH > continuationMaxHeight) {
              break; // Próxima página de continuação
            }

            pageAccumHeight += itemH;
            remainingBebidas.shift();

            for (const line of lines) {
              continuationPage.drawText(sanitizePdfText(line), {
                x: bebidasSlot?.x || 81,
                y: currentY,
                size: bebidasFontSize,
                font: bebidasFont,
                color: hexToRgb(bebidasSlot?.style.color || "#FFFFFF"),
              });
              currentY -= bebidasLineHeight;
            }
          }
        }
      }
    }
  }

  private static drawBackground(
    page: PDFPage,
    pageDef: ProposalPageDefinition,
    width: number,
    height: number,
  ) {
    if (pageDef.background?.type === "color" && pageDef.background.colorHex) {
      page.drawRectangle({
        x: 0,
        y: 0,
        width,
        height,
        color: hexToRgb(pageDef.background.colorHex),
      });
    }
  }

  private static drawSlot(
    page: PDFPage,
    slot: ProposalFieldSlot,
    canonicalData: CanonicalProposalData,
    pageHeight: number,
    getFont: (fontName?: string, isBold?: boolean) => PDFFont,
  ) {
    const rawValue = (canonicalData as any)[slot.fieldKey];
    let resolvedText = "";

    if (slot.transform) {
      resolvedText = slot.transform(rawValue, canonicalData);
    } else if (slot.type === "bullet_list") {
      if (Array.isArray(rawValue)) {
        resolvedText = rawValue
          .map((item) => (item.startsWith("•") ? item : `• ${item}`))
          .join("\n");
      } else {
        resolvedText = String(rawValue || "");
      }
    } else {
      resolvedText = rawValue != null ? String(rawValue) : "";
    }

    if (!resolvedText.trim()) return;

    if (slot.prefix) resolvedText = `${slot.prefix}${resolvedText}`;
    if (slot.suffix) resolvedText = `${resolvedText}${slot.suffix}`;

    const font = getFont(slot.style.font);
    const fontSize = slot.style.fontSize;
    const lineHeight = slot.style.lineHeight;
    const color = hexToRgb(slot.style.color);

    // Suporte especial para texto em arco (ex: capa do casal)
    if (slot.type === "arc") {
      const cfg = slot.arcConfig;
      if (!cfg) return;
      const cx = slot.x;
      const cy = pageHeight - slot.y;
      const glyphs = layoutTextOnArc(
        resolvedText,
        cx,
        cy,
        cfg.radius,
        cfg.startDeg,
        cfg.endDeg,
        fontSize,
        cfg.minFontSize ?? fontSize * 0.72,
        font,
        cfg.position,
      );

      glyphs.forEach(({ char, x, y, rotationDeg, fontSize: fittedFontSize }) => {
        page.drawText(char, {
          x,
          y,
          size: fittedFontSize,
          font,
          color,
          rotate: degrees(rotationDeg),
        });
      });
      return;
    }

    const lines = resolvedText
      .split("\n")
      .flatMap((l) => wrapTextLines(l, slot.width, fontSize, font));

    let currentY = pageHeight - slot.y - fontSize;

    for (const line of lines) {
      if (currentY < pageHeight - slot.y - slot.height) break; // Limite da caixa
      const lineWidth = font.widthOfTextAtSize(sanitizePdfText(line), fontSize);

      let x = slot.x;
      if (slot.style.align === "center") {
        x = slot.x + (slot.width - lineWidth) / 2;
      } else if (slot.style.align === "right") {
        x = slot.x + slot.width - lineWidth;
      }

      page.drawText(sanitizePdfText(line), {
        x,
        y: currentY,
        size: fontSize,
        font,
        color,
      });

      currentY -= lineHeight;
    }
  }
}
