/**
 * contract-document-styles.ts
 *
 * Estilos compartilhados e canônicos para visualização do canvas A4 e impressão/exportação em PDF.
 * Garante 100% de paridade visual entre o editor de contrato e o documento gerado final.
 */

export const CONTRACT_DOCUMENT_CSS = `
  /* Regras Globais da Folha A4 */
  .docx-canvas-paper {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #0f172a !important;
    background-color: #ffffff !important;
    font-size: 13px;
    line-height: 1.6;
  }

  /* Forçar isolamento de cor para elementos dentro da folha contra override de Tema Escuro */
  .docx-canvas-paper p,
  .docx-canvas-paper div,
  .docx-canvas-paper span,
  .docx-canvas-paper td,
  .docx-canvas-paper li {
    color: #0f172a !important;
  }

  /* Parágrafos e Espaçamentos */
  .docx-canvas-paper p {
    margin-top: 0;
    margin-bottom: 0.75rem;
    line-height: 1.6;
  }

  /* Títulos e Hierarquia */
  .docx-canvas-paper h1,
  .docx-canvas-paper h2,
  .docx-canvas-paper h3,
  .docx-canvas-paper h4,
  .docx-canvas-paper h5,
  .docx-canvas-paper h6 {
    font-weight: 700;
    color: #020617 !important;
    margin-top: 1.25rem;
    margin-bottom: 0.5rem;
    line-height: 1.3;
    break-after: avoid;
    page-break-after: avoid;
  }

  .docx-canvas-paper h1 { font-size: 20px; }
  .docx-canvas-paper h2 { font-size: 16px; }
  .docx-canvas-paper h3 { font-size: 14px; }
  .docx-canvas-paper h4 { font-size: 13px; }

  /* Tabelas */
  .docx-canvas-paper table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
    break-inside: avoid;
    page-break-inside: avoid;
    background-color: #ffffff !important;
  }

  .docx-canvas-paper th,
  .docx-canvas-paper td {
    border: 1px solid #cbd5e1 !important;
    padding: 8px 12px;
    text-align: left;
    vertical-align: top;
    color: #0f172a !important;
  }

  .docx-canvas-paper th {
    background-color: #f8fafc !important;
    color: #020617 !important;
    font-weight: 700;
  }

  .docx-canvas-paper td {
    background-color: #ffffff !important;
  }


  /* Listas */
  .docx-canvas-paper ul,
  .docx-canvas-paper ol {
    margin-top: 0;
    margin-bottom: 0.75rem;
    padding-left: 1.5rem;
  }

  .docx-canvas-paper li {
    margin-bottom: 0.25rem;
  }

  /* Elementos Visuais do Editor (Exibidos apenas no Canvas de Edição) */
  .docx-field-chip {
    background-color: rgba(99, 102, 241, 0.15) !important;
    color: #4f46e5 !important;
    border: 1px solid rgba(99, 102, 241, 0.4) !important;
    border-radius: 6px !important;
    padding: 2px 6px !important;
    font-family: monospace !important;
    font-weight: 700 !important;
    font-size: 11px !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 4px !important;
    margin: 0 2px !important;
    user-select: none !important;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important;
  }

  .docx-chip-del {
    background: rgba(99, 102, 241, 0.2) !important;
    color: #4f46e5 !important;
    border: none !important;
    border-radius: 50% !important;
    width: 14px !important;
    height: 14px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 11px !important;
    line-height: 1 !important;
    cursor: pointer !important;
    margin-left: 2px !important;
    transition: background 0.15s !important;
  }

  .docx-chip-del:hover {
    background: #ef4444 !important;
    color: #ffffff !important;
  }

  /* Paginação de Tela vs Impressão */
  @media screen {
    .docx-page-break {
      display: block !important;
      border-top: 1px dashed #a5b4fc !important;
      margin: 2.5rem 0 !important;
      padding: 8px 0 !important;
      text-align: center !important;
      color: #6366f1 !important;
      font-size: 10px !important;
      font-weight: 700 !important;
      letter-spacing: 0.05em !important;
      user-select: none !important;
    }
    .docx-page-break::after {
      content: "— QUEBRA DE PÁGINA A4 —";
    }
  }

  @media print {
    .docx-page-break {
      page-break-after: always !important;
      break-after: page !important;
      display: block !important;
      height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
    }
    .docx-page-break::after {
      content: "" !important;
    }
  }
`;

