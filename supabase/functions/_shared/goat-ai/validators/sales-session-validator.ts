import { resolveBusinessUnit, CanonicalDatabaseModality } from "../matchers/unit-matcher.ts";

export interface SalesSessionDraftItem {
  name: string;
  quantity: number;
  unit_price?: number;
  unit_cost?: number;
  ingredient_cost?: number;
  drink_id?: string;
  matchedCatalogName?: string;
  isUnknown?: boolean;
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
  labor_details?: Array<{ data: string; valor: number; qtdPessoas: number; nomes?: string }>;
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
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  unit_cost: number;
  ingredient_cost?: number;
  drink_id?: string;
  isUnknown?: boolean;
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
  labor_details?: Array<{ data: string; valor: number; qtdPessoas: number; nomes?: string }>;
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
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Matches a drink against catalog items, extracting modality-specific prices & costs.
 */
export function resolveDrinkFromCatalog(
  name: string,
  catalog: any[],
  modality: "Goat Botequim" | "7Steakhouse"
): {
  drinkId?: string;
  catalogName: string;
  unitPrice: number;
  unitCost: number;
  ingredientCost: number;
  matched: boolean;
} {
  const normInput = normalizeDrinkName(name);
  if (!normInput || !catalog || catalog.length === 0) {
    return {
      catalogName: name.trim(),
      unitPrice: 0,
      unitCost: 0,
      ingredientCost: 0,
      matched: false,
    };
  }

  const isSteak = modality === "7Steakhouse";

  for (const d of catalog) {
    const drinkName = d.nome || d.name || "";
    const normDrink = normalizeDrinkName(drinkName);

    if (normDrink === normInput || normDrink.includes(normInput) || normInput.includes(normDrink)) {
      const modConfig = d.modality_config || d.modalityConfig || {};
      const config = isSteak ? (modConfig.steakhouse || {}) : (modConfig.goatbotequim || {});

      const unitPrice = Number(config.price ?? d.preco_venda ?? d.precoVenda ?? 0);
      const unitCost = Number(config.cost ?? d.custo_unitario ?? d.custoUnitario ?? 0);
      const ingredientCost = isSteak
        ? Number(modConfig.evento?.cost ?? d.custo_unitario ?? d.custoUnitario ?? unitCost)
        : unitCost;

      return {
        drinkId: d.id,
        catalogName: drinkName,
        unitPrice,
        unitCost,
        ingredientCost,
        matched: true,
      };
    }
  }

  return {
    catalogName: name.trim(),
    unitPrice: 0,
    unitCost: 0,
    ingredientCost: 0,
    matched: false,
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

  // 3. Extract Drink Items
  const items: SalesSessionDraftItem[] = [];
  const nonItemKeywords = ["steak house", "steakhouse", "botequim", "goat", "data", "periodo", "total", "fechamento", "relatorio", "vendas"];

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (nonItemKeywords.some((kw) => lowerLine === kw || lowerLine.startsWith(kw + ":"))) {
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
      if (name.length > 1 && qty > 0 && !resolveBusinessUnit(name).matched) {
        items.push({ name, quantity: qty });
        continue;
      }
    }

    // Format 2: "16x FITZ GERALD" or "2 CAIPIRINHA" or "16 - FITZ GERALD"
    const startQtyMatch = line.match(/^(\d+)(?:x|\s*x|\s*\-|\s+)([a-zA-ZÀ-ÿ\s\(\)\'\-]+)$/i);
    if (startQtyMatch) {
      const qty = parseInt(startQtyMatch[1], 10);
      const name = startQtyMatch[2].trim();
      if (name.length > 1 && qty > 0 && !resolveBusinessUnit(name).matched) {
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
  drinksCatalog?: any[]
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

  // 3. Mandatory Field: Items (Drinks Sold)
  const rawItems = draft.items || [];
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
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

    const rawName = (it.name || "").trim();
    if (!rawName) continue;

    totalDrinks += qty;

    if (drinksCatalog && drinksCatalog.length > 0) {
      const match = resolveDrinkFromCatalog(rawName, drinksCatalog, dbModality);
      const unitPrice = it.unit_price != null ? normalizeCurrency(it.unit_price) : match.unitPrice;
      const unitCost = it.unit_cost != null ? normalizeCurrency(it.unit_cost) : match.unitCost;
      const ingredientCost = it.ingredient_cost != null ? normalizeCurrency(it.ingredient_cost) : match.ingredientCost;
      const totalPrice = Math.round(qty * unitPrice * 100) / 100;

      if (!match.matched && it.unit_price == null) {
        unknownDrinks.push(rawName);
      }

      totalAmount += totalPrice;
      totalCost += Math.round(qty * unitCost * 100) / 100;

      normalizedItems.push({
        name: match.matched ? match.catalogName : rawName,
        quantity: qty,
        unit_price: unitPrice,
        total_price: totalPrice,
        unit_cost: unitCost,
        ingredient_cost: ingredientCost,
        drink_id: match.drinkId || it.drink_id,
        isUnknown: !match.matched,
      });
    } else {
      const unitPrice = normalizeCurrency(it.unit_price);
      const unitCost = normalizeCurrency(it.unit_cost);
      const ingredientCost = normalizeCurrency(it.ingredient_cost);
      const totalPrice = Math.round(qty * unitPrice * 100) / 100;

      totalAmount += totalPrice;
      totalCost += Math.round(qty * unitCost * 100) / 100;

      normalizedItems.push({
        name: rawName,
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

  if (normalizedItems.length === 0 && !missingFields.includes("items")) {
    missingFields.push("items");
  }

  if (unknownDrinks.length > 0) {
    warnings.push(`Drink(s) não localizados no cardápio oficial: ${unknownDrinks.join(", ")}.`);
  }

  // 5. Optional Real Fields Normalization
  const laborValue = normalizeCurrency(draft.labor_value);
  const laborQuantity = Number(draft.labor_quantity) || (draft.labor_names ? 1 : 0);
  const reposicaoRestaurante = normalizeCurrency(draft.reposicao_restaurante);

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
        labor_details: draft.labor_details || [],
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
    lines.push(`• *Mão de Obra:* ${formatBRL(session.labor_value)}${session.labor_names ? ` (${session.labor_names})` : ""}`);
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

