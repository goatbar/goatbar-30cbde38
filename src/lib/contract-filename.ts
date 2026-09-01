/**
 * contract-filename.ts
 *
 * Builds the human-readable filename for the contract PDF,
 * used both when saving locally and when uploading to Assinafy.
 *
 * Pattern: "Contrato Goat Bar - {nome_evento_ou_cliente} - {data_evento}.pdf"
 * Example: "Contrato Goat Bar - Mariana Campos Moreira - 14-11-2026.pdf"
 *
 * Preserves accented characters; strips only characters that are
 * illegal in filenames on Windows/macOS/Linux.
 */

export const FALLBACK_CONTRACT_FILENAME = "Contrato Goat Bar - Evento.pdf";

/** Characters illegal in filenames across Windows, macOS, and Linux. */
const ILLEGAL_FILENAME_CHARS = /[/\\:*?"<>|]/g;

/** Sanitizes a string for use in a filename, preserving accents. */
function sanitizeForFilename(value: string): string {
  return value
    .replace(ILLEGAL_FILENAME_CHARS, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .trim();
}

/**
 * Formats a date string (YYYY-MM-DD or ISO) to DD-MM-YYYY for the filename.
 * Returns an empty string if the date is invalid or absent.
 */
export function formatContractDate(date: string | null | undefined): string {
  if (!date) return "";
  // Accept YYYY-MM-DD or ISO timestamp; take only the date part
  const datePart = date.slice(0, 10);
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/**
 * Builds the human-readable contract filename from event data.
 *
 * @param eventName  The canonical/couple name (event_name field), preferred.
 * @param clientName Fallback client name (client_name field).
 * @param date       Event date in YYYY-MM-DD or ISO format.
 */
export function buildContractFilename(
  eventName: string | null | undefined,
  clientName: string | null | undefined,
  date: string | null | undefined,
): string {
  const rawName = (eventName || clientName || "").trim();
  const sanitizedName = sanitizeForFilename(rawName);
  const formattedDate = formatContractDate(date);

  if (!sanitizedName) return FALLBACK_CONTRACT_FILENAME;

  const parts = ["Contrato Goat Bar", sanitizedName];
  if (formattedDate) parts.push(formattedDate);

  return `${parts.join(" - ")}.pdf`;
}

/**
 * Returns the filename WITHOUT the .pdf extension, for use as the document
 * title in the PDF's <title> element and in the Assinafy document name.
 */
export function buildContractTitle(
  eventName: string | null | undefined,
  clientName: string | null | undefined,
  date: string | null | undefined,
): string {
  const filename = buildContractFilename(eventName, clientName, date);
  return filename.endsWith(".pdf") ? filename.slice(0, -4) : filename;
}
