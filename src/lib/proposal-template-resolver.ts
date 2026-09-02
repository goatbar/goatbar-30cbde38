export type ProposalEventTemplateType = "casamento" | "aniversario" | "comemoracao";

export const INTERNAL_PROPOSAL_TEMPLATE_IDS: Record<ProposalEventTemplateType, string> = {
  casamento: "goatbar-commercial-casamento",
  aniversario: "goatbar-commercial-aniversario",
  comemoracao: "goatbar-despedida-solteira",
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

/** Fonte única para converter o tipo persistido no evento no tipo de template. */
export function normalizeProposalEventType(eventType: string | null | undefined): ProposalEventTemplateType {
  const normalized = normalize(eventType || "");
  if (normalized.includes("casamento") || normalized.includes("matrimonio")) return "casamento";
  if (normalized.includes("aniversario") || normalized.includes("celebracao")) return "aniversario";
  if (
    normalized.includes("comemoracao") ||
    normalized.includes("corporativo") ||
    normalized.includes("despedida")
  ) return "comemoracao";

  // Os tipos não mapeados usam a família de comemoração, nunca casamento.
  return "comemoracao";
}

export type ResolvableProposalTemplate = {
  id: string;
  event_type: string;
  is_active: boolean;
  provider?: string | null;
};

/**
 * Resolve pelo event_type do evento. is_default, ordem de uso e proposta anterior
 * são deliberadamente ignorados. O ID nativo é preferido quando estiver presente.
 */
export function resolveProposalTemplate<T extends ResolvableProposalTemplate>(
  eventType: string | null | undefined,
  templates: readonly T[],
): T | null {
  const expectedType = normalizeProposalEventType(eventType);
  const candidates = templates.filter(
    (template) => template.is_active && normalizeProposalEventType(template.event_type) === expectedType,
  );
  if (!candidates.length) return null;

  const nativeId = INTERNAL_PROPOSAL_TEMPLATE_IDS[expectedType];
  return (
    candidates.find((template) => template.id === nativeId) ||
    candidates.find((template) => template.provider === "internal") ||
    [...candidates].sort((a, b) => a.id.localeCompare(b.id))[0]
  );
}
