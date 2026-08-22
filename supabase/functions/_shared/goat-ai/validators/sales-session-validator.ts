import { resolveBusinessUnit, CanonicalDatabaseModality } from "../matchers/unit-matcher.ts";
import {
  resolveDrinkMatch,
  resolveDrinkCommercialData,
  DrinkAlias,
  DrinkMatchType,
  normalizeDrinkAlias,
} from "../matchers/drink-matcher.ts";

export interface SalesSessionDraftItem {
  rawName?: string;
  name: string;
  quantity: number;
  unit_price?: number;
  unit_cost?: number;
  ingredient_cost?: number;
  drink_id?: string;
  matchedCatalogName?: string;
  isUnknown?: boolean;
  matchType?: DrinkMatchType;
}

export interface SalesSessionDraft {
  unit_name?: string;
  canonical_unit?: CanonicalDatabaseModality;
  date?: string;
  start_date?: string;
  end_date?: string;
  items?: SalesSessionDraftItem[];
  labor_value?: number | string;
  labor_quantity?: number | string;
  labor_names?: string;
  labor_details?: Array<{ data?: string; dia?: string; valor: number; qtdPessoas?: number; nomes?: string }>;
  reposicao_restaurante?: number | string;
  custos_restaurante_detalhes?: Array<{ descricao: string; valor: number }>;
  notes?: string;
  unknown_drinks?: string[];
  source_turn_ids?: string[];
  // Tolerated legacy fields (never mandatory):
  responsible?: string;
  total_amount?: number | string;
}

export interface NormalizedSalesSessionItem {
  rawName?: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  unit_cost: number;
  ingredient_cost?: number;
  drink_id?: string;
  isUnknown?: boolean;
  matchType?: DrinkMatchType;
}

export interface NormalizedSalesSession {
  unit_name: string;
  modality: "Goat Botequim" | "7Steakhouse";
  start_date: string;
  end_date?: string;
  items: NormalizedSalesSessionItem[];
  total_drinks: number;
  total_amount: number;
  total_cost: number;
  estimated_profit?: number;
  labor_value: number;
  labor_quantity: number;
  labor_names?: string;
  labor_details?: Array<{ data?: string; dia?: string; valor: number; qtdPessoas?: number; nomes?: string }>;
  reposicao_restaurante: number;
  custos_restaurante_detalhes?: Array<{ descricao: string; valor: number }>;
  notes?: string;
  unknown_drinks?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  normalized?: NormalizedSalesSession;
  warnings: string[];
  missingFields: string[];
  errors: string[];
}

/**
 * Normalizes currency values (R$ 1.234,56, "1234,56", 1234.56).
 */
