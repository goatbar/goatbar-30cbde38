/**
 * pdf-service.ts
 *
 * Serviço de geração de PDFs oficiais do GOAT Bar.
 * Substitui o mecanismo legado html2pdf.js/html2canvas pelo mecanismo nativo Chromium
 * via Supabase Edge Function `contract-render-pdf` e Cloudflare Browser Run Quick Action.
 *
 * Produz PDF vetorial leve, pesquisável e de alta fidelidade visual,
 * gerando um artefato imutável com hash SHA-256 consumido pelo fluxo da Assinafy.
 */

import { supabase } from "@/integrations/supabase/client";
import { prepareContractExportHtml } from "@/utils/prepare-contract-export-html";
import { formatContractDocumentHtml } from "@/utils/format-contract-document-html";
import { CANONICAL_CONTRACT_DOCUMENT_CSS } from "@/lib/contract-document-styles";

export interface PdfArtifacts {
  blob: Blob;
  base64: string;
  hash: string;
}

export const CONTRACT_PDF_MIME_TYPE = "application/pdf";

export type PdfTransportFn = (payload: {
  html: string;
  title: string;
  contractId?: string;
}) => Promise<ArrayBuffer>;

function escapeHtmlText(value: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return (value || "").replace(/[&<>"']/g, (character) => entities[character] || character);
}

/** Builds the exact, self-contained UTF-8 canonical document. */
export function buildContractPdfDocument(htmlContent: string, title: string): string {
  const cleanHtml = formatContractDocumentHtml(prepareContractExportHtml(htmlContent));
  return `<!DOCTYPE html>
<html lang="pt-BR" style="background:#ffffff; color:#0f172a; color-scheme: light;">
<head>
  <meta charset="UTF-8">
  <meta name="color-scheme" content="light only">
  <title>${escapeHtmlText(title)}</title>
  <style>
${CANONICAL_CONTRACT_DOCUMENT_CSS}
  </style>
</head>
<body style="margin:0; background:#ffffff !important; color:#0f172a !important;">
  <main id="contract-root">
${cleanHtml}
  </main>
</body>
</html>`;
}

export async function calculateSha256(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Converte HTML do contrato compilado em PDF vetorial oficial via Cloudflare Browser Run.
 */
export async function convertHtmlToPdf(
  htmlContent: string,
  title: string = "Contrato_GOAT_Bar",
  contractIdOrTransport?: string | PdfTransportFn,
): Promise<PdfArtifacts> {
  const preparedHtml = formatContractDocumentHtml(prepareContractExportHtml(htmlContent));

  let pdfArrayBuffer: ArrayBuffer;

  if (typeof contractIdOrTransport === "function") {
    // Transporte customizado / injetado (ex: suíte de testes unitários)
    pdfArrayBuffer = await contractIdOrTransport({
      html: preparedHtml,
      title,
    });
  } else {
    const contractId = typeof contractIdOrTransport === "string" ? contractIdOrTransport : undefined;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      throw new Error("Sessão expirada ou usuário não autenticado para emissão do contrato.");
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

    const response = await fetch(`${supabaseUrl}/functions/v1/contract-render-pdf`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html: preparedHtml,
        title,
        contractId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `Falha na geração do PDF (${response.status}): ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.error || errorJson.message || errorMsg;
      } catch {
        if (errorText) errorMsg = errorText.slice(0, 300);
      }
      throw new Error(errorMsg);
    }

    pdfArrayBuffer = await response.arrayBuffer();
  }

  return createPdfArtifacts(pdfArrayBuffer);
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
