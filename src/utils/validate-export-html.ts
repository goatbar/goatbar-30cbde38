/**
 * validate-export-html.ts
 *
 * Validador estrito do HTML final de exportação de contratos.
 * Garante que nenhum controle de editor, chip visual, atributo de edição ou placeholder não resolvido
 * esteja presente no documento final a ser enviado para impressão, prévia ou PDF.
 */

export type ExportHtmlIssueType =
  | "placeholder"
  | "editor_element"
  | "editor_attribute"
  | "temporary_tag"
  | "empty_node";

export interface ExportHtmlIssue {
  type: ExportHtmlIssueType;
  token: string;
  rule: string;
  message: string;
}

export interface ExportHtmlValidationResult {
  valid: boolean;
  errors: string[];
  unresolvedFields: string[];
  issues: ExportHtmlIssue[];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function validateExportHtml(html: string): ExportHtmlValidationResult {
  const issues: ExportHtmlIssue[] = [];

  if (!html || typeof html !== "string") {
    return {
      valid: false,
      errors: ["O HTML do contrato está vazio."],
      unresolvedFields: [],
      issues: [
        {
          type: "empty_node",
          token: "",
          rule: "html_not_empty",
          message: "O HTML do contrato está vazio.",
        },
      ],
    };
  }

  const forbiddenElements = [
    {
      pattern: /class="[^"]*docx-field-chip[^"]*"/i,
      name: "Chip do editor (docx-field-chip)",
      rule: "editor_chip_class",
    },
    {
      pattern: /class="[^"]*docx-chip-del[^"]*"/i,
      name: "Botão de exclusão do chip (docx-chip-del)",
      rule: "editor_delete_button_class",
    },
    {
      pattern: /data-delete-key=/i,
      name: "Atributo data-delete-key",
      rule: "editor_delete_key_attribute",
    },
    {
      pattern: /<button[^>]*>.*?×.*?<\/button>/i,
      name: "Botão de exclusão '×'",
      rule: "editor_delete_button",
    },
  ];

  forbiddenElements.forEach(({ pattern, name, rule }) => {
    const match = html.match(pattern);
    if (match) {
      issues.push({
        type: "editor_element",
        token: match[0],
        rule,
        message: `Elemento visual de edição encontrado: ${name}`,
      });
    }
  });

  const forbiddenAttributes = [
    "contenteditable",
    "data-editor",
    "data-lexical",
    "data-slate",
    "data-prosemirror",
  ];

  forbiddenAttributes.forEach((attr) => {
    const regex = new RegExp(`\\b${attr}\\s*=`, "i");
    const match = html.match(regex);
    if (match) {
      issues.push({
        type: "editor_attribute",
        token: match[0],
        rule: `forbidden_attribute:${attr}`,
        message: `Atributo de edição proibido encontrado: ${attr}`,
      });
    }
  });

  const placeholderRules = [
    { regex: /\{\{\s*([a-zA-Z0-9._-]+)\s*\}\}/g, rule: "unresolved_curly_placeholder" },
    { regex: /\$\{\s*([a-zA-Z0-9._-]+)\s*\}/g, rule: "unresolved_dollar_placeholder" },
    { regex: /\[\s*([A-Z][A-Z0-9_]{2,})\s*\]/g, rule: "unresolved_bracket_placeholder" },
  ];

  placeholderRules.forEach(({ regex, rule }) => {
    for (const match of html.matchAll(regex)) {
      issues.push({
        type: "placeholder",
        token: match[0],
        rule,
        message: `Campo pendente não substituído: ${match[0]}`,
      });
    }
  });

  // Quebras de página normalizadas são legítimas e não entram como pendência.
  const unresolvedFields = unique(
    issues.filter((issue) => issue.type === "placeholder").map((issue) => issue.token),
  );
  const errors = unique(issues.map((issue) => issue.message));

  return {
    valid: issues.length === 0,
    errors,
    unresolvedFields,
    issues,
  };
}
