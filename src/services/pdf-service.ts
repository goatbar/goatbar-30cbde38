import { prepareContractExportHtml } from "@/utils/prepare-contract-export-html";
import { CONTRACT_DOCUMENT_CSS } from "@/lib/contract-document-styles";

export async function calculateSha256(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function convertHtmlToPdf(
  htmlContent: string,
  title: string = "Contrato_GOAT_Bar"
): Promise<{ blob: Blob; base64: string; hash: string }> {
  const cleanHtml = prepareContractExportHtml(htmlContent);

  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.left = "-9999px";
  iframe.style.top = "0";
  iframe.style.width = "800px";
  iframe.style.height = "1100px";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    throw new Error("Não foi possível inicializar iframe para geração do PDF.");
  }

  iframeDoc.open();
  iframeDoc.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          ${CONTRACT_DOCUMENT_CSS}
          body {
            margin: 0;
            padding: 24px;
            background-color: #ffffff !important;
            color: #0f172a !important;
            font-family: system-ui, -apple-system, sans-serif;
          }
        </style>
      </head>
      <body class="docx-canvas-paper">
        ${cleanHtml}
      </body>
    </html>
  `);
  iframeDoc.close();

  try {
    const html2pdf = (await import("html2pdf.js")).default;
    const opt = {
      margin: [15, 15, 15, 15] as [number, number, number, number],
      filename: `${title}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    };

    const targetElement = iframeDoc.body;
    const pdfArrayBuffer: ArrayBuffer = await html2pdf()
      .set(opt)
      .from(targetElement)
      .outputPdf("arraybuffer");

    document.body.removeChild(iframe);

    const hash = await calculateSha256(pdfArrayBuffer);
    const pdfBlob = new Blob([pdfArrayBuffer], { type: "application/pdf" });

    let binary = "";
    const bytes = new Uint8Array(pdfArrayBuffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    return { blob: pdfBlob, base64, hash };
  } catch (err: any) {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
    console.error("Erro ao converter HTML para PDF:", err);
    throw new Error(`Não foi possível converter a minuta compilada para formato PDF: ${err?.message || String(err)}`);
  }
}
