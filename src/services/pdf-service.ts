import { prepareContractExportHtml } from "@/utils/prepare-contract-export-html";
import { CONTRACT_PDF_DOCUMENT_CSS } from "@/lib/contract-document-styles";
import html2pdf from "html2pdf.js";

export interface PdfArtifacts {
  blob: Blob;
  base64: string;
  hash: string;
}

export const CONTRACT_PDF_MIME_TYPE = "application/pdf";

function escapeHtmlText(value: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

/** Builds the exact, self-contained UTF-8 document captured for Assinafy. */
export function buildContractPdfDocument(htmlContent: string, title: string): string {
  const cleanHtml = prepareContractExportHtml(htmlContent);
  return `<!DOCTYPE html>
<html lang="pt-BR" style="background:#ffffff;color:#000000;color-scheme:light">
<head><meta charset="UTF-8"><meta name="color-scheme" content="light only"><title>${escapeHtmlText(title)}</title><style>${CONTRACT_PDF_DOCUMENT_CSS}</style></head>
<body style="background:#ffffff;color:#000000"><main id="contract-pdf-document">${cleanHtml}</main></body>
</html>`;
}

export async function calculateSha256(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function convertHtmlToPdf(
  htmlContent: string,
  title: string = "Contrato_GOAT_Bar",
  pdfRenderer: typeof html2pdf = html2pdf,
): Promise<PdfArtifacts> {
  const exportDocument = buildContractPdfDocument(htmlContent, title);

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
  iframeDoc.write(exportDocument);
  iframeDoc.close();

  try {
    const opt = {
      margin: [15, 15, 15, 15] as [number, number, number, number],
      filename: `${title}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    };

    const targetElement = iframeDoc.getElementById("contract-pdf-document");
    if (!targetElement) throw new Error("Documento isolado de exportação não foi criado.");
    const pdfArrayBuffer: ArrayBuffer = await pdfRenderer()
      .set(opt)
      .from(targetElement)
      .outputPdf("arraybuffer");

    document.body.removeChild(iframe);

    return createPdfArtifacts(pdfArrayBuffer);
  } catch (err: any) {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
    console.error("Erro ao converter HTML para PDF:", err);
    throw new Error(
      `Não foi possível converter a minuta compilada para formato PDF: ${err?.message || String(err)}`,
    );
  }
}

/** Builds every representation from one immutable buffer, so hash and upload cannot diverge. */
export async function createPdfArtifacts(pdfArrayBuffer: ArrayBuffer): Promise<PdfArtifacts> {
  const bytes = new Uint8Array(pdfArrayBuffer);
  if (bytes.byteLength < 5 || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw new Error("O renderizador não produziu um arquivo PDF válido.");
  }
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return {
    blob: new Blob([pdfArrayBuffer], { type: CONTRACT_PDF_MIME_TYPE }),
    base64: btoa(binary),
    hash: await calculateSha256(pdfArrayBuffer),
  };
}
