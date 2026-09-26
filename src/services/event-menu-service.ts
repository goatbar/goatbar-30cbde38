import { supabase } from "@/integrations/supabase/client";
import officialPdfUrl from "@/assets/menu/modelo-cardapio-oficial.pdf?url";
import neueMontrealMediumUrl from "@/assets/fonts/NeueMontreal-Medium.otf?url";
import neueMontrealRegularUrl from "@/assets/fonts/NeueMontreal-Regular.otf?url";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { EventMenuModel } from "@/lib/event-menu";

export interface EventMenuFontOptions {
  customFontBoldBytes?: Uint8Array | ArrayBuffer;
  customFontRegularBytes?: Uint8Array | ArrayBuffer;
}

function safeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/**
 * Renderizador de alta fidelidade client-side com pdf-lib.
 * Utiliza o template oficial vetorial como base física exata.
 * Suporta injeção de fontes licenciadas (Neue Montreal) e fallback universal Helvetica.
 */
export async function renderMenuWithPdfLib(
  menu: EventMenuModel,
  options?: EventMenuFontOptions,
): Promise<Blob> {
  const response = await fetch(officialPdfUrl);
  if (!response.ok) throw new Error("Não foi possível carregar o template canônico do cardápio.");
  const baseBytes = await response.arrayBuffer();
  const baseDoc = await PDFDocument.load(baseBytes);
  const outDoc = await PDFDocument.create();
  outDoc.registerFontkit(fontkit);

  let fontBold: any = null;
  let fontRegular: any = null;

  if (options?.customFontBoldBytes) {
    try {
      fontBold = await outDoc.embedFont(options.customFontBoldBytes);
    } catch {
      fontBold = null;
    }
  }

  if (options?.customFontRegularBytes) {
    try {
      fontRegular = await outDoc.embedFont(options.customFontRegularBytes);
    } catch {
      fontRegular = null;
    }
  }

  // Carrega os binários oficiais da Neue Montreal bundled pelo Vite ou de /assets/fonts/
  if (!fontBold || !fontRegular) {
    try {
      const [resBold, resReg] = await Promise.all([
        !fontBold ? (fetch(neueMontrealMediumUrl).catch(() => null) ?? fetch("/assets/fonts/NeueMontreal-Medium.otf").catch(() => null)) : null,
        !fontRegular ? (fetch(neueMontrealRegularUrl).catch(() => null) ?? fetch("/assets/fonts/NeueMontreal-Regular.otf").catch(() => null)) : null,
      ]);
      if (resBold && resBold.ok && !fontBold) {
        fontBold = await outDoc.embedFont(await resBold.arrayBuffer());
      }
      if (resReg && resReg.ok && !fontRegular) {
        fontRegular = await outDoc.embedFont(await resReg.arrayBuffer());
      }
    } catch {
      // Ignora erro e recorre ao fallback Helvetica de emergência
    }
  }

  // Fallback de emergência caso ocorra falha no carregamento dos arquivos oficiais
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
      // Nome do drink: 20 pt, vinho
      for (const line of drink.nameLines) {
        const tw = fontBold.widthOfTextAtSize(line, 20);
        const x = (567 - tw) / 2;
        const y = 850.5 - (currentY + 20);
        copied.drawText(line, { x, y, size: 20, font: fontBold, color: wine });
        currentY += 24;
      }

      // Descrição do drink: 16 pt, tom escuro
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

    // Personalização do evento na última página
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
      } else if (p.kind === "bachelor") {
        const tw = fontBold.widthOfTextAtSize("GAME OVER", 24);
        copied.drawText("GAME OVER", {
          x: (567 - tw) / 2,
          y: 850.5 - 725,
          size: 24,
          font: fontBold,
          color: wine,
        });
      } else if (p.label) {
        const text = p.label.toUpperCase();
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

  const pdfBytes = await outDoc.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
}

export async function generateEventMenuPdf(menu: EventMenuModel): Promise<Blob> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

  // Tenta primeiro renderizar via Edge Function com browser rendering
  if (session?.access_token && supabaseUrl) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/event-menu-render-pdf`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ menu }),
      });

      if (response.ok) {
        const blob = await response.blob();
        if (blob.type === "application/pdf" || blob.size > 1000) {
          return blob;
        }
      } else {
        console.warn("[event-menu-service] Edge function retornou status:", response.status);
      }
    } catch (err) {
      console.warn("[event-menu-service] Falha de conexão com a edge function:", err);
    }
  }

  // Fallback resiliente: renderização vetorial no cliente com pdf-lib
  return await renderMenuWithPdfLib(menu);
}

export function downloadEventMenuPdfBlob(blob: Blob, eventName?: string | null) {
  const filename = `cardapio-${safeFilename(eventName || "goat-bar") || "goat-bar"}.pdf`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface EventMenuSettings {
  event_id: string;
  artwork_mode: "automatic" | "library" | "ai" | "upload";
  artwork_url: string | null;
  custom_label: string | null;
  updated_at?: string;
}

export async function getEventMenuSettings(eventId: string): Promise<EventMenuSettings | null> {
  const { data, error } = await (supabase as any)
    .from("event_menu_settings")
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) throw error;
  return (data || null) as EventMenuSettings | null;
}

export async function saveEventMenuSettings(
  eventId: string,
  updates: Partial<Pick<EventMenuSettings, "artwork_mode" | "artwork_url" | "custom_label">>,
): Promise<EventMenuSettings> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError || new Error("Usuário não autenticado.");

  const { data, error } = await (supabase as any)
    .from("event_menu_settings")
    .upsert({
      event_id: eventId,
      artwork_mode: updates.artwork_mode || "automatic",
      artwork_url: updates.artwork_url ?? null,
      custom_label: updates.custom_label ?? null,
      updated_by: userData.user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "event_id" })
    .select()
    .single();

  if (error) throw error;
  return data as EventMenuSettings;
}

export async function uploadEventMenuArtwork(eventId: string, file: File): Promise<EventMenuSettings> {
  if (!file.type.startsWith("image/")) throw new Error("Selecione um arquivo de imagem.");
  if (file.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 5 MB.");

  const extension = (file.name.split(".").pop() || "png").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const path = `${eventId}/upload-${Date.now()}.${extension || "png"}`;
  const { error } = await supabase.storage.from("event-menu-assets").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;

  const { data } = supabase.storage.from("event-menu-assets").getPublicUrl(path);
  return saveEventMenuSettings(eventId, {
    artwork_mode: "upload",
    artwork_url: data.publicUrl,
  });
}

export async function generateEventMenuArtwork(input: {
  eventId: string;
  eventType?: string | null;
  eventName?: string | null;
  brideName?: string | null;
  groomName?: string | null;
  date?: string | null;
}): Promise<EventMenuSettings> {
  const { data, error } = await supabase.functions.invoke("event-menu-generate-artwork", {
    body: input,
  });
  if (error) throw error;
  if (!data?.artworkUrl) throw new Error(data?.error || "A IA não retornou uma arte válida.");

  return {
    event_id: input.eventId,
    artwork_mode: "ai",
    artwork_url: data.artworkUrl,
    custom_label: null,
    updated_at: data.updatedAt,
  };
}
