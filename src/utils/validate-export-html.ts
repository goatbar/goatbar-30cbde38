/**
 * validate-export-html.ts
 *
 * Validador estrito do HTML final de exportação de contratos.
 * Garante que nenhum controle de editor, chip visual, atributo de edição ou placeholder não resolvido
 * esteja presente no documento final a ser enviado para impressão, prévia ou PDF.
 */

export interface ExportHtmlValidationResult {
  valid: boolean;
  errors: string[];
  unresolvedFields: string[];
}

export function validateExportHtml(html: string): ExportHtmlValidationResult {
  const errors: string[] = [];

  if (!html || typeof html !== "string") {
    return {
      valid: false,
      errors: ["O HTML do contrato está vazio."],
      unresolvedFields: [],
    };
  }

  // 1. Verificação de elementos ou classes proibidos do editor
  const forbiddenElements = [
    { pattern: /class="[^"]*docx-field-chip[^"]*"/i, name: "Chip do editor (docx-field-chip)" },
    { pattern: /class="[^"]*docx-chip-del[^"]*"/i, name: "Botão de exclusão do chip (docx-chip-del)" },
    { pattern: /data-delete-key=/i, name: "Atributo data-delete-key" },
    { pattern: /<button[^>]*>.*?×.*?<\/button>/i, name: "Botão de exclusão '×'" },
  ];

  forbiddenElements.forEach(({ pattern, name }) => {
    if (pattern.test(html)) {
      errors.push(`Elemento visual de edição encontrado: ${name}`);
    }
  });

  // 2. Verificação de atributos de edição proibidos
  const forbiddenAttributes = [
    "contenteditable",
    "data-editor",
    "data-lexical",
    "data-slate",
    "data-prosemirror",
  ];

  forbiddenAttributes.forEach((attr) => {
    const regex = new RegExp(`\\b${attr}\\s*=`, "i");
    if (regex.test(html)) {
      errors.push(`Atributo de edição proibido encontrado: ${attr}`);
    }
  });

  // 3. Detecção de placeholders de variáveis não resolvidos {{campo}} ou [CAMPO]
  const unresolvedCurly = html.match(/\{\{\s*([a-zA-Z0-9._]+)\s*\}\}/g) ?? [];
  const unresolvedBrackets = html.match(/\[([A-Z0-9_]{3,})\]/g) ?? [];

  const rawUnresolved = [...unresolvedCurly, ...unresolvedBrackets];
  const unresolvedFields = Array.from(new Set(rawUnresolved));

  if (unresolvedFields.length > 0) {
    errors.push(`Campos pendentes não substituídos no documento: ${unresolvedFields.join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    unresolvedFields,
  };
}