export function normalizeCurrency(val: unknown): number {
  if (typeof val === "number") {
    return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  }
  if (!val || typeof val !== "string") return 0;

  const cleaned = val
    .replace(/r\$\s*/gi, "")
    .replace(/\s+/g, "")
    .trim();

  if (cleaned.includes(",") && cleaned.includes(".")) {
    const withoutDots = cleaned.replace(/\./g, "");
    const withDotDecimal = withoutDots.replace(",", ".");
    const num = parseFloat(withDotDecimal);
    return isNaN(num) ? 0 : Math.round(num * 100) / 100;
  }

  if (cleaned.includes(",")) {
    const withDot = cleaned.replace(",", ".");
    const num = parseFloat(withDot);
    return isNaN(num) ? 0 : Math.round(num * 100) / 100;
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Normalizes dates to YYYY-MM-DD format deterministically.
 */
export function normalizeDate(dateStr?: string, defaultYear = 2026): string {
  if (!dateStr || typeof dateStr !== "string") return "";
  const trimmed = dateStr.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    return `${dmyMatch[3]}-${month}-${day}`;
  }

  // DD/MM
  const dmMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (dmMatch) {
    const day = dmMatch[1].padStart(2, "0");
    const month = dmMatch[2].padStart(2, "0");
    return `${defaultYear}-${month}-${day}`;
  }

  return trimmed;
}

/**
 * Normalizes a drink name for fuzzy matching with the catalog.
 */
export function normalizeDrinkName(str: string): string {
  return normalizeDrinkAlias(str);
}

/**
 * Matches a drink against catalog items, extracting modality-specific prices & costs.
 */
export function resolveDrinkFromCatalog(
  name: string,
  catalog: any[],
  modality: "Goat Botequim" | "7Steakhouse" | string,
  aliases?: DrinkAlias[]
): {
  drinkId?: string;
  catalogName: string;
  unitPrice: number;
  unitCost: number;
  ingredientCost: number;
  matched: boolean;
  matchType?: DrinkMatchType;
} {
  const match = resolveDrinkMatch({
    inputName: name,
    businessUnit: modality,
    catalog,
    aliases: aliases || [],
    source: "validator",
  });

  if (match.matched && match.drink) {
    const comm = resolveDrinkCommercialData(match.drink, modality);
    return {
      drinkId: match.drinkId,
      catalogName: match.canonicalDrinkName || name.trim(),
      unitPrice: comm.unitPrice,
      unitCost: comm.unitCost,
      ingredientCost: comm.ingredientCost,
      matched: true,
      matchType: match.matchType,
    };
  }

  return {
    catalogName: name.trim(),
    unitPrice: 0,
    unitCost: 0,
    ingredientCost: 0,
    matched: false,
    matchType: "UNKNOWN",
  };
}

export type CanonicalDayKey =
  | "segunda"
  | "terca"
  | "quarta"
  | "quinta"
  | "sexta"
  | "sabado"
  | "domingo";

export interface DailyLaborDetail {
  dia: CanonicalDayKey;
  data?: string;
  valor: number;
  qtdPessoas?: number;
  nomes?: string;
}

export function normalizeDayKey(input: string): CanonicalDayKey | null {
  if (!input || typeof input !== "string") return null;
  const norm = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (/^(segunda(-feira)?|seg)$/i.test(norm)) return "segunda";
  if (/^(terca(-feira)?|ter)$/i.test(norm)) return "terca";
  if (/^(quarta(-feira)?|qua)$/i.test(norm)) return "quarta";
  if (/^(quinta(-feira)?|qui)$/i.test(norm)) return "quinta";
  if (/^(sexta(-feira)?|sex)$/i.test(norm)) return "sexta";
  if (/^(sabado|sab)$/i.test(norm)) return "sabado";
  if (/^(domingo|dom)$/i.test(norm)) return "domingo";

  return null;
}

export function getDayDisplayName(dayKey?: string): string {
  if (!dayKey) return "Dia";
  const canonical = normalizeDayKey(dayKey);
  switch (canonical) {
    case "segunda":
      return "Segunda-feira";
    case "terca":
      return "Terça-feira";
    case "quarta":
      return "Quarta-feira";
    case "quinta":
      return "Quinta-feira";
    case "sexta":
      return "Sexta-feira";
    case "sabado":
      return "Sábado";
    case "domingo":
      return "Domingo";
    default:
      return dayKey.charAt(0).toUpperCase() + dayKey.slice(1);
  }
}

export function extractDailyLaborItems(message: string): DailyLaborDetail[] {
  if (!message || typeof message !== "string") return [];

  const norm = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  // Word boundary for days and short abbreviations
  const dayRegex =
    /\b(segunda(?:-feira)?|seg|terca(?:-feira)?|ter|quarta(?:-feira)?|qua|quinta(?:-feira)?|qui|sexta(?:-feira)?|sex|sabado|sab|domingo|dom)\b/gi;

  const matches: { day: CanonicalDayKey; index: number; raw: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = dayRegex.exec(norm)) !== null) {
    const canonicalDay = normalizeDayKey(m[1]);
    if (canonicalDay) {
      matches.push({ day: canonicalDay, index: m.index, raw: m[1] });
    }
  }

  if (matches.length === 0) return [];

  const resultsMap = new Map<CanonicalDayKey, number>();

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : norm.length;
    const chunk = norm.slice(current.index, nextIndex);

    // Look for number in chunk after the day
    const numMatch = chunk.match(/(?:r\$\s*)?(\d+(?:[.,]\d{2})?|\d+)(?:\s*(?:reais|rs))?/i);
    if (numMatch) {
      const val = normalizeCurrency(numMatch[1]);
      if (val > 0) {
        resultsMap.set(current.day, val);
        continue;
      }
    }

    // Look for number in previous chunk (e.g. "400 no sabado")
    if (i === 0) {
      const prevChunk = norm.slice(0, current.index);
      const prevNumMatch = prevChunk.match(
        /(?:r\$\s*)?(\d+(?:[.,]\d{2})?|\d+)(?:\s*(?:reais|rs))?(?:\s*(?:no|na|de|em|para))?\s*$/i
      );
      if (prevNumMatch) {
        const val = normalizeCurrency(prevNumMatch[1]);
        if (val > 0) {
          resultsMap.set(current.day, val);
        }
      }
    }
  }

  const items: DailyLaborDetail[] = [];
  for (const [day, valor] of resultsMap.entries()) {
    items.push({ dia: day, valor });
  }

  return items;
}

