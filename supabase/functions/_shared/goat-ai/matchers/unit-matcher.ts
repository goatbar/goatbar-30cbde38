export interface UnitMatchResult {
  matched: boolean;
  unitName: string;
  modality: "Steakhouse" | "Goatbotequim" | "Evento" | "Geral";
  confidence: number;
}

export function matchUnitName(input?: string | null): UnitMatchResult {
  if (!input || typeof input !== "string") {
    return { matched: false, unitName: "Geral", modality: "Geral", confidence: 0 };
  }

  const clean = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (
    clean.includes("7") ||
    clean.includes("sete") ||
    clean.includes("steak") ||
    clean.includes("steakhouse")
  ) {
    return {
      matched: true,
      unitName: "7 Steak House",
      modality: "Steakhouse",
      confidence: 0.95,
    };
  }

  if (
    clean.includes("botequim") ||
    clean.includes("boteco") ||
    clean.includes("goat botequim") ||
    clean.includes("goatbotequim")
  ) {
    return {
      matched: true,
      unitName: "Goat Botequim",
      modality: "Goatbotequim",
      confidence: 0.95,
    };
  }

  if (clean.includes("evento") || clean.includes("casamento") || clean.includes("aniversario") || clean.includes("formatura")) {
    return {
      matched: true,
      unitName: "Eventos",
      modality: "Evento",
      confidence: 0.9,
    };
  }

  return {
    matched: false,
    unitName: input.trim(),
    modality: "Geral",
    confidence: 0.3,
  };
}
