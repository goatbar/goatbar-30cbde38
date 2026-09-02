/**
 * @deprecated PDF export must not infer or add presentation from contract text.
 * Kept as an identity helper for compatibility with older imports.
 */
export function formatContractDocumentHtml(html: string): string {
  return typeof html === "string" ? html : "";
}
