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
