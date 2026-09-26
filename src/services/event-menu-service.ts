import { supabase } from "@/integrations/supabase/client";
import goatbarLogo from "@/assets/goatbar-logo.png";
import type { EventMenuModel } from "@/lib/event-menu";

async function imageUrlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Não foi possível carregar a identidade visual da GOAT Bar.");
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao preparar a identidade visual."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(blob);
  });
}

function safeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export async function generateEventMenuPdf(menu: EventMenuModel): Promise<Blob> {
  const logoDataUrl = await imageUrlToDataUrl(goatbarLogo);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Sessão expirada. Entre novamente para gerar o cardápio.");
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
  const response = await fetch(`${supabaseUrl}/functions/v1/event-menu-render-pdf`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      menu,
      logoDataUrl,
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    let message = "Falha ao gerar o PDF do cardápio.";
    try {
      const parsed = JSON.parse(raw);
      message = parsed.error || parsed.message || message;
    } catch {
      if (raw) message = raw.slice(0, 300);
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  if (blob.type && blob.type !== "application/pdf") {
    throw new Error("O gerador não retornou um PDF válido.");
  }
  return blob;
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
