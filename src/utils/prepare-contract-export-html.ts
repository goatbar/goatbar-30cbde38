/**
 * prepare-contract-export-html.ts
 *
 * Fonte de verdade única e canônica para sanitização, normalização e validação
 * de qualquer HTML de contrato antes da exportação (Preview, Copiar, Imprimir, PDF e ZapSign).
 */

import { normalizeEditorHtml } from "./normalize-editor-html";
import { validateExportHtml, type ExportHtmlValidationResult } from "./validate-export-html";

export class ContractExportValidationError extends Error {
  errors: string[];
  unresolvedFields: string[];

  constructor(validation: ExportHtmlValidationResult) {
    super("O contrato possui elementos de edição ou campos pendentes não substituídos.");
    this.name = "ContractExportValidationError";
    this.errors = validation.errors;
    this.unresolvedFields = validation.unresolvedFields;
  }
}

/**
 * Prepara o HTML de contrato para exportação e renderização oficial.
 * Executa: normalizeEditorHtml -> validateExportHtml.
 * Se a validação contiver falhas estritas (como botões '×' ou placeholders), lança ContractExportValidationError.
 */
export function prepareContractExportHtml(html: string): string {
  if (!html || typeof html !== "string") return "";

  const cleanHtml = normalizeEditorHtml(html);
  const validation = validateExportHtml(cleanHtml);

  if (!validation.valid) {
    console.warn("⚠️ [Contract Export Validation Warning]:", validation.errors);
    throw new ContractExportValidationError(validation);
  }

  return cleanHtml;
}
