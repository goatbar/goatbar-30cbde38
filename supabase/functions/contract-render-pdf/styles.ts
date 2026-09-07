// supabase/functions/contract-render-pdf/styles.ts
// Shared canonical styles and deterministic embedded font for PDF rendering

import {
  CANONICAL_FONT_FAMILY,
  CANONICAL_FONT_REGULAR_BASE64,
  CANONICAL_FONT_BOLD_BASE64,
} from "./font.ts";

export const CANONICAL_FONT_FACE_CSS = `
@font-face {
  font-family: "${CANONICAL_FONT_FAMILY}";
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url(data:font/woff2;base64,${CANONICAL_FONT_REGULAR_BASE64}) format("woff2");
}

@font-face {
  font-family: "${CANONICAL_FONT_FAMILY}";
  font-style: normal;
  font-weight: 700;
  font-display: block;
  src: url(data:font/woff2;base64,${CANONICAL_FONT_BOLD_BASE64}) format("woff2");
}
`;

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
  }

  #contract-root {
    width: 100%;
    max-width: 180mm;
    margin: 0 auto;
    background: #ffffff !important;
    color: #0f172a !important;
    font-family: '${CANONICAL_FONT_FAMILY}', sans-serif;
    font-size: 13px;
    line-height: 1.6;
  }

  p {
    margin-top: 0;
    margin-bottom: 0.75rem;
    line-height: 1.6;
    text-align: left;
    orphans: 3;
    widows: 3;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: '${CANONICAL_FONT_FAMILY}', sans-serif;
    font-weight: 700;
    color: #020617 !important;
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

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
    break-inside: avoid;
    page-break-inside: avoid;
    background-color: #ffffff !important;
  }

  th, td {
    border: 1px solid #cbd5e1 !important;
    padding: 8px 12px;
    text-align: left;
    vertical-align: top;
    color: #0f172a !important;
    font-size: 12px;
  }

  th {
    background-color: #f8fafc !important;
    color: #020617 !important;
    font-weight: 700;
  }

  td {
    background-color: #ffffff !important;
  }

  ul, ol {
    margin-top: 0;
    margin-bottom: 0.75rem;
    padding-left: 1.5rem;
  }

  li {
    margin-bottom: 0.25rem;
    break-inside: avoid;
    page-break-inside: avoid;
  }

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

  .contract-signature-block,
  .signature-block,
  .signature-grid {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    margin-top: 2rem !important;
    padding-top: 0.5rem;
  }
`;
