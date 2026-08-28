import { PDFDocument, degrees, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
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
  return text
    .normalize("NFC")
    .replace(/[^\x00-\xFF]/g, (char) => {
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

    let basePdfDoc: PDFDocument | null = null;
    if (template.basePdfBytes) {
      basePdfDoc = await PDFDocument.load(template.basePdfBytes);
    }

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
      const embedded = await doc.embedPage(sourcePage);
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
    const { doc, basePdfDoc, pageDef, template, canonicalData, pageWidth, pageHeight, getFont } = ctx;

    const drinksSlot = pageDef.slots.find((s) => s.fieldKey === "drinks" || s.id.includes("drinks"));
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

    const safeDrinksHeight =
      pageDef.menuSafeArea?.drinksMaxHeight || drinksSlot?.height || 280;

    // Determina se cabe na primeira página
    let page1Drinks: string[] = [];
    let overflowDrinks: string[] = [];

    let accumulatedHeight = 0;
    for (const item of measuredDrinks.items) {
      if (accumulatedHeight + item.height <= safeDrinksHeight) {
        accumulatedHeight += item.height;
        page1Drinks.push(item.raw);
      } else {
        overflowDrinks.push(item.raw);
      }
    }

    // Renderiza Página 1 do cardápio com os itens que cabem
    const page1Data: CanonicalProposalData = {
      ...canonicalData,
      drinks: page1Drinks,
      drinksFormatted: page1Drinks.map((d) => (d.startsWith("•") ? d : `• ${d}`)).join("\n"),
    };

    const page1 = doc.addPage([pageWidth, pageHeight]);
    if (basePdfDoc && basePdfDoc.getPageCount() >= pageDef.pageNumber) {
      const sourcePage = basePdfDoc.getPage(pageDef.pageNumber - 1);
      const embedded = await doc.embedPage(sourcePage);
      page1.drawPage(embedded, { x: 0, y: 0, width: pageWidth, height: pageHeight });
    } else {
      this.drawBackground(page1, pageDef, pageWidth, pageHeight);
    }

    for (const slot of pageDef.slots) {
      this.drawSlot(page1, slot, page1Data, pageHeight, getFont);
    }

    // Se houve overflow, cria página adicional de continuação
    if (overflowDrinks.length > 0) {
      const continuationPage = doc.addPage([pageWidth, pageHeight]);
      
      // Usa o mesmo background da página de cardápio limpa
      if (basePdfDoc && basePdfDoc.getPageCount() >= pageDef.pageNumber) {
        const sourcePage = basePdfDoc.getPage(pageDef.pageNumber - 1);
        const embedded = await doc.embedPage(sourcePage);
        continuationPage.drawPage(embedded, { x: 0, y: 0, width: pageWidth, height: pageHeight });
      } else {
        this.drawBackground(continuationPage, pageDef, pageWidth, pageHeight);
      }

      const continuationTitle =
        template.overflow?.continuationPageTitle || "CARDÁPIO (CONTINUAÇÃO)";

      // Cabeçalho da continuação
      const headerFont = getFont("Helvetica-Bold", true);
      continuationPage.drawText(sanitizePdfText(continuationTitle), {
        x: drinksSlot?.x || 81,
        y: pageHeight - (drinksSlot?.y || 260) + 30,
        size: 20,
        font: headerFont,
        color: hexToRgb(drinksSlot?.style.color || "#D4AF37"),
      });

      // Renderiza itens excedentes
      let currentY = pageHeight - (drinksSlot?.y || 301.3) - fontSize;
      const itemFont = getFont(drinksSlot?.style.font);

      for (const drink of overflowDrinks) {
        const bulletText = drink.startsWith("•") ? drink : `• ${drink}`;
        const lines = wrapTextLines(bulletText, availableWidth, fontSize, itemFont);
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
        resolvedText = rawValue.map((item) => (item.startsWith("•") ? item : `• ${item}`)).join("\n");
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
    if (slot.type === ("arc" as any)) {
      const cfg = (slot as any).arcConfig || {};
      const cx = slot.x;
      const cy = pageHeight - slot.y;
      const radius = cfg.radius || 150;
      const isBottom = cfg.position === "bottom";
      const startDeg = cfg.startDeg ?? (isBottom ? 200 : 20);
      const endDeg = cfg.endDeg ?? (isBottom ? 340 : 160);
      const totalAngle = endDeg - startDeg;
      const chars = sanitizePdfText(resolvedText).split("");
      const angleStep = chars.length > 1 ? totalAngle / (chars.length - 1) : 0;

      chars.forEach((char, i) => {
        const angleDeg = startDeg + i * angleStep;
        const angleRad = (angleDeg * Math.PI) / 180;
        const lx = cx + radius * Math.cos(angleRad);
        const ly = cy + radius * Math.sin(angleRad);
        const rotRad = isBottom ? angleRad - Math.PI / 2 : angleRad + Math.PI / 2;
        page.drawText(char, {
          x: lx,
          y: ly,
          size: fontSize,
          font,
          color,
          rotate: degrees((rotRad * 180) / Math.PI),
        });
      });
      return;
    }

    const lines = resolvedText.split("\n").flatMap((l) => wrapTextLines(l, slot.width, fontSize, font));

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