/**
 * Extrai deterministicamente a intenção de lançamento de Mão de Obra e seu valor,
 * validando o contexto da 7 Steak House e seus aliases oficiais (Semanal e Diário).
 */
export function extractLaborIntent(
  message: string,
  contextUnit?: string
): {
  isLabor: boolean;
  amount?: number;
  isSteakhouse: boolean;
  laborAlias?: string;
  isDaily: boolean;
  dailyDetails: DailyLaborDetail[];
} {
  if (!message || typeof message !== "string") {
    return { isLabor: false, isSteakhouse: false, isDaily: false, dailyDetails: [] };
  }

  const norm = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  const isExplicitSteak =
    norm.includes("7 steak") ||
    norm.includes("7steak") ||
    norm.includes("steakhouse") ||
    norm.includes("sete steak") ||
    norm.includes("steak") ||
    (contextUnit
      ? contextUnit.includes("Steak") ||
        contextUnit.includes("7Steakhouse") ||
        contextUnit === "7Steakhouse"
      : false);

  // Check for explicit weekly keywords
  const isWeeklyKeyword =
    norm.includes("mao de obra semanal") ||
    norm.includes("mão de obra semanal") ||
    norm.includes("mao de obra da semana") ||
    norm.includes("mão de obra da semana") ||
    norm.includes("semanal") ||
    norm.includes("da semana");

  // Check for labor keywords
  const hasLaborKeyword =
    norm.includes("mao de obra") ||
    norm.includes("mão de obra") ||
    (isExplicitSteak && /\bmo\b/i.test(norm));

  const dailyItems = extractDailyLaborItems(message);
  const isDaily = dailyItems.length > 0 && !isWeeklyKeyword;

  let matchedAlias: string | undefined;
  if (norm.includes("mao de obra semanal")) matchedAlias = "mão de obra semanal";
  else if (norm.includes("mao de obra da semana")) matchedAlias = "mão de obra da semana";
  else if (norm.includes("mao de obra")) matchedAlias = "mão de obra";
  else if (isExplicitSteak && /\bmo\b/i.test(norm)) matchedAlias = "MO";
  else if (isDaily && isExplicitSteak) matchedAlias = "mão de obra por dia";

  if (!matchedAlias && !isDaily) {
    return { isLabor: false, isSteakhouse: Boolean(isExplicitSteak), isDaily: false, dailyDetails: [] };
  }

  if (isDaily && (hasLaborKeyword || isExplicitSteak)) {
    const sum = dailyItems.reduce((acc, d) => acc + d.valor, 0);
    return {
      isLabor: true,
      amount: sum > 0 ? sum : undefined,
      isSteakhouse: Boolean(isExplicitSteak),
      laborAlias: matchedAlias || "mão de obra por dia",
      isDaily: true,
      dailyDetails: dailyItems,
    };
  }

  // Extract amount for weekly (e.g. 500, 500 reais, R$ 500,00, 500,00)
  let amount: number | undefined;
  const laborNumMatch = message.match(
    /(?:m[aã]o\s+de\s+obra(?:\s+semanal|\s+da\s+semana)?|\bmo\b)(?:[\s:]*(?:de|no\s+valor\s+de|em)?[\s:]*)?(?:r\$\s*)?(\d+(?:[\.,]\d{2})?)/i
  );
  if (laborNumMatch) {
    amount = normalizeCurrency(laborNumMatch[1]);
  } else {
    const numMatch = message.match(/(?:r\$\s*)?(\d+(?:[\.,]\d{2})?)(?:\s*(?:reais|rs))?/i);
    if (numMatch) {
      amount = normalizeCurrency(numMatch[1]);
    }
  }

  return {
    isLabor: Boolean(matchedAlias),
    amount: amount && amount > 0 ? amount : undefined,
    isSteakhouse: Boolean(isExplicitSteak),
    laborAlias: matchedAlias || "mão de obra",
    isDaily: false,
    dailyDetails: [],
  };
}

