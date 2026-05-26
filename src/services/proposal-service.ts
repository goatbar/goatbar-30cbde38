import { supabase } from "@/integrations/supabase/client";
import { PDFDocument, degrees, rgb, StandardFonts } from "pdf-lib";
import { proposalTemplateConfigs, type EventTemplateType, type FieldConfig } from "@/lib/proposal-template-configs";
import type { ProposalTemplateField } from "@/lib/proposal-template-mapper";

export interface ProposalTemplate {
  id: string;
  name: string;
  event_type: "casamento" | "aniversario" | "comemoracao";
  file_url: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface GeneratedProposal {
  id: string;
  event_id: string;
  budget_id: string | null;
  template_id: string | null;
  proposal_data: ProposalData;
  final_pdf_url: string | null;
  status: "draft" | "reviewed" | "downloaded" | "sent";
  created_at?: string;
  updated_at?: string;
}

export interface ProposalData {
  // Capa
  proposalDate: string;
  eventDate: string;
  eventTime?: string;
  clientName: string;
  eventTypeLabel: string; // ex: "Casamento", "Aniversário de 30 Anos", "Confraternização"
  
  // Drinks & Experiências
  selectedDrinks: string[];
  includedBeverages: string[];
  
  // Valores e Condições
  guests: number;
  bartenders: number;
  keepers: number;
  copeiras: number;
  totalDrinkVarieties: number;
  finalInvestment: number;
  paymentTerms: string;
  includedServices: string[];
  observations?: string;

