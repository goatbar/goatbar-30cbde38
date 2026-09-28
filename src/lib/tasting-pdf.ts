const endpoint=()=>`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tasting-render-pdf`;
const anonKey=()=>import.meta.env.VITE_SUPABASE_ANON_KEY||"";

export async function exportTastingPublicPagePdf(
  publicToken: string,
  eventName: string,
) {
  const response = await fetch(endpoint(), {
    method: "POST",
    headers: {
      apikey: anonKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token: publicToken }),
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    let message = `Falha ao gerar PDF da degustação (${response.status}).`;
    try {
      const parsed = JSON.parse(raw);
      message = parsed?.error || parsed?.message || message;
    } catch {
      if (raw) message = raw.slice(0, 300);
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  if (!blob.size) throw new Error("O PDF da degustação foi gerado vazio.");

  const safeName = String(eventName || "Degustacao").replace(
    /[^a-z0-9]+/gi,
    "_",
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `Degustacao_${safeName}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