/**
 * Deterministically parses sales session text (e.g. WhatsApp list of drinks with dates & unit).
 */
export function parseSalesSessionText(text: string): Partial<SalesSessionDraft> {
  if (!text || typeof text !== "string") return {};

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const draft: Partial<SalesSessionDraft> = {
    items: [],
  };

  // 1. Identify Business Unit
  const unitRes = resolveBusinessUnit(text);
  if (unitRes.matched) {
    draft.unit_name = unitRes.canonicalName;
    draft.canonical_unit = unitRes.dbModality;
  }

  // 2. Identify Date Range or Single Date
  const rangeMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\s*(?:a|ate|à|ate o dia|-)\s*(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/i);
  if (rangeMatch) {
    draft.start_date = normalizeDate(rangeMatch[1]);
    draft.end_date = normalizeDate(rangeMatch[2]);
  } else {
    const singleMatch = text.match(/\b(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\b/);
    if (singleMatch) {
      draft.start_date = normalizeDate(singleMatch[1]);
    }
  }

  // 3. Extract Labor Value (Mão de Obra / Mão de Obra Semanal / MO / Daily Labor)
  const laborIntent = extractLaborIntent(text, draft.unit_name || draft.canonical_unit);
  if (laborIntent.isLabor && laborIntent.amount) {
    draft.labor_value = laborIntent.amount;
    if (laborIntent.isDaily && laborIntent.dailyDetails.length > 0) {
      draft.labor_details = laborIntent.dailyDetails;
    } else {
      draft.labor_details = [];
    }
  }

  // 4. Extract Drink Items
  const items: SalesSessionDraftItem[] = [];
  const laborAliases = [
    "mao de obra semanal",
    "mão de obra semanal",
    "mao de obra da semana",
    "mão de obra da semana",
    "mao de obra",
    "mão de obra",
  ];
  const nonItemKeywords = [
    "steak house",
    "steakhouse",
    "botequim",
    "goat",
    "data",
    "periodo",
    "total",
    "fechamento",
    "relatorio",
    "vendas",
    "mao de obra",
    "mão de obra",
    "mao de obra semanal",
    "mão de obra semanal",
    "mao de obra da semana",
    "mão de obra da semana",
    "mo",
  ];

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    const normLine = line
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (nonItemKeywords.some((kw) => {
      const normKw = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      return normLine === normKw || normLine.startsWith(normKw + ":") || normLine.startsWith(normKw + " ") || normLine.startsWith(normKw + "-");
    })) {
      continue;
    }

    if (extractDailyLaborItems(line).length > 0 && (normLine.includes("mao") || /\bmo\b/i.test(normLine) || draft.canonical_unit === "7Steakhouse" || draft.unit_name?.includes("Steak"))) {
      continue;
    }

    if (resolveBusinessUnit(line).matched) {
      continue;
    }

    if (/^\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?(?:\s*(?:a|ate|à|-)\s*\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)?$/i.test(line)) {
      continue;
    }

    // Format 1: "CAIPIRINHA 2" or "FITZ GERALD 16" or "CAIPIRINHA: 2" or "CAIPIRINHA - 2"
    const endQtyMatch = line.match(/^([a-zA-ZÀ-ÿ\s\(\)\'\-]+?)[\s:\-]+(\d+)(?:\s*(?:un|unidades?|doses?))?$/);
    if (endQtyMatch) {
      const name = endQtyMatch[1].trim();
      const qty = parseInt(endQtyMatch[2], 10);
      const normName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const isLaborName = laborAliases.some((a) => normName.includes(a.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())) || /\bmo\b/i.test(normName);
      if (name.length > 1 && qty > 0 && !resolveBusinessUnit(name).matched && !isLaborName) {
        items.push({ name, quantity: qty });
        continue;
      }
    }

    // Format 2: "16x FITZ GERALD" or "2 CAIPIRINHA" or "16 - FITZ GERALD"
    const startQtyMatch = line.match(/^(\d+)(?:x|\s*x|\s*\-|\s+)([a-zA-ZÀ-ÿ\s\(\)\'\-]+)$/i);
    if (startQtyMatch) {
      const qty = parseInt(startQtyMatch[1], 10);
      const name = startQtyMatch[2].trim();
      const normName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const isLaborName = laborAliases.some((a) => normName.includes(a.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())) || /\bmo\b/i.test(normName);
      if (name.length > 1 && qty > 0 && !resolveBusinessUnit(name).matched && !isLaborName) {
        items.push({ name, quantity: qty });
        continue;
      }
    }
  }

  if (items.length > 0) {
    draft.items = items;
  }

  return draft;
}

/**
 * Deterministically normalizes and validates a sales session draft using the REAL database schema.
 */
export function validateSalesSessionDraft(
  draft: SalesSessionDraft,
  drinksCatalog?: any[],
  drinkAliases?: DrinkAlias[]
): ValidationResult {
  const missingFields: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const unknownDrinks: string[] = [];

  // 1. Mandatory Field: Unit Name / Modality
  if (!draft.unit_name && !draft.canonical_unit) {
    missingFields.push("unit_name");
  } else {
    const unitRes = resolveBusinessUnit(draft.unit_name || draft.canonical_unit);
    if (!unitRes.matched && !draft.canonical_unit) {
      missingFields.push("unit_name");
    }
  }

  const unitRes = resolveBusinessUnit(draft.unit_name || draft.canonical_unit);
  const dbModality: "Goat Botequim" | "7Steakhouse" =
    unitRes.dbModality === "7Steakhouse" || draft.canonical_unit === "7Steakhouse"
      ? "7Steakhouse"
      : "Goat Botequim";

  const unitName = dbModality === "7Steakhouse" ? "7 Steak House" : "Goat Botequim";

  // 2. Mandatory Field: Start Date / Operation Date
  const rawDate = draft.start_date || draft.date;
  const normalizedDate = normalizeDate(rawDate);
  if (!normalizedDate || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    missingFields.push("start_date");
  }

  // 3. Mandatory Field: Items (Drinks Sold) or Labor Value
  const rawItems = draft.items || [];
  const hasLabor = normalizeCurrency(draft.labor_value) > 0;
  if ((!Array.isArray(rawItems) || rawItems.length === 0) && !hasLabor) {
    missingFields.push("items");
  }

  // 4. Normalise Items with Catalog Resolution
  const normalizedItems: NormalizedSalesSessionItem[] = [];
  let totalAmount = 0;
  let totalCost = 0;
  let totalDrinks = 0;

  for (const it of rawItems) {
    const qty = Number(it.quantity) || 1;
    if (qty <= 0) continue;

    const rawName = (it.rawName || it.name || "").trim();
    if (!rawName) continue;

    totalDrinks += qty;

    if (drinksCatalog && drinksCatalog.length > 0) {
      let match = resolveDrinkFromCatalog(rawName, drinksCatalog, dbModality, drinkAliases);
      if (!match.matched && it.name && it.name !== rawName) {
        match = resolveDrinkFromCatalog(it.name, drinksCatalog, dbModality, drinkAliases);
      }

      const unitPrice = it.unit_price != null && it.unit_price > 0 ? normalizeCurrency(it.unit_price) : match.unitPrice;
      const unitCost = it.unit_cost != null && it.unit_cost > 0 ? normalizeCurrency(it.unit_cost) : match.unitCost;
      const ingredientCost = it.ingredient_cost != null && it.ingredient_cost > 0 ? normalizeCurrency(it.ingredient_cost) : match.ingredientCost;
      const totalPrice = Math.round(qty * unitPrice * 100) / 100;

      if (!match.matched) {
        unknownDrinks.push(rawName);
      }

      totalAmount += totalPrice;
      totalCost += Math.round(qty * unitCost * 100) / 100;

      normalizedItems.push({
        rawName,
        name: match.matched ? match.catalogName : (it.name || rawName),
        quantity: qty,
        unit_price: unitPrice,
        total_price: totalPrice,
        unit_cost: unitCost,
        ingredient_cost: ingredientCost,
        drink_id: match.drinkId || it.drink_id,
        isUnknown: !match.matched,
        matchType: match.matchType,
      });
    } else {
      const unitPrice = normalizeCurrency(it.unit_price);
      const unitCost = normalizeCurrency(it.unit_cost);
      const ingredientCost = normalizeCurrency(it.ingredient_cost);
      const totalPrice = Math.round(qty * unitPrice * 100) / 100;

      totalAmount += totalPrice;
      totalCost += Math.round(qty * unitCost * 100) / 100;

      normalizedItems.push({
        rawName,
        name: it.name || rawName,
        quantity: qty,
        unit_price: unitPrice,
        total_price: totalPrice,
        unit_cost: unitCost,
        ingredient_cost: ingredientCost,
        drink_id: it.drink_id,
        isUnknown: false,
      });
    }
  }

  if (normalizedItems.length === 0 && !missingFields.includes("items") && !hasLabor) {
    missingFields.push("items");
  }

  if (unknownDrinks.length > 0) {
    warnings.push(`Drink(s) não localizados no cardápio oficial: ${unknownDrinks.join(", ")}.`);
  }

  // 5. Optional Real Fields Normalization
  let laborValue = normalizeCurrency(draft.labor_value);
  const laborQuantity = Number(draft.labor_quantity) || (draft.labor_names ? 1 : 0);
  const reposicaoRestaurante = normalizeCurrency(draft.reposicao_restaurante);

  let laborDetails = draft.labor_details ? [...draft.labor_details] : [];

  if (dbModality === "7Steakhouse") {
    const hasValidDetails =
      Array.isArray(laborDetails) &&
      laborDetails.length > 0 &&
      laborDetails.some((d: any) => normalizeCurrency(d.valor) > 0);

    if (hasValidDetails) {
      // Deduplicate days and normalize canonical day keys
      const dayMap = new Map<string, any>();
      for (const d of laborDetails) {
        const canonicalKey = normalizeDayKey(d.dia) || d.dia || "dia";
        const val = normalizeCurrency(d.valor);
        dayMap.set(canonicalKey, {
          ...d,
          dia: canonicalKey,
          valor: val,
        });
      }
      laborDetails = Array.from(dayMap.values());
      // labor_value MUST always be recalculated as sum of daily details in daily mode
      laborValue = Math.round(
        laborDetails.reduce((acc, d) => acc + normalizeCurrency(d.valor), 0) * 100
      ) / 100;
    } else {
      // Weekly mode: clear labor_details to prevent inconsistent state
      laborDetails = [];
    }
  }

  const isValid = missingFields.length === 0 && errors.length === 0;

  const normalized: NormalizedSalesSession | undefined = isValid
    ? {
        unit_name: unitName,
        modality: dbModality,
        start_date: normalizedDate,
        end_date: draft.end_date ? normalizeDate(draft.end_date) : undefined,
        items: normalizedItems,
        total_drinks: totalDrinks,
        total_amount: Math.round(totalAmount * 100) / 100,
        total_cost: Math.round(totalCost * 100) / 100,
        estimated_profit: dbModality === "Goat Botequim"
          ? Math.round(((totalAmount - totalCost) * 0.6 - laborValue) * 100) / 100
          : Math.round((totalAmount - totalCost - laborValue - reposicaoRestaurante) * 100) / 100,
        labor_value: laborValue,
        labor_quantity: laborQuantity,
        labor_names: draft.labor_names?.trim() || undefined,
        labor_details: laborDetails,
        reposicao_restaurante: reposicaoRestaurante,
        custos_restaurante_detalhes: draft.custos_restaurante_detalhes || [],
        notes: draft.notes,
        unknown_drinks: unknownDrinks.length > 0 ? unknownDrinks : undefined,
      }
    : undefined;

  return {
    isValid,
    normalized,
    warnings,
    missingFields,
    errors,
  };
}

/**
 * Backward-compatibility alias for validateSalesSessionDraft.
 */
export function validateSalesSessionData(
  raw: any,
  drinksCatalog?: any[]
): ValidationResult {
  return validateSalesSessionDraft(raw, drinksCatalog);
}

/**
 * Checks in Supabase database if a session for this modality & date already exists.
 */
export async function checkDuplicateSalesSession(
  supabaseAdmin: any,
  modality: string,
  date: string
): Promise<{ isDuplicate: boolean; existingSessionId?: string; existingTotal?: number }> {
  try {
    const { data: existing, error } = await supabaseAdmin
      .from("financial_sessions")
      .select("id, date, modality, labor_names, financial_session_items(quantity, unit_price)")
      .eq("modality", modality)
      .eq("date", date)
      .limit(1)
      .maybeSingle();

    if (error || !existing) {
      return { isDuplicate: false };
    }

    const items = existing.financial_session_items || [];
    const total = items.reduce(
      (sum: number, it: any) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
      0
    );

    return {
      isDuplicate: true,
      existingSessionId: existing.id,
      existingTotal: total,
    };
  } catch {
    return { isDuplicate: false };
  }
}

/**
 * Formats a clean, professional preview message for WhatsApp based on the REAL schema.
 */
export function formatSalesSessionWhatsAppPreview(
  session: NormalizedSalesSession,
  warnings: string[] = [],
  isDuplicate = false
): string {
  const formatBRL = (val: number) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatDateBR = (iso: string) => iso.split("-").reverse().join("/");
  const isSteak = session.modality === "7Steakhouse";

  const periodText = session.end_date
    ? `${formatDateBR(session.start_date)} a ${formatDateBR(session.end_date)}`
    : formatDateBR(session.start_date);

  const lines: string[] = [];
  lines.push("📋 *Sessão de Vendas Identificada*");
  lines.push("");
  lines.push(`• *Unidade:* ${session.unit_name}`);
  lines.push(`• *Período / Data:* ${periodText}${isSteak ? " (Semanal)" : ""}`);
  lines.push(`• *Total de Drinks:* ${session.total_drinks} drinks`);

  if (session.total_amount > 0) {
    lines.push(`• *Faturamento Estimado:* ${formatBRL(session.total_amount)}`);
  }

  if (session.labor_value > 0) {
    const laborLabel = isSteak ? "Mão de Obra Semanal" : "Mão de Obra";
    lines.push(`• *${laborLabel}:* ${formatBRL(session.labor_value)}${session.labor_names ? ` (${session.labor_names})` : ""}`);

    if (isSteak && session.labor_details && session.labor_details.length > 0) {
      const validDays = session.labor_details.filter((d: any) => normalizeCurrency(d.valor) > 0);
      if (validDays.length > 0) {
        lines.push(`  *Detalhamento Diário:*`);
        validDays.forEach((d: any) => {
          const dayName = getDayDisplayName(d.dia);
          lines.push(`    - ${dayName}: ${formatBRL(normalizeCurrency(d.valor))}${d.nomes ? ` (${d.nomes})` : ""}`);
        });
      }
    }
  }

  if (session.reposicao_restaurante > 0) {
    lines.push(`• *Reposição Restaurante:* ${formatBRL(session.reposicao_restaurante)}`);
  }

  if (session.items.length > 0) {
    lines.push("");
    lines.push(`📦 *Drinks Lançados (${session.items.length} itens):*`);
    session.items.forEach((it) => {
      const priceText = it.unit_price > 0 ? ` (${formatBRL(it.unit_price)} un)` : "";
      lines.push(`  • ${it.quantity}x ${it.name}${priceText}`);
    });
  }

  if (session.unknown_drinks && session.unknown_drinks.length > 0) {
    lines.push("");
    lines.push(`⚠️ *Drinks não catalogados (preço a confirmar):* ${session.unknown_drinks.join(", ")}`);
  }

  if (isDuplicate) {
    lines.push("");
    lines.push("⚠️ *Atenção:* Já existe uma sessão registrada para esta unidade e data.");
    lines.push("*Deseja confirmar e lançar mesmo assim?*");
  } else {
    lines.push("");
    lines.push("*Posso realizar o lançamento da sessão de vendas?*");
  }

  return lines.join("\n");
}

