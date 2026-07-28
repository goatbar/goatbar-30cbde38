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

