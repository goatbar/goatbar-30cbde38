export const FALLBACK_PROPOSAL_FILENAME = "Proposta Comercial - Evento.pdf";

/** Builds a safe proposal filename from the canonical, persisted event name. */
export function buildProposalFilename(eventName: string | null | undefined): string {
  const sanitizedName = (eventName ?? "")
    .replace(/[\/\\:*?"<>|]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .trim();

  return sanitizedName ? `Proposta Comercial - ${sanitizedName}.pdf` : FALLBACK_PROPOSAL_FILENAME;
}