/** Self-contained styles for the isolated A4 document captured for signing. */
export const CONTRACT_PDF_DOCUMENT_CSS = `
  @page { size: A4; margin: 23mm 23mm 23mm 23mm; }
  html, body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; color: #000000 !important; color-scheme: light only; }
  #contract-pdf-document {
    box-sizing: border-box;
    width: 164mm;
    min-height: 251mm;
    margin: 0;
    padding: 0;
    overflow-wrap: break-word;
    word-break: break-word;
    background: #ffffff !important;
    color: #000000 !important;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 14.85px; /* ≈ 11pt at 96 dpi (1pt = 1.3333px) */
    line-height: 1.42;
  }
  #contract-pdf-document, #contract-pdf-document * { color-scheme: light only; }
  #contract-pdf-document * { color: #000000 !important; }
  #contract-pdf-document p, #contract-pdf-document div, #contract-pdf-document span, #contract-pdf-document li { background-color: transparent !important; }

  /* Body paragraphs */
  #contract-pdf-document p {
    margin: 0 0 9px;
    line-height: 1.42;
    text-align: justify;
  }

  /* Heading hierarchy — mirrors the old contract's visual weight */
  #contract-pdf-document h1, #contract-pdf-document h2, #contract-pdf-document h3,
  #contract-pdf-document h4, #contract-pdf-document h5, #contract-pdf-document h6 {
    color: #000000 !important;
    font-weight: 700;
    line-height: 1.25;
    margin-bottom: 6px;
    break-after: avoid;
    page-break-after: avoid;
  }

  /* Main title: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS" */
  #contract-pdf-document h1 {
    font-size: 18.67px; /* ≈ 14pt */
    margin-top: 0;
    margin-bottom: 14px;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  /* Section label: "CONTRATANTE:", "CONTRATADA:" */
  #contract-pdf-document h2 {
    font-size: 16px; /* ≈ 12pt */
    margin-top: 18px;
    margin-bottom: 5px;
  }

  /* Clause titles: "CLÁUSULA 1ª — ..." */
  #contract-pdf-document h3 {
    font-size: 14.85px; /* ≈ 11pt, same as body but bold */
    margin-top: 16px;
    margin-bottom: 5px;
  }

  #contract-pdf-document h4 { font-size: 14.85px; margin-top: 12px; margin-bottom: 4px; }

  #contract-pdf-document strong, #contract-pdf-document b { font-weight: 700; }

  /* Lists */
  #contract-pdf-document ul, #contract-pdf-document ol {
    margin: 0 0 9px;
    padding-left: 1.6rem;
  }
  #contract-pdf-document li { margin-bottom: 3px; line-height: 1.42; }

  /* Tables */
  #contract-pdf-document table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    break-inside: avoid;
    page-break-inside: avoid;
    background: #ffffff !important;
  }
  #contract-pdf-document th, #contract-pdf-document td {
    border: 1px solid #cbd5e1;
    padding: 6px 10px;
    text-align: left;
    vertical-align: top;
    color: #000000 !important;
    font-size: 14.85px;
    line-height: 1.42;
  }
  #contract-pdf-document th { background: #f8fafc !important; font-weight: 700; }
  #contract-pdf-document td { background: #ffffff !important; }

  /* Page breaks */
  #contract-pdf-document .docx-page-break,
  #contract-pdf-document [style*="page-break-after"],
  #contract-pdf-document [style*="break-after"] {
    display: block !important;
    height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    page-break-after: always !important;
    break-after: page !important;
  }

  /* Signature block — keep on same page as preceding text */
  #contract-pdf-document .signature-block {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-top: 24px;
  }
`;


export const CONTRACT_PRINT_HTML_SHELL = (title: string, bodyHtml: string): string => `
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
      @page {
        size: A4;
        margin: 20mm 15mm 20mm 15mm;
      }
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #0f172a;
        font-size: 13px;
        line-height: 1.6;
        padding: 0;
        margin: 0;
        background: #ffffff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      p {
        margin-top: 0;
        margin-bottom: 0.75rem;
        line-height: 1.6;
      }
      h1, h2, h3, h4, h5, h6 {
        font-weight: 700;
        color: #020617;
        margin-top: 1.25rem;
        margin-bottom: 0.5rem;
        line-height: 1.3;
        break-after: avoid;
        page-break-after: avoid;
      }
      h1 { font-size: 20px; }
      h2 { font-size: 16px; }
      h3 { font-size: 14px; }
      h4 { font-size: 13px; }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 1rem 0;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      th, td {
        border: 1px solid #cbd5e1;
        padding: 8px 12px;
        text-align: left;
        vertical-align: top;
      }
      th {
        background-color: #f8fafc;
        font-weight: 700;
      }
      ul, ol {
        margin-top: 0;
        margin-bottom: 0.75rem;
        padding-left: 1.5rem;
      }
      li {
        margin-bottom: 0.25rem;
      }
      .docx-page-break {
        page-break-after: always !important;
        break-after: page !important;
        display: block !important;
        height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
      }
      @media print {
        body { padding: 0; }
        .docx-page-break {
          page-break-after: always !important;
          break-after: page !important;
        }
      }
    </style>
  </head>
  <body>
    ${bodyHtml}
  </body>
</html>
`;
