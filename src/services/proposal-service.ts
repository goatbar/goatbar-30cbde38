import { supabase } from "@/integrations/supabase/client";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

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


export const pdfGenerationService = {
  async generateProposalPDF(
    templateUrl: string | null,
    data: ProposalData,
    eventType: "casamento" | "aniversario" | "comemoracao"
  ): Promise<Uint8Array> {
    let pdfDoc: PDFDocument;

    // Try loading standard template if URL is provided
    if (templateUrl) {
      try {
        const response = await fetch(templateUrl);
        if (!response.ok) throw new Error("Falha ao baixar modelo de PDF");
        const templateBytes = await response.arrayBuffer();
        pdfDoc = await PDFDocument.load(templateBytes);
      } catch (err) {
        console.error("Erro ao carregar template PDF, gerando do zero:", err);
        pdfDoc = await this.generatePremiumPDFFromScratch(data, eventType);
        return pdfDoc.save();
      }
    } else {
      // If no template is uploaded, design a premium one from scratch
      pdfDoc = await this.generatePremiumPDFFromScratch(data, eventType);
      return pdfDoc.save();
    }

    // PDF modification with overlay coordinates
    const pages = pdfDoc.getPages();
    const standardFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Dynamic color choice (Goat Bar standard dark theme colors)
    // Dark theme values: background #121214, gold text #D4AF37, white text #FFFFFF
    const bgRgb = hexToRgb("#121214"); // dark background to cover placeholders
    const goldColor = rgb(0.83, 0.68, 0.21); // #D4AF37
    const whiteColor = rgb(1, 1, 1);
    const darkGrayColor = rgb(0.1, 0.1, 0.1);
    
    // Page 1: CAPA
    if (pages.length > 0) {
      const capa = pages[0];
      const { width, height } = capa.getSize();

      // Cover existing "XXXXX" placeholders
      // Capa placeholder usually in the middle. We cover middle area.
      // Draw rectangular cover (usually dark background or white depending on the template style)
      // We will allow covering areas by drawing shapes. Let's cover with transparent or theme color.
      // Capa design covers:
      // Client name block: y=380 to 460
      // Date block: y=300 to 350
      // Data do orçamento block: y=200 to 250
      
      const coverColor = data.coverColor === "light" ? whiteColor : bgRgb;
      const textMainColor = data.coverColor === "light" ? darkGrayColor : whiteColor;
      
      // Cover name/date/proposal date placeholders
      capa.drawRectangle({
        x: 50,
        y: 350,
        width: width - 100,
        height: 140,
        color: coverColor,
      });

      capa.drawRectangle({
        x: 50,
        y: 200,
        width: width - 100,
        height: 100,
        color: coverColor,
      });

      // Write Client name (Casal / Aniversariante / Empresa)
      const eventTitle = data.eventTypeLabel.toUpperCase();
      capa.drawText(sanitizeText(String(eventTitle)), {
        x: 60,
        y: 450,
        size: 14,
        font: standardFont,
        color: goldColor,
      });

      capa.drawText(sanitizeText(String(data.clientName)), {
        x: 60,
        y: 400,
        size: 32,
        font: boldFont,
        color: textMainColor,
      });

      // Write Event Date
      capa.drawText(sanitizeText(String(`Data do Evento: ${data.eventDate}`)), {
        x: 60,
        y: 360,
        size: 14,
        font: standardFont,
        color: textMainColor,
      });

      // Write Proposal/Budget Date
      capa.drawText(sanitizeText(String(`Proposta gerada em: ${data.proposalDate}`)), {
        x: 60,
        y: 260,
        size: 11,
        font: standardFont,
        color: rgb(0.6, 0.6, 0.6),
      });
    }

    // Page 2: DRINKS & EXPERIÊNCIAS
    if (pages.length > 1) {
      const page2 = pages[1];
      const { width, height } = page2.getSize();

      // Background cover for lists (from y=100 to y=680)
      const coverColor = data.coverColor === "light" ? whiteColor : bgRgb;
      const textMainColor = data.coverColor === "light" ? darkGrayColor : whiteColor;

      page2.drawRectangle({
        x: 50,
        y: 100,
        width: width - 100,
        height: 600,
        color: coverColor,
      });

      // Draw Section Header
      page2.drawText(sanitizeText(String("DRINKS & EXPERIÊNCIAS")), {
        x: 60,
        y: 720,
        size: 20,
        font: boldFont,
        color: goldColor,
      });

      // Column 1: Drinks Selecionados
      page2.drawText(sanitizeText(String("Drinks Selecionados:")), {
        x: 60,
        y: 680,
        size: 14,
        font: boldFont,
        color: goldColor,
      });

      let currentY = 650;
      const fontSize = data.selectedDrinks.length > 10 ? 10 : 12;
      const spacing = data.selectedDrinks.length > 10 ? 18 : 22;

      data.selectedDrinks.forEach((drink) => {
        if (currentY > 120) {
          page2.drawText(sanitizeText(String(`• ${drink}`)), {
            x: 60,
            y: currentY,
            size: fontSize,
            font: standardFont,
            color: textMainColor,
          });
          currentY -= spacing;
        }
      });

      // Column 2: Bebidas Incluídas (drawn on the right side)
      const rightColX = width / 2 + 20;
      page2.drawText(sanitizeText(String("Bebidas Negociadas / Incluídas:")), {
        x: rightColX,
        y: 680,
        size: 14,
        font: boldFont,
        color: goldColor,
      });

      let rightY = 650;
      data.includedBeverages.forEach((bev) => {
        if (rightY > 120) {
          const bevLines = wrapText(bev, (width / 2) - 60, fontSize, standardFont);
          bevLines.forEach((line) => {
            if (rightY > 120) {
              page2.drawText(sanitizeText(String(`• ${line}`)), {
                x: rightColX,
                y: rightY,
                size: fontSize,
                font: standardFont,
                color: textMainColor,
              });
              rightY -= (fontSize + 6);
            }
          });
          rightY -= 6; // item spacing
        }
      });
    }

    // Page 3: VALORES E CONDIÇÕES
    if (pages.length > 2) {
      const page3 = pages[2];
      const { width, height } = page3.getSize();

      const coverColor = data.coverColor === "light" ? whiteColor : bgRgb;
      const textMainColor = data.coverColor === "light" ? darkGrayColor : whiteColor;

      // Cover page 3 content
      page3.drawRectangle({
        x: 50,
        y: 100,
        width: width - 100,
        height: 600,
        color: coverColor,
      });

      page3.drawText(sanitizeText(String("VALORES & CONDIÇÕES")), {
        x: 60,
        y: 720,
        size: 20,
        font: boldFont,
        color: goldColor,
      });

      // Metric Info Grid
      page3.drawText(sanitizeText(String(`Número de Convidados: ${data.guests} pessoas`)), {
        x: 60,
        y: 670,
        size: 13,
        font: boldFont,
        color: textMainColor,
      });

      page3.drawText(sanitizeText(String(`Variedades de Drinks no Bar: ${data.totalDrinkVarieties} tipos`)), {
        x: 60,
        y: 640,
        size: 13,
        font: standardFont,
        color: textMainColor,
      });

      // Staff
      page3.drawText(sanitizeText(String("Equipe Operacional Goat Bar:")), {
        x: 60,
        y: 600,
        size: 13,
        font: boldFont,
        color: goldColor,
      });

      page3.drawText(sanitizeText(String(`- Bartenders: ${data.bartenders} profissionais`)), {
        x: 70,
        y: 575,
        size: 12,
        font: standardFont,
        color: textMainColor,
      });

      page3.drawText(sanitizeText(String(`- Bar Keepers: ${data.keepers} profissionais`)), {
        x: 70,
        y: 555,
        size: 12,
        font: standardFont,
        color: textMainColor,
      });

      page3.drawText(sanitizeText(String(`- Copeiras: ${data.copeiras} profissionais`)), {
        x: 70,
        y: 535,
        size: 12,
        font: standardFont,
        color: textMainColor,
      });

      // Services Included
      page3.drawText(sanitizeText(String("Serviços & Insumos Inclusos:")), {
        x: width / 2 + 20,
        y: 670,
        size: 13,
        font: boldFont,
        color: goldColor,
      });

      let serviceY = 645;
      data.includedServices.forEach((service) => {
        if (serviceY > 400) {
          const lines = wrapText(service, (width / 2) - 60, 10, standardFont);
          lines.forEach((line) => {
            page3.drawText(sanitizeText(String(`• ${line}`)), {
              x: width / 2 + 20,
              y: serviceY,
              size: 10,
              font: standardFont,
              color: textMainColor,
            });
            serviceY -= 14;
          });
        }
      });

      // Investment & Payment Terms
      const formattedInvestment = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(data.finalInvestment);

      page3.drawText(sanitizeText(String("INVESTIMENTO COMERCIAL")), {
        x: 60,
        y: 470,
        size: 14,
        font: boldFont,
        color: goldColor,
      });

      page3.drawText(sanitizeText(String(formattedInvestment)), {
        x: 60,
        y: 440,
        size: 24,
        font: boldFont,
        color: textMainColor,
      });

      page3.drawText(sanitizeText(String("Forma e Condições de Pagamento:")), {
        x: 60,
        y: 390,
        size: 12,
        font: boldFont,
        color: goldColor,
      });

      let payY = 370;
      const paymentLines = wrapText(data.paymentTerms, width - 120, 11, standardFont);
      paymentLines.forEach((line) => {
        page3.drawText(sanitizeText(String(line)), {
          x: 60,
          y: payY,
          size: 11,
          font: standardFont,
          color: textMainColor,
        });
        payY -= 16;
      });

      // Observations
      if (data.observations) {
        page3.drawText(sanitizeText(String("Observações:")), {
          x: 60,
          y: payY - 15,
          size: 12,
          font: boldFont,
          color: goldColor,
        });

        let obsY = payY - 35;
        const obsLines = wrapText(data.observations, width - 120, 10, standardFont);
        obsLines.forEach((line) => {
          if (obsY > 100) {
            page3.drawText(sanitizeText(String(line)), {
              x: 60,
              y: obsY,
              size: 10,
              font: standardFont,
              color: textMainColor,
            });
            obsY -= 14;
          }
        });
      }
    }

    return pdfDoc.save();
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
