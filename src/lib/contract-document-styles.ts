/**
 * contract-document-styles.ts
 *
 * Estilos compartilhados e canônicos para visualização do canvas A4 e impressão/exportação em PDF.
 * Garante 100% de paridade visual entre o editor/prévia de contrato e o documento gerado final.
 */

import { CANONICAL_FONT_FACE_CSS, CANONICAL_FONT_FAMILY } from "./canonical-contract-font";

export { CANONICAL_FONT_FACE_CSS, CANONICAL_FONT_FAMILY };

export const CANONICAL_CONTRACT_DOCUMENT_CSS = `
  ${CANONICAL_FONT_FACE_CSS}

  @page {
    size: A4 portrait;
    margin: 20mm 15mm 20mm 15mm;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    color: #0f172a !important;
    font-family: '${CANONICAL_FONT_FAMILY}', sans-serif;
    font-size: 13px;
    line-height: 1.6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-scheme: light;
    forced-color-adjust: none;
  }

  #contract-root,
  #contract-pdf-document,
  .docx-canvas-paper {
    width: 100%;
    max-width: 180mm;
    margin: 0 auto;
    background: #ffffff !important;
    color: #0f172a !important;
    font-family: '${CANONICAL_FONT_FAMILY}', sans-serif;
    font-size: 13px;
    line-height: 1.6;
  }

  /* Isolamento visual determinístico: o PDF oficial é sempre preto sobre branco.
     Inclui tags <font> vindas do DOCX e neutraliza efeitos que podem clarear o texto. */
  #contract-root p, #contract-root div, #contract-root span, #contract-root font,
  #contract-root td, #contract-root th, #contract-root li, #contract-root strong,
  #contract-root b, #contract-root em, #contract-root i, #contract-root u,
  #contract-root a, #contract-root small, #contract-root sub, #contract-root sup,
  .docx-canvas-paper p, .docx-canvas-paper div, .docx-canvas-paper span, .docx-canvas-paper font,
  .docx-canvas-paper td, .docx-canvas-paper th, .docx-canvas-paper li, .docx-canvas-paper strong,
  .docx-canvas-paper b, .docx-canvas-paper em, .docx-canvas-paper i, .docx-canvas-paper u,
  .docx-canvas-paper a, .docx-canvas-paper small, .docx-canvas-paper sub, .docx-canvas-paper sup {
    color: #0f172a !important;
    -webkit-text-fill-color: #0f172a !important;
    opacity: 1 !important;
    filter: none !important;
    mix-blend-mode: normal !important;
  }

  /* Parágrafos e Espaçamentos */
  p,
  .docx-canvas-paper p,
  #contract-root p {
    margin-top: 0;
    margin-bottom: 0.75rem;
    line-height: 1.6;
    text-align: left;
    orphans: 3;
    widows: 3;
  }

  /* Títulos e Hierarquia */
  h1, h2, h3, h4, h5, h6,
  .docx-canvas-paper h1, .docx-canvas-paper h2, .docx-canvas-paper h3,
  .docx-canvas-paper h4, .docx-canvas-paper h5, .docx-canvas-paper h6,
  #contract-root h1, #contract-root h2, #contract-root h3,
  #contract-root h4, #contract-root h5, #contract-root h6 {
    font-family: '${CANONICAL_FONT_FAMILY}', sans-serif;
    font-weight: 700;
    color: #020617 !important;
    margin-top: 1.25rem;
    margin-bottom: 0.5rem;
    line-height: 1.3;
    break-after: avoid;
    page-break-after: avoid;
  }

  h1, .docx-canvas-paper h1, #contract-root h1 { font-size: 20px; }
  h2, .docx-canvas-paper h2, #contract-root h2 { font-size: 16px; }
  h3, .docx-canvas-paper h3, #contract-root h3 { font-size: 14px; }
  h4, .docx-canvas-paper h4, #contract-root h4 { font-size: 13px; }

  /* Classes semânticas adicionais */
  .contract-title {
    font-size: 20px !important;
    font-weight: 700 !important;
    margin-bottom: 1rem !important;
    break-after: avoid;
    page-break-after: avoid;
  }

  .contract-party-heading {
    font-size: 14px !important;
    font-weight: 700 !important;
    margin-top: 1rem !important;
    margin-bottom: 0.5rem !important;
    break-after: avoid;
    page-break-after: avoid;
  }

  .contract-clause-heading {
    font-size: 15px !important;
    font-weight: 700 !important;
    margin-top: 1.25rem !important;
    margin-bottom: 0.5rem !important;
    break-after: avoid;
    page-break-after: avoid;
  }

  .contract-alpha-item {
    margin-left: 1.5rem !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  strong, b {
    font-weight: 700;
  }

  /* Tabelas */
  table,
  .docx-canvas-paper table,
  #contract-root table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
    break-inside: avoid;
    page-break-inside: avoid;
    background-color: #ffffff !important;
  }

  th, td,
  .docx-canvas-paper th, .docx-canvas-paper td,
  #contract-root th, #contract-root td {
    border: 1px solid #cbd5e1 !important;
    padding: 8px 12px;
    text-align: left;
    vertical-align: top;
    color: #0f172a !important;
    font-size: 12px;
  }

  th, .docx-canvas-paper th, #contract-root th {
    background-color: #f8fafc !important;
    color: #020617 !important;
    font-weight: 700;
  }

  td, .docx-canvas-paper td, #contract-root td {
    background-color: #ffffff !important;
  }

  /* Listas */
  ul, ol,
  .docx-canvas-paper ul, .docx-canvas-paper ol,
  #contract-root ul, #contract-root ol {
    margin-top: 0;
    margin-bottom: 0.75rem;
    padding-left: 1.5rem;
  }

  li,
  .docx-canvas-paper li,
  #contract-root li {
    margin-bottom: 0.25rem;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* Quebra de página explícita */
  .docx-page-break,
  [style*="page-break-after"],
  [style*="break-after"] {
    display: block !important;
    height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    page-break-after: always !important;
    break-after: page !important;
  }

  /* Bloco de Assinaturas Semântico e Inseparável */
  .contract-signature-block,
  .signature-block,
  .signature-grid {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    margin-top: 2rem !important;
    padding-top: 0.5rem;
  }

  /* Chips visuais do editor (apenas no modo de edição) */
  .docx-field-chip {
    background-color: rgba(99, 102, 241, 0.15) !important;
    color: #4f46e5 !important;
    border-radius: 4px;
    padding: 1px 4px;
    font-family: monospace;
    font-weight: 700;
  }
`;

export const CONTRACT_DOCUMENT_CSS = CANONICAL_CONTRACT_DOCUMENT_CSS;
export const CONTRACT_PDF_DOCUMENT_CSS = CANONICAL_CONTRACT_DOCUMENT_CSS;

export const CONTRACT_PRINT_HTML_SHELL = (title: string, bodyHtml: string): string => `
<!DOCTYPE html>
<html lang="pt-BR" style="background:#ffffff; color:#0f172a;">
  <head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
      ${CANONICAL_CONTRACT_DOCUMENT_CSS}
    </style>
  </head>
  <body style="margin:0; background:#ffffff !important; color:#0f172a !important;">
    <main id="contract-root" class="docx-canvas-paper">
      ${bodyHtml}
    </main>
  </body>
</html>
`;
