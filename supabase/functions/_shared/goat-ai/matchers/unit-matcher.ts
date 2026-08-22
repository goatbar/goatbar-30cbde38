export type BusinessUnitId = "goat_botequim" | "steakhouse" | "eventos" | "geral";
export type CanonicalDatabaseModality = "Goat Botequim" | "7Steakhouse" | "Evento" | "Geral";

export interface BusinessUnitResolution {
  id: BusinessUnitId;
  canonicalName: string;
  dbModality: CanonicalDatabaseModality;
  modality: "Goatbotequim" | "Steakhouse" | "Evento" | "Geral";
  matched: boolean;
  confidence: number;
  aliases: string[];
  sqlFilterPatterns: string[];
}

export interface UnitMatchResult {
  matched: boolean;
  unitName: string;
  modality: "Steakhouse" | "Goatbotequim" | "Evento" | "Geral";
  confidence: number;
  canonicalName?: string;
  dbModality?: CanonicalDatabaseModality;
  businessUnitId?: BusinessUnitId;
}

const BUSINESS_UNITS: Record<Exclude<BusinessUnitId, "geral">, Omit<BusinessUnitResolution, "matched" | "confidence">> = {
  goat_botequim: {
    id: "goat_botequim",
    canonicalName: "Goat Botequim",
    dbModality: "Goat Botequim",
    modality: "Goatbotequim",
    aliases: [
      "Goat Botequim",
      "goat botequim",
      "botequim",
      "boteco",
      "goatbotequim",
      "goat boteco",
      "unidade botequim",
      "bar botequim",
    ],
    sqlFilterPatterns: ["Goat Botequim", "%botequim%", "%goatbotequim%", "%goat botequim%", "%boteco%"],
  },
  steakhouse: {
    id: "steakhouse",
    canonicalName: "7 Steak House",
    dbModality: "7Steakhouse",
    modality: "Steakhouse",
    aliases: [
      "7Steakhouse",
      "7 Steakhouse",
      "7 Steak House",
      "7 Steak",
      "sete steakhouse",
      "sete steak",
      "steakhouse",
      "7steakhouse",
      "steak",
    ],
    sqlFilterPatterns: ["7Steakhouse", "%7Steak%", "%7 Steak%", "%steakhouse%", "%sete steak%"],
  },
  eventos: {
    id: "eventos",
    canonicalName: "Eventos",
    dbModality: "Evento",
    modality: "Evento",
    aliases: [
      "Eventos",
      "evento",
      "eventos",
      "casamento",
      "aniversario",
      "formatura",
      "corporativo",
      "festa",
      "open bar",
    ],
    sqlFilterPatterns: ["Evento", "%evento%", "%casamento%"],
  },
};

export function resolveBusinessUnit(input?: string | null): BusinessUnitResolution {
  if (!input || typeof input !== "string") {
    return {
      id: "geral",
      canonicalName: "Geral",
      dbModality: "Geral",
      modality: "Geral",
      matched: false,
      confidence: 0,
      aliases: ["geral", "todas", "global"],
      sqlFilterPatterns: ["%"],
    };
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
      ...BUSINESS_UNITS.steakhouse,
      matched: true,
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
      ...BUSINESS_UNITS.goat_botequim,
      matched: true,
      confidence: 0.95,
    };
  }

  if (
    clean.includes("evento") ||
    clean.includes("casamento") ||
    clean.includes("aniversario") ||
    clean.includes("formatura") ||
    clean.includes("corporativo")
  ) {
    return {
      ...BUSINESS_UNITS.eventos,
      matched: true,
      confidence: 0.9,
    };
  }

  return {
    id: "geral",
    canonicalName: input.trim(),
    dbModality: "Geral",
    modality: "Geral",
    matched: false,
    confidence: 0.3,
    aliases: [input.trim()],
    sqlFilterPatterns: [`%${input.trim()}%`],
  };
}

export function matchUnitName(input?: string | null): UnitMatchResult {
  const resolution = resolveBusinessUnit(input);
  return {
    matched: resolution.matched,
    unitName: resolution.canonicalName,
    modality: resolution.modality,
    confidence: resolution.confidence,
    canonicalName: resolution.canonicalName,
    dbModality: resolution.dbModality,
    businessUnitId: resolution.id,
  };
}