  // Custom visual configurations
  coverColor?: string; // 'dark' | 'light' - defaults to dark for goat bar
  textColorHex?: string; // Hex color for overlays, default white/gold for dark, dark for light
}

export const proposalTemplatesService = {
  async listTemplates() {
    const { data, error } = await supabase
      .from("proposal_templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as ProposalTemplate[];
  },

  async getTemplateById(id: string) {
    const { data, error } = await supabase
      .from("proposal_templates")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as ProposalTemplate;
  },

  async getDefaultTemplate(eventType: string) {
    const { data, error } = await supabase
      .from("proposal_templates")
      .select("*")
      .eq("event_type", eventType)
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    return data as ProposalTemplate | null;
  },

  async createTemplate(payload: Omit<ProposalTemplate, "id">) {
    const { data, error } = await supabase
      .from("proposal_templates")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as ProposalTemplate;
  },

  async updateTemplate(id: string, payload: Partial<ProposalTemplate>) {
    const { data, error } = await supabase
      .from("proposal_templates")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as ProposalTemplate;
  },

  async deleteTemplate(id: string) {
    const { error } = await supabase.from("proposal_templates").delete().eq("id", id);
    if (error) throw error;
  },

  async setDefaultTemplate(id: string, eventType: string) {
    // Remove is_default from all other templates of this event type
    await supabase
      .from("proposal_templates")
      .update({ is_default: false })
      .eq("event_type", eventType)
      .neq("id", id);
    
    // Set this template as default
    return this.updateTemplate(id, { is_default: true });
  },

  async uploadTemplateFile(file: File) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `templates/${fileName}`;

    const { data, error } = await supabase.storage
      .from("proposal-templates")
      .upload(filePath, file);

    if (error) throw error;

    const {
      data: { publicUrl },
    } = supabase.storage.from("proposal-templates").getPublicUrl(filePath);

    return { publicUrl, filePath };
  },

  async listTemplateFields(templateId: string) {
    const { data, error } = await supabase
      .from("proposal_template_fields")
      .select("*")
      .eq("template_id", templateId)
      .order("page_number", { ascending: true })
      .order("z_index", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as ProposalTemplateField[];
  },

  async replaceTemplateFields(templateId: string, fields: ProposalTemplateField[]) {
    await supabase.from("proposal_template_fields").delete().eq("template_id", templateId);
    if (!fields.length) return [];
    // Strip client-only id (new-*) so Supabase auto-generates UUIDs
    const payload = fields.map(({ id, ...rest }) => {
      const stripped = { ...rest, template_id: templateId };
      if (id && !id.toString().startsWith("new-")) {
        return { ...stripped, id };
      }
      return stripped;
    });
    const { data, error } = await supabase.from("proposal_template_fields").insert(payload).select("*");
    if (error) throw error;
    return (data ?? []) as ProposalTemplateField[];
  },
};

export const generatedProposalsService = {
  async getProposalByEventId(eventId: string) {
    const { data, error } = await supabase
      .from("generated_proposals")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();
    if (error) throw error;
    return data as GeneratedProposal | null;
  },

  async saveProposal(payload: Omit<GeneratedProposal, "id"> & { id?: string }) {
    if (payload.id) {
      const { data, error } = await supabase
        .from("generated_proposals")
        .update({
          budget_id: payload.budget_id,
          template_id: payload.template_id,
          proposal_data: payload.proposal_data as any,
          final_pdf_url: payload.final_pdf_url,
          status: payload.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payload.id)
        .select()
        .single();
      if (error) throw error;
      return data as GeneratedProposal;
    } else {
      const { data, error } = await supabase
        .from("generated_proposals")
        .insert({
          event_id: payload.event_id,
          budget_id: payload.budget_id,
          template_id: payload.template_id,
          proposal_data: payload.proposal_data as any,
          final_pdf_url: payload.final_pdf_url,
          status: payload.status,
        })
        .select()
        .single();
      if (error) throw error;
      return data as GeneratedProposal;
    }
  },

  async uploadGeneratedPDF(eventId: string, pdfBytes: Uint8Array): Promise<string> {
    const fileName = `${eventId}_proposta_${Date.now()}.pdf`;
    const filePath = `propostas/${fileName}`;

    const blob = new Blob([pdfBytes], { type: "application/pdf" });

    const { error } = await supabase.storage
      .from("generated-proposals")
      .upload(filePath, blob, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (error) throw error;

    const {
      data: { publicUrl },
    } = supabase.storage.from("generated-proposals").getPublicUrl(filePath);

    return publicUrl;
  },
};

// Sanitize text for pdf-lib StandardFonts (no Unicode support)
function sanitizeText(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/\u0300/g, "") // grave
    .replace(/\u0301/g, "") // acute
    .replace(/\u0302/g, "") // circumflex
    .replace(/\u0303/g, "") // tilde
    .replace(/\u0308/g, "") // umlaut
    .replace(/\u0327/g, "") // cedilla
    .replace(/[\u0300-\u036f]/g, "") // any remaining combining marks
    .replace(/\u00e3/g, "a").replace(/\u00c3/g, "A") // ã Ã
    .replace(/\u00e7/g, "c").replace(/\u00c7/g, "C") // ç Ç
    .replace(/\u00e9/g, "e").replace(/\u00c9/g, "E") // é É
    .replace(/\u00ea/g, "e").replace(/\u00ca/g, "E") // ê Ê
    .replace(/\u00e8/g, "e").replace(/\u00c8/g, "E") // è È
    .replace(/\u00e0/g, "a").replace(/\u00c0/g, "A") // à À
    .replace(/\u00e2/g, "a").replace(/\u00c2/g, "A") // â Â
    .replace(/\u00f5/g, "o").replace(/\u00d5/g, "O") // õ Õ
    .replace(/\u00f3/g, "o").replace(/\u00d3/g, "O") // ó Ó
    .replace(/\u00f4/g, "o").replace(/\u00d4/g, "O") // ô Ô
    .replace(/\u00fa/g, "u").replace(/\u00da/g, "U") // ú Ú
    .replace(/\u00fc/g, "u").replace(/\u00dc/g, "U") // ü Ü
    .replace(/\u00ed/g, "i").replace(/\u00cd/g, "I") // í Í
    .replace(/\u00f1/g, "n").replace(/\u00d1/g, "N") // ñ Ñ
    .replace(/[^\x00-\xFF]/g, ""); // remove anything still non-latin
}

// Helper function to wrap text
function wrapText(text: string, maxWidth: number, fontSize: number, font: any): string[] {
  const safe = sanitizeText(text);
  const words = safe.split(" ");
  const lines: string[] = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = font.widthOfTextAtSize(`${currentLine} ${word}`, fontSize);
    if (width < maxWidth) {
      currentLine += ` ${word}`;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

// Convert Hex color to RGB
function hexToRgb(hex: string) {
  const cleanHex = hex.replace("#", "");
  const num = parseInt(cleanHex, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return rgb(r, g, b);
}


// ─── Field value resolver ─────────────────────────────────────────
function resolveFieldValue(fieldKey: string, data: ProposalData): string | string[] {
  switch (fieldKey) {
    case "data_orcamento": return data.proposalDate;
    case "tipo_evento":    return data.eventTypeLabel;
    case "nome_evento":    return data.eventTypeLabel;
    case "nome_cliente":   return data.clientName;
    case "nome_casal":     return data.clientName;
    case "data_evento":    return data.eventDate;
    case "lista_drinks":   return data.selectedDrinks;
    case "lista_bebidas":  return data.includedBeverages;
    case "numero_convidados":    return `${data.guests} convidados`;
    case "quantidade_bartenders": return `${data.bartenders} Bartender${data.bartenders !== 1 ? 's' : ''}`;
    case "quantidade_bar_keeper": return `${data.keepers} Bar Keeper${data.keepers !== 1 ? 's' : ''}`;
    case "quantidade_copeira":    return `${data.copeiras} Copeira${data.copeiras !== 1 ? 's' : ''}`;
    case "quantidade_drinks":     return `${data.totalDrinkVarieties} variedades de drinks`;
    case "investimento_total":    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data.finalInvestment);
    case "forma_pagamento":       return data.paymentTerms;
    default: return "";
  }
}

export const pdfGenerationService = {
  async generateProposalPDF(
    templateUrl: string | null,
    data: ProposalData,
    eventType: "casamento" | "aniversario" | "comemoracao",
    mappedFields?: ProposalTemplateField[]
  ): Promise<Uint8Array> {
    if (!templateUrl) {
      const fallback = await this.generatePremiumPDFFromScratch(data, eventType);
      return fallback.save();
    }

    const response = await fetch(templateUrl);
    if (!response.ok) throw new Error("Falha ao baixar modelo de PDF");
    const templateBytes = await response.arrayBuffer();
    const templateDoc = await PDFDocument.load(templateBytes);

    const outputDoc = await PDFDocument.create();
    const pages = templateDoc.getPages();
    const standardFont = await outputDoc.embedFont(StandardFonts.Helvetica);
    const boldFont   = await outputDoc.embedFont(StandardFonts.HelveticaBold);

    // ── Use DB-saved field mapping if available ──────────────────
    if (mappedFields && mappedFields.length > 0) {
      for (const [pageIndex, sourcePage] of pages.entries()) {
        const pSize = sourcePage.getSize();
        const outPage = outputDoc.addPage([pSize.width, pSize.height]);
        const embedded = await outputDoc.embedPage(sourcePage);
        outPage.drawPage(embedded, { x: 0, y: 0, width: pSize.width, height: pSize.height });

        const pFields = mappedFields
          .filter((f) => f.page_number === pageIndex)
          .sort((a, b) => a.z_index - b.z_index);

        for (const mf of pFields) {
          const color = hexToRgb(mf.font_color || "#f7f4ef");
          const font  = mf.font_weight === "bold" ? boldFont : standardFont;
          const rawValue = resolveFieldValue(mf.field_key, data);
          const cfg = (mf.config ?? {}) as {
            radius?: number; centerX?: number; centerY?: number;
            startAngle?: number; endAngle?: number;
            direction?: string; uppercase?: boolean; arcPosition?: string;
          };

          // Relative → absolute coordinates
          // PDF.js uses bottom-left origin; we store top-left relative (0–1)
          const absX = mf.x * pSize.width;
          const absY = pSize.height - mf.y * pSize.height - mf.height * pSize.height;
          const absW = mf.width * pSize.width;
          const absH = mf.height * pSize.height;

          if (mf.field_type === "texto_arco") {
            // ── Arc text rendering ────────────────────────────────
            const raw = Array.isArray(rawValue) ? rawValue.join(" ") : rawValue;
            let text = sanitizeText(raw);
            if (cfg.uppercase) text = text.toUpperCase();

            const radius   = (cfg.radius   ?? 0.15) * Math.min(pSize.width, pSize.height);
            const cx       = (cfg.centerX  ?? 0.5)  * pSize.width;
            const cyTop    = (cfg.centerY  ?? 0.5)  * pSize.height; // top-left origin
            const cy       = pSize.height - cyTop;                   // PDF bottom-left
            const startDeg = cfg.startAngle ?? 200;
            const endDeg   = cfg.endAngle   ?? 340;
            const isBottom = cfg.arcPosition === "bottom";

            const totalAngle = endDeg - startDeg;
            const chars = text.split("");
            const angleStep = chars.length > 1 ? totalAngle / (chars.length - 1) : 0;
            const fs = mf.font_size;

            chars.forEach((char, i) => {
              const angleDeg = startDeg + i * angleStep;
              const angleRad = (angleDeg * Math.PI) / 180;
              const lx = cx + radius * Math.cos(angleRad);
              const ly = cy + radius * Math.sin(angleRad);
              // Rotation: tangent to arc, flipped for bottom arc
              const rotRad = isBottom ? angleRad + Math.PI / 2 : angleRad - Math.PI / 2;
              outPage.drawText(sanitizeText(char), {
                x: lx, y: ly, size: fs, font, color,
                rotate: degrees((rotRad * 180) / Math.PI),
              });
            });

          } else if (mf.field_type === "lista_dinamica") {
            // ── List rendering ────────────────────────────────────
            const lines = Array.isArray(rawValue)
              ? rawValue.map((l) => `• ${l}`)
              : rawValue.split("\n").filter(Boolean).map((l) => `• ${l}`);
            const lineH = mf.font_size * mf.line_height;
            let curY = absY + absH;
            for (const line of lines) {
              if (curY < absY) break;
              outPage.drawText(sanitizeText(line), { x: absX, y: curY, size: mf.font_size, font, color });
              curY -= lineH;
            }

          } else {
            // ── Simple text / date / currency / number ────────────
            const raw = Array.isArray(rawValue) ? rawValue.join(", ") : rawValue;
            const text = sanitizeText(cfg.uppercase ? raw.toUpperCase() : raw);
            const lines = wrapText(text, absW, mf.font_size, font);
            const lineH = mf.font_size * mf.line_height;
            let curY = absY + absH;
            for (const line of lines) {
              if (curY < absY) break;
              const tw = font.widthOfTextAtSize(line, mf.font_size);
              const lx = mf.text_align === "center"
                ? absX + (absW - tw) / 2
                : mf.text_align === "right"
                  ? absX + absW - tw
                  : absX;
              outPage.drawText(line, { x: lx, y: curY, size: mf.font_size, font, color });
              curY -= lineH;
            }
          }
        }
      }
      return outputDoc.save();
    }

    // ── Fallback: hardcoded legacy config ──────────────────────────
    const targetWidth  = 1600;
    const targetHeight = 900;
    const config = proposalTemplateConfigs[eventType as EventTemplateType] || [];

    const drawLines = (page: any, field: FieldConfig, lines: string[]) => {
      if (!lines.length) return;
      const totalHeight = lines.length * field.lineHeight;
      const fit = totalHeight > field.maxHeight ? field.maxHeight / totalHeight : 1;
      const fontSize = Math.max(12, field.fontSize * fit);
      const lh = Math.max(16, field.lineHeight * fit);
      let y = field.y;
      for (const line of lines) {
        const text = sanitizeText(line);
        const font = field.type === "currency" ? boldFont : standardFont;
        const width = font.widthOfTextAtSize(text, fontSize);
        const x = field.align === "center" ? field.x + (field.maxWidth - width) / 2 : field.align === "right" ? field.x + field.maxWidth - width : field.x;
        page.drawText(text, { x, y, size: fontSize, font, color: field.color });
        y -= lh;
        if (y < field.y - field.maxHeight) break;
      }
    };

    for (const [pageIndex, sourcePage] of pages.entries()) {
      const outPage = outputDoc.addPage([targetWidth, targetHeight]);
      const embedded = await outputDoc.embedPage(sourcePage);
      outPage.drawPage(embedded, { x: 0, y: 0, width: targetWidth, height: targetHeight });

      const pageFields = config.filter((f) => f.page === pageIndex);
      for (const field of pageFields) {
        if (field.field === "proposalDateTop" || field.field === "proposalDateBottom") {
          drawLines(outPage, field, [data.proposalDate]);
        } else if (field.field === "coverArcText") {
          const upper = sanitizeText(data.clientName || "").toUpperCase();
          const bottom = sanitizeText((data.eventDate || "").replace(/\//g, "."));
          outPage.drawText(upper, { x: field.x - 60, y: field.y + 30, size: field.fontSize, font: boldFont, color: field.color, rotate: degrees(12) });
          outPage.drawText(bottom, { x: field.x + 36, y: field.y - 34, size: field.fontSize - 4, font: boldFont, color: field.color, rotate: degrees(-8) });
        } else if (field.field === "selectedDrinks") {
          drawLines(outPage, field, data.selectedDrinks.map((d) => `- ${d}`));
        } else if (field.field === "includedBeverages") {
          drawLines(outPage, field, data.includedBeverages.map((b) => `- ${b}`));
        } else if (field.field === "guests") {
          drawLines(outPage, field, [`${data.guests} pessoas`]);
        } else if (field.field === "team") {
          drawLines(outPage, field, [`${data.bartenders} Bartenders`, `${data.keepers} Bar Keeper`, `${data.copeiras} Coopeira`]);
        } else if (field.field === "investment") {
          drawLines(outPage, field, [new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data.finalInvestment)]);
        } else if (field.field === "totalDrinkVarieties") {
          drawLines(outPage, field, [`Carta composta por ${data.totalDrinkVarieties} variedades de drinks`]);
        } else if (field.field === "paymentTerms") {
          drawLines(outPage, field, data.paymentTerms.split("\n").filter(Boolean).map((p) => `- ${p}`));
        }
      }
    }

    return outputDoc.save();
  },

  async generatePremiumPDFFromScratch(
    data: ProposalData,
    eventType: "casamento" | "aniversario" | "comemoracao"
  ): Promise<PDFDocument> {
    const pdfDoc = await PDFDocument.create();
    
    // Page dimensions
    const width = 595.27; // A4 Width
    const height = 841.89; // A4 Height

    const standardFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const bgRgb = hexToRgb("#0F0F11"); // Premium dark theme background
    const goldColor = rgb(0.83, 0.68, 0.21); // #D4AF37
    const whiteColor = rgb(1, 1, 1);
    const grayColor = rgb(0.6, 0.6, 0.6);
    const lineBorderColor = rgb(0.18, 0.18, 0.22);

    // PAGE 1: CAPA
    const page1 = pdfDoc.addPage([width, height]);
    page1.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: bgRgb,
    });

    // Draw gold borders
    page1.drawRectangle({
      x: 20,
      y: 20,
      width: width - 40,
      height: height - 40,
      borderColor: goldColor,
      borderWidth: 1,
    });

    // Brand Label
    page1.drawText(sanitizeText(String("G O A T   B A R")), {
      x: width / 2 - 60,
      y: height - 100,
      size: 16,
      font: boldFont,
      color: goldColor,
    });
    
    page1.drawText(sanitizeText(String("EXPERIÊNCIAS PREMIUM")), {
      x: width / 2 - 80,
      y: height - 125,
      size: 10,
      font: standardFont,
      color: whiteColor,
    });

    // Title
    page1.drawText(sanitizeText(String("PROPOSTA COMERCIAL")), {
      x: 50,
      y: height / 2 + 60,
      size: 14,
      font: standardFont,
      color: goldColor,
    });

    const eventTitle = data.eventTypeLabel.toUpperCase();
    page1.drawText(sanitizeText(String(eventTitle)), {
      x: 50,
      y: height / 2 + 35,
      size: 12,
      font: standardFont,
      color: grayColor,
    });

    page1.drawText(sanitizeText(String(data.clientName)), {
      x: 50,
      y: height / 2 - 25,
      size: 36,
      font: boldFont,
      color: whiteColor,
    });

    // Line separator
    page1.drawLine({
      start: { x: 50, y: height / 2 - 60 },
      end: { x: width - 50, y: height / 2 - 60 },
      color: lineBorderColor,
      thickness: 1,
    });

    // Details at bottom
    page1.drawText(sanitizeText(String(`Data do Evento: ${data.eventDate}`)), {
      x: 50,
      y: height / 2 - 100,
      size: 14,
      font: standardFont,
      color: whiteColor,
    });

    if (data.eventTime) {
      page1.drawText(sanitizeText(String(`Horário do Evento: ${data.eventTime}`)), {
        x: 50,
        y: height / 2 - 120,
        size: 12,
        font: standardFont,
        color: grayColor,
      });
    }

    page1.drawText(sanitizeText(String(`Proposta emitida em: ${data.proposalDate}`)), {
      x: 50,
      y: 60,
      size: 10,
      font: standardFont,
      color: grayColor,
    });

    // PAGE 2: DRINKS & EXPERIÊNCIAS
    const page2 = pdfDoc.addPage([width, height]);
    page2.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: bgRgb,
    });

    // Draw gold borders
    page2.drawRectangle({
      x: 20,
      y: 20,
      width: width - 40,
      height: height - 40,
      borderColor: goldColor,
      borderWidth: 0.5,
    });

    page2.drawText(sanitizeText(String("DRINKS & EXPERIÊNCIAS")), {
      x: 50,
      y: height - 60,
      size: 20,
      font: boldFont,
      color: goldColor,
    });

    // Drinks
    page2.drawText(sanitizeText(String("Drinks Selecionados no Cardápio")), {
      x: 50,
      y: height - 100,
      size: 14,
      font: boldFont,
      color: whiteColor,
    });

    let currentY = height - 130;
    const spacing = data.selectedDrinks.length > 12 ? 18 : 22;
    const fontSize = data.selectedDrinks.length > 12 ? 10 : 12;

    data.selectedDrinks.forEach((drink) => {
      if (currentY > 60) {
        page2.drawText(sanitizeText(String(`• ${drink}`)), {
          x: 50,
          y: currentY,
          size: fontSize,
          font: standardFont,
          color: whiteColor,
        });
        currentY -= spacing;
      }
    });

    // Included Beverages (column on the right)
    const rightColX = width / 2 + 10;
    page2.drawText(sanitizeText(String("Bebidas Negociadas / Incluídas")), {
      x: rightColX,
      y: height - 100,
      size: 14,
      font: boldFont,
      color: goldColor,
    });

    let rightY = height - 130;
    data.includedBeverages.forEach((bev) => {
      if (rightY > 60) {
        const lines = wrapText(bev, (width / 2) - 50, fontSize, standardFont);
        lines.forEach((line) => {
          if (rightY > 60) {
            page2.drawText(sanitizeText(String(`• ${line}`)), {
              x: rightColX,
              y: rightY,
              size: fontSize,
              font: standardFont,
              color: whiteColor,
            });
            rightY -= (fontSize + 6);
          }
        });
        rightY -= 6;
      }
    });

    // PAGE 3: VALORES & CONDIÇÕES
    const page3 = pdfDoc.addPage([width, height]);
    page3.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: bgRgb,
    });

    page3.drawRectangle({
      x: 20,
      y: 20,
      width: width - 40,
      height: height - 40,
      borderColor: goldColor,
      borderWidth: 0.5,
    });

    page3.drawText(sanitizeText(String("VALORES & CONDIÇÕES")), {
      x: 50,
      y: height - 60,
      size: 20,
      font: boldFont,
      color: goldColor,
    });

    // Metric Columns
    page3.drawText(sanitizeText(String(`Número de Convidados: ${data.guests} pessoas`)), {
      x: 50,
      y: height - 110,
      size: 13,
      font: boldFont,
      color: whiteColor,
    });

    page3.drawText(sanitizeText(String(`Variedades de Drinks no Bar: ${data.totalDrinkVarieties} tipos`)), {
      x: 50,
      y: height - 135,
      size: 13,
      font: standardFont,
      color: whiteColor,
    });

    // Staff
    page3.drawText(sanitizeText(String("Equipe Operacional:")), {
      x: 50,
      y: height - 180,
      size: 13,
      font: boldFont,
      color: goldColor,
    });

    page3.drawText(sanitizeText(String(`- Bartenders: ${data.bartenders} profissionais`)), {
      x: 60,
      y: height - 205,
      size: 11,
      font: standardFont,
      color: whiteColor,
    });

    page3.drawText(sanitizeText(String(`- Bar Keepers: ${data.keepers} profissionais`)), {
      x: 60,
      y: height - 225,
      size: 11,
      font: standardFont,
      color: whiteColor,
    });

    page3.drawText(sanitizeText(String(`- Copeiras: ${data.copeiras} profissionais`)), {
      x: 60,
      y: height - 245,
      size: 11,
      font: standardFont,
      color: whiteColor,
    });

    // Services Included
    const sColX = width / 2 + 10;
    page3.drawText(sanitizeText(String("Serviços e Insumos Inclusos")), {
      x: sColX,
      y: height - 110,
      size: 13,
      font: boldFont,
      color: goldColor,
    });

    let sY = height - 135;
    data.includedServices.forEach((service) => {
      if (sY > height - 300) {
        const lines = wrapText(service, (width / 2) - 50, 10, standardFont);
        lines.forEach((line) => {
          page3.drawText(sanitizeText(String(`• ${line}`)), {
            x: sColX,
            y: sY,
            size: 10,
            font: standardFont,
            color: whiteColor,
          });
          sY -= 14;
        });
      }
    });

    // Line divider
    page3.drawLine({
      start: { x: 50, y: height - 280 },
      end: { x: width - 50, y: height - 280 },
      color: lineBorderColor,
      thickness: 1,
    });

    // Investment
    const formattedInvestment = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(data.finalInvestment);

    page3.drawText(sanitizeText(String("INVESTIMENTO COMERCIAL")), {
      x: 50,
      y: height - 320,
      size: 14,
      font: boldFont,
      color: goldColor,
    });

    page3.drawText(sanitizeText(String(formattedInvestment)), {
      x: 50,
      y: height - 350,
      size: 28,
      font: boldFont,
      color: whiteColor,
    });

    // Payment method
    page3.drawText(sanitizeText(String("Formas & Condições de Pagamento")), {
      x: 50,
      y: height - 400,
      size: 12,
      font: boldFont,
      color: goldColor,
    });

    let payY = height - 425;
    const paymentLines = wrapText(data.paymentTerms, width - 100, 11, standardFont);
    paymentLines.forEach((line) => {
      page3.drawText(sanitizeText(String(line)), {
        x: 50,
        y: payY,
        size: 11,
        font: standardFont,
        color: whiteColor,
      });
      payY -= 16;
    });

    // Observations
    if (data.observations) {
      page3.drawText(sanitizeText(String("Observações Gerais")), {
        x: 50,
        y: payY - 20,
        size: 12,
        font: boldFont,
        color: goldColor,
      });

      let obsY = payY - 45;
      const obsLines = wrapText(data.observations, width - 100, 10, standardFont);
      obsLines.forEach((line) => {
        if (obsY > 50) {
          page3.drawText(sanitizeText(String(line)), {
            x: 50,
            y: obsY,
            size: 10,
            font: standardFont,
            color: whiteColor,
          });
          obsY -= 14;
        }
      });
    }

    return pdfDoc;
  },
};
