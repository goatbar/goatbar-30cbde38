import { resolveBusinessUnit, BusinessUnitId, CanonicalDatabaseModality } from "./unit-matcher.ts";

export interface DrinkAlias {
  id: string;
  alias: string;
  normalized_alias: string;
  drink_id: string;
  business_unit?: string | null; // Canonical BusinessUnitId: 'goat_botequim' | 'steakhouse' | 'eventos' | null
  source: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  active: boolean;
}

export interface DrinkAliasHistory {
  id: string;
  alias_id?: string | null;
  alias: string;
  normalized_alias: string;
  old_drink_id?: string | null;
  new_drink_id: string;
  business_unit?: string | null;
  action: "CREATED" | "UPDATED" | "DEACTIVATED" | "CONFLICT_REJECTED";
  source: string;
  changed_by?: string | null;
  performer_name?: string | null;
  details?: Record<string, any>;
  created_at: string;
}

export type DrinkMatchType =
  | "UNIT_ALIAS"
  | "GLOBAL_ALIAS"
  | "CANONICAL_EXACT"
  | "CANONICAL_NORMALIZED"
  | "OFFICIAL_ALIAS"
  | "FUZZY"
  | "UNKNOWN";

export interface DrinkMatchResult {
  rawName: string;
  normalizedName: string;
  drinkId?: string;
  canonicalDrinkName?: string;
  matched: boolean;
  matchType: DrinkMatchType;
  confidence: number;
  businessUnit?: string | null;
  isUnknown: boolean;
  drink?: any;
}

export interface DrinkCommercialData {
  unitPrice: number;
  unitCost: number;
  ingredientCost: number;
}

/**
 * Canonical Drink Alias Normalizer.
 * - lowercases;
 * - trims;
 * - removes accents (NFD);
 * - normalizes punctuation by replacing with space (avoiding word collision);
 * - collapses multiple spaces;
 * - preserves semantic info (flavors, doses, modifiers).
 */
export function normalizeDrinkAlias(input?: string | null): string {
  if (!input || typeof input !== "string") return "";
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolves a canonical business unit ID ('goat_botequim', 'steakhouse', 'eventos', or null for global)
 */
export function toCanonicalBusinessUnitId(unit?: string | null): string | null {
  if (!unit || typeof unit !== "string") return null;
  const res = resolveBusinessUnit(unit);
  if (!res.matched || res.id === "geral") return null;
  return res.id;
}

/**
 * Resolves commercial pricing and costs for a given drink and business unit.
 * Separates financial data resolution from drink identity resolution.
 */
export function resolveDrinkCommercialData(
  drink: any,
  businessUnit?: string | null
): DrinkCommercialData {
  if (!drink) {
    return { unitPrice: 0, unitCost: 0, ingredientCost: 0 };
  }

  const unitRes = resolveBusinessUnit(businessUnit);
  const isSteak = unitRes.id === "steakhouse" || unitRes.dbModality === "7Steakhouse";
  const modConfig = drink.modality_config || drink.modalityConfig || {};
  const config = isSteak ? (modConfig.steakhouse || {}) : (modConfig.goatbotequim || {});

  const unitPrice = Number(config.price ?? drink.preco_venda ?? drink.precoVenda ?? 0);
  const unitCost = Number(config.cost ?? drink.custo_unitario ?? drink.custoUnitario ?? 0);
  const ingredientCost = isSteak
    ? Number(modConfig.evento?.cost ?? drink.custo_unitario ?? drink.custoUnitario ?? unitCost)
    : unitCost;

  return { unitPrice, unitCost, ingredientCost };
}

/**
 * Deterministic Drink Resolution Engine.
 * Hierarchy:
 * 1. Unit-specific persisted alias (business_unit matches)
 * 2. Global persisted alias (business_unit is null/global)
 * 3. Exact canonical drink name
 * 4. Normalized canonical drink name
 * 5. Official aliases in catalog config
 * 6. Safe fuzzy match (high confidence >= 0.85, without auto-persisting)
 * 7. Unresolved (UNKNOWN)
 */
export function resolveDrinkMatch({
  inputName,
  businessUnit,
  catalog,
  aliases = [],
  source = "chat",
}: {
  inputName: string;
  businessUnit?: string | null;
  catalog: any[];
  aliases?: DrinkAlias[];
  source?: string;
}): DrinkMatchResult {
  const rawName = (inputName || "").trim();
  const normalizedName = normalizeDrinkAlias(rawName);
  const canonicalUnitId = toCanonicalBusinessUnitId(businessUnit);

  console.log(
    `[GOAT-AI][DRINK_MATCH][LOOKUP] rawName="${rawName}" normalizedName="${normalizedName}" businessUnit="${canonicalUnitId || "global"}" source="${source}"`
  );

  if (!rawName || !normalizedName) {
    console.log(
      `[GOAT-AI][DRINK_MATCH][UNRESOLVED] rawName="${rawName}" normalizedName="${normalizedName}" businessUnit="${canonicalUnitId || "global"}"`
    );
    return {
      rawName,
      normalizedName,
      matched: false,
      matchType: "UNKNOWN",
      confidence: 0,
      businessUnit: canonicalUnitId,
      isUnknown: true,
    };
  }

  // Helper to check if drink is active for canonical unit
  const isDrinkActiveForUnit = (d: any): boolean => {
    if (!canonicalUnitId || canonicalUnitId === "geral") return true;
    const modConfig = d.modality_config || d.modalityConfig;
    if (!modConfig) return true;
    const unitConfig =
      canonicalUnitId === "steakhouse"
        ? modConfig.steakhouse
        : canonicalUnitId === "goat_botequim"
        ? modConfig.goatbotequim
        : modConfig.evento;

    if (!unitConfig) return false;
    if (unitConfig.active === false) return false;
    return true;
  };

  const effectiveCatalog = canonicalUnitId && canonicalUnitId !== "geral"
    ? catalog.filter(isDrinkActiveForUnit)
    : catalog;

  // Helper to find a drink in catalog by id
  const findDrinkById = (id: string) => catalog.find((d) => String(d.id) === String(id));

  // 1. Unit-specific persisted alias
  if (canonicalUnitId && aliases.length > 0) {
    const unitAlias = aliases.find(
      (a) => a.active !== false && a.normalized_alias === normalizedName && a.business_unit === canonicalUnitId
    );
    if (unitAlias) {
      const drink = findDrinkById(unitAlias.drink_id);
      if (drink) {
        console.log(
          `[GOAT-AI][DRINK_MATCH][RESOLVED] alias="${rawName}" drinkId="${drink.id}" drinkName="${drink.nome}" matchType="UNIT_ALIAS"`
        );
        return {
          rawName,
          normalizedName,
          drinkId: drink.id,
          canonicalDrinkName: drink.nome,
          matched: true,
          matchType: "UNIT_ALIAS",
          confidence: 1.0,
          businessUnit: canonicalUnitId,
          isUnknown: false,
          drink,
        };
      }
    }
  }

  // 2. Global persisted alias
  if (aliases.length > 0) {
    const globalAlias = aliases.find(
      (a) => a.active !== false && a.normalized_alias === normalizedName && (!a.business_unit || a.business_unit === "geral" || a.business_unit === "global")
    );
    if (globalAlias) {
      const drink = findDrinkById(globalAlias.drink_id);
      if (drink) {
        console.log(
          `[GOAT-AI][DRINK_MATCH][RESOLVED] alias="${rawName}" drinkId="${drink.id}" drinkName="${drink.nome}" matchType="GLOBAL_ALIAS"`
        );
        return {
          rawName,
          normalizedName,
          drinkId: drink.id,
          canonicalDrinkName: drink.nome,
          matched: true,
          matchType: "GLOBAL_ALIAS",
          confidence: 1.0,
          businessUnit: canonicalUnitId,
          isUnknown: false,
          drink,
        };
      }
    }
  }

  // 3. Exact Canonical Drink Name
  const exactDrink = effectiveCatalog.find(
    (d) => (d.nome || d.name || "").trim().toLowerCase() === rawName.toLowerCase()
  );
  if (exactDrink) {
    console.log(
      `[GOAT-AI][DRINK_MATCH][RESOLVED] alias="${rawName}" drinkId="${exactDrink.id}" drinkName="${exactDrink.nome}" matchType="CANONICAL_EXACT"`
    );
    return {
      rawName,
      normalizedName,
      drinkId: exactDrink.id,
      canonicalDrinkName: exactDrink.nome,
      matched: true,
      matchType: "CANONICAL_EXACT",
      confidence: 1.0,
      businessUnit: canonicalUnitId,
      isUnknown: false,
      drink: exactDrink,
    };
  }

  // 4. Normalized Canonical Drink Name (with or without whitespace)
  const normDrink = effectiveCatalog.find((d) => {
    const dn = normalizeDrinkAlias(d.nome || d.name || "");
    return dn === normalizedName || dn.replace(/\s+/g, "") === normalizedName.replace(/\s+/g, "");
  });
  if (normDrink) {
    console.log(
      `[GOAT-AI][DRINK_MATCH][RESOLVED] alias="${rawName}" drinkId="${normDrink.id}" drinkName="${normDrink.nome}" matchType="CANONICAL_NORMALIZED"`
    );
    return {
      rawName,
      normalizedName,
      drinkId: normDrink.id,
      canonicalDrinkName: normDrink.nome,
      matched: true,
      matchType: "CANONICAL_NORMALIZED",
      confidence: 0.99,
      businessUnit: canonicalUnitId,
      isUnknown: false,
      drink: normDrink,
    };
  }

  // 5. Official Aliases registered in catalog metadata
  for (const d of effectiveCatalog) {
    const modConfig = d.modality_config || d.modalityConfig || {};
    const officialAliases: string[] = Array.isArray(modConfig.aliases)
      ? modConfig.aliases
      : Array.isArray(d.aliases)
      ? d.aliases
      : [];

    const matchedOfficial = officialAliases.some((off) => {
      const normOff = normalizeDrinkAlias(off);
      return normOff === normalizedName || normOff.replace(/\s+/g, "") === normalizedName.replace(/\s+/g, "");
    });

    if (matchedOfficial) {
      console.log(
        `[GOAT-AI][DRINK_MATCH][RESOLVED] alias="${rawName}" drinkId="${d.id}" drinkName="${d.nome}" matchType="OFFICIAL_ALIAS"`
      );
      return {
        rawName,
        normalizedName,
        drinkId: d.id,
        canonicalDrinkName: d.nome,
        matched: true,
        matchType: "OFFICIAL_ALIAS",
        confidence: 0.95,
        businessUnit: canonicalUnitId,
        isUnknown: false,
        drink: d,
      };
    }
  }

  // 6. Substring & Safe Fuzzy Match (High confidence >= 0.85, without auto-persisting)
  let bestFuzzy: any = null;
  let bestScore = 0;

  const queryWords = normalizedName.split(" ").filter((w) => w.length > 1);
  const spacelessQuery = normalizedName.replace(/\s+/g, "");

  for (const d of effectiveCatalog) {
    const dName = normalizeDrinkAlias(d.nome || d.name || "");
    const dWords = dName.split(" ").filter((w) => w.length > 1);
    const spacelessDrink = dName.replace(/\s+/g, "");

    // Exact spaceless match
    if (spacelessDrink === spacelessQuery) {
      bestScore = 0.98;
      bestFuzzy = d;
      break;
    }

    // Substring inclusion check
    if (dName.includes(normalizedName) || normalizedName.includes(dName) || spacelessDrink.includes(spacelessQuery) || spacelessQuery.includes(spacelessDrink)) {
      const score = 0.88;
      if (score > bestScore) {
        bestScore = score;
        bestFuzzy = d;
      }
      continue;
    }

    if (queryWords.length > 0 && dWords.length > 0) {
      const matches = dWords.filter((w) => queryWords.includes(w));
      const score = (matches.length * 2) / (dWords.length + queryWords.length);
      if (score >= 0.85 && score > bestScore) {
        bestScore = score;
        bestFuzzy = d;
      }
    }
  }

  if (bestFuzzy && bestScore >= 0.85) {
    console.log(
      `[GOAT-AI][DRINK_MATCH][RESOLVED] alias="${rawName}" drinkId="${bestFuzzy.id}" drinkName="${bestFuzzy.nome}" matchType="FUZZY"`
    );
    return {
      rawName,
      normalizedName,
      drinkId: bestFuzzy.id,
      canonicalDrinkName: bestFuzzy.nome,
      matched: true,
      matchType: "FUZZY",
      confidence: Math.round(bestScore * 100) / 100,
      businessUnit: canonicalUnitId,
      isUnknown: false,
      drink: bestFuzzy,
    };
  }

  // 7. Unresolved
  console.log(
    `[GOAT-AI][DRINK_MATCH][UNRESOLVED] rawName="${rawName}" normalizedName="${normalizedName}" businessUnit="${canonicalUnitId || "global"}"`
  );
  return {
    rawName,
    normalizedName,
    matched: false,
    matchType: "UNKNOWN",
    confidence: 0,
    businessUnit: canonicalUnitId,
    isUnknown: true,
  };
}

/**
 * Performance optimization: loads catalog and active aliases in 2 database queries.
 */
export async function loadDrinkCatalogAndAliases(
  supabaseAdmin: any,
  businessUnit?: string | null
): Promise<{ catalog: any[]; aliases: DrinkAlias[] }> {
  if (!supabaseAdmin?.from) {
    return { catalog: [], aliases: [] };
  }

  let catalog: any[] = [];
  let aliases: DrinkAlias[] = [];

  try {
    const { data: dbDrinks } = await supabaseAdmin
      .from("drinks")
      .select("id, nome, custo_unitario, modality_config, imagem, categoria");
    if (dbDrinks) catalog = dbDrinks;
  } catch (err) {
    console.warn("[loadDrinkCatalogAndAliases] Error loading drinks:", err);
  }

  try {
    const canonicalUnit = toCanonicalBusinessUnitId(businessUnit);
    let aliasQuery = supabaseAdmin
      .from("drink_aliases")
      .select("*")
      .eq("active", true);

    if (canonicalUnit) {
      aliasQuery = aliasQuery.or(`business_unit.eq.${canonicalUnit},business_unit.is.null`);
    }

    const { data: dbAliases } = await aliasQuery;
    if (dbAliases) aliases = dbAliases;
  } catch (err) {
    console.warn("[loadDrinkCatalogAndAliases] Error loading drink_aliases:", err);
  }

  return { catalog, aliases };
}

/**
 * Resolves a batch of drinks in memory using preloaded catalog and aliases.
 */
export function resolveDrinkBatch({
  items,
  businessUnit,
  catalog,
  aliases = [],
  source = "batch",
}: {
  items: Array<{ name: string; quantity: number; unit_price?: number; unit_cost?: number; ingredient_cost?: number; drink_id?: string }>;
  businessUnit?: string | null;
  catalog: any[];
  aliases?: DrinkAlias[];
  source?: string;
}) {
  return items.map((it) => {
    const match = resolveDrinkMatch({
      inputName: it.name,
      businessUnit,
      catalog,
      aliases,
      source,
    });

    const comm = match.matched && match.drink
      ? resolveDrinkCommercialData(match.drink, businessUnit)
      : { unitPrice: 0, unitCost: 0, ingredientCost: 0 };

    const unitPrice = it.unit_price != null && it.unit_price > 0 ? it.unit_price : comm.unitPrice;
    const unitCost = it.unit_cost != null && it.unit_cost > 0 ? it.unit_cost : comm.unitCost;
    const ingredientCost = it.ingredient_cost != null && it.ingredient_cost > 0 ? it.ingredient_cost : comm.ingredientCost;

    return {
      rawName: it.name,
      name: match.matched && match.canonicalDrinkName ? match.canonicalDrinkName : it.name,
      quantity: it.quantity,
      unit_price: unitPrice,
      total_price: Math.round(it.quantity * unitPrice * 100) / 100,
      unit_cost: unitCost,
      ingredient_cost: ingredientCost,
      drink_id: match.drinkId || it.drink_id,
      isUnknown: !match.matched,
      matchType: match.matchType,
      confidence: match.confidence,
    };
  });
}

export interface LearnDrinkAliasResult {
  status: "CREATED" | "IDEMPOTENT" | "UPDATED" | "ALIAS_CONFLICT" | "TARGET_NOT_FOUND" | "AMBIGUOUS" | "UNAUTHORIZED" | "ERROR";
  alias?: string;
  normalizedAlias?: string;
  targetDrinkName?: string;
  resolvedDrinkId?: string;
  businessUnit?: string | null;
  currentTarget?: string;
  requestedTarget?: string;
  candidates?: string[];
  message: string;
  drink?: any;
}

/**
 * Searches the target drink safely in the catalog.
 */
export function findTargetDrinkInCatalog(
  targetName: string,
  catalog: any[]
): { drink?: any; candidates: any[] } {
  const normTarget = normalizeDrinkAlias(targetName);
  if (!normTarget || !catalog || catalog.length === 0) {
    return { candidates: [] };
  }

  // 1. Exact Name
  const exact = catalog.filter((d) => (d.nome || d.name || "").trim().toLowerCase() === targetName.trim().toLowerCase());
  if (exact.length === 1) return { drink: exact[0], candidates: exact };

  // 2. Normalized Name
  const normalizedMatches = catalog.filter((d) => normalizeDrinkAlias(d.nome || d.name || "") === normTarget);
  if (normalizedMatches.length === 1) return { drink: normalizedMatches[0], candidates: normalizedMatches };
  if (normalizedMatches.length > 1) return { candidates: normalizedMatches };

  // 3. Substring / Word Match
  const subMatches = catalog.filter((d) => {
    const dn = normalizeDrinkAlias(d.nome || d.name || "");
    return dn.includes(normTarget) || normTarget.includes(dn);
  });

  if (subMatches.length === 1) return { drink: subMatches[0], candidates: subMatches };
  if (subMatches.length > 1) {
    // If one of the candidates is exact token match, prioritize
    const exactWordMatch = subMatches.filter((d) => {
      const words = normalizeDrinkAlias(d.nome || "").split(" ");
      return normTarget.split(" ").every((w) => words.includes(w));
    });
    if (exactWordMatch.length === 1) {
      return { drink: exactWordMatch[0], candidates: exactWordMatch };
    }
    return { candidates: subMatches };
  }

  return { candidates: [] };
}

/**
 * Learns or updates a drink alias with full conflict detection and audit logging.
 */
export async function learnDrinkAlias({
  supabaseAdmin,
  alias,
  targetDrinkName,
  businessUnit,
  userId,
  performerName = "Usuário",
  userRole = "socio",
  forceOverride = false,
  source = "manual_chat",
}: {
  supabaseAdmin: any;
  alias: string;
  targetDrinkName: string;
  businessUnit?: string | null;
  userId?: string | null;
  performerName?: string | null;
  userRole?: string | null;
  forceOverride?: boolean;
  source?: string;
}): Promise<LearnDrinkAliasResult> {
  const normAlias = normalizeDrinkAlias(alias);
  const canonicalUnit = toCanonicalBusinessUnitId(businessUnit);

  if (!normAlias) {
    return {
      status: "ERROR",
      alias,
      message: "Nome do alias inválido ou vazio.",
    };
  }

  // 1. Load catalog
  const { catalog } = await loadDrinkCatalogAndAliases(supabaseAdmin, canonicalUnit);

  // 2. Find target drink in catalog
  const targetMatch = findTargetDrinkInCatalog(targetDrinkName, catalog);

  if (!targetMatch.drink) {
    if (targetMatch.candidates.length > 1) {
      const candidateNames = targetMatch.candidates.map((c) => c.nome || c.name);
      return {
        status: "AMBIGUOUS",
        alias,
        targetDrinkName,
        candidates: candidateNames,
        message: `Encontrei mais de um drink compatível com '${targetDrinkName}': ${candidateNames.join(", ")}. Por favor, especifique qual drink real deve ser utilizado.`,
      };
    }

    return {
      status: "TARGET_NOT_FOUND",
      alias,
      targetDrinkName,
      message: `Drink '${targetDrinkName}' não encontrado no catálogo oficial de bebidas. Por favor, indique qual drink real cadastrado deve ser utilizado.`,
    };
  }

  const targetDrink = targetMatch.drink;

  // 3. Check existing alias in database
  let existingQuery = supabaseAdmin
    .from("drink_aliases")
    .select("*")
    .eq("normalized_alias", normAlias)
    .eq("active", true);

  if (canonicalUnit) {
    existingQuery = existingQuery.eq("business_unit", canonicalUnit);
  } else {
    existingQuery = existingQuery.is("business_unit", null);
  }

  const { data: existingList } = await existingQuery;
  const existing = existingList && existingList.length > 0 ? existingList[0] : null;

  if (existing) {
    // Check if mapping is unchanged (idempotent)
    if (String(existing.drink_id) === String(targetDrink.id)) {
      return {
        status: "IDEMPOTENT",
        alias,
        normalizedAlias: normAlias,
        targetDrinkName: targetDrink.nome,
        resolvedDrinkId: targetDrink.id,
        businessUnit: canonicalUnit,
        message: `O vínculo '${alias}' já aponta para '${targetDrink.nome}'.`,
        drink: targetDrink,
      };
    }

    // Existing points to another drink -> Conflict!
    const currentDrink = catalog.find((d) => String(d.id) === String(existing.drink_id));
    const currentTargetName = currentDrink ? currentDrink.nome : `Drink ID ${existing.drink_id}`;

    if (!forceOverride) {
      console.log(
        `[GOAT-AI][DRINK_MATCH][CONFLICT] alias="${alias}" currentTarget="${currentTargetName}" requestedTarget="${targetDrink.nome}" businessUnit="${canonicalUnit || "global"}"`
      );

      // Audit conflict attempt in drink_alias_history
      try {
        await supabaseAdmin.from("drink_alias_history").insert({
          alias_id: existing.id,
          alias,
          normalized_alias: normAlias,
          old_drink_id: existing.drink_id,
          new_drink_id: targetDrink.id,
          business_unit: canonicalUnit,
          action: "CONFLICT_REJECTED",
          source,
          changed_by: userId || null,
          performer_name: performerName || "GIA",
          details: { currentTarget: currentTargetName, requestedTarget: targetDrink.nome },
        });
      } catch (err) {
        // history insert optional in test/dev
      }

      return {
        status: "ALIAS_CONFLICT",
        alias,
        normalizedAlias: normAlias,
        currentTarget: currentTargetName,
        requestedTarget: targetDrink.nome,
        businessUnit: canonicalUnit,
        message: `Conflito de alias: '${alias}' atualmente aponta para '${currentTargetName}'. Para alterar para '${targetDrink.nome}', confirme a substituição.`,
      };
    }

    // Force override authorized
    const { error: updateErr } = await supabaseAdmin
      .from("drink_aliases")
      .update({
        drink_id: targetDrink.id,
        alias, // update display alias if newer
        source,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (updateErr) {
      return {
        status: "ERROR",
        alias,
        message: `Erro ao atualizar alias: ${updateErr.message}`,
      };
    }

    try {
      await supabaseAdmin.from("drink_alias_history").insert({
        alias_id: existing.id,
        alias,
        normalized_alias: normAlias,
        old_drink_id: existing.drink_id,
        new_drink_id: targetDrink.id,
        business_unit: canonicalUnit,
        action: "UPDATED",
        source,
        changed_by: userId || null,
        performer_name: performerName || "GIA",
        details: { oldTarget: currentTargetName, newTarget: targetDrink.nome },
      });
    } catch (err) {
      // history logging
    }

    console.log(
      `[GOAT-AI][DRINK_MATCH][LEARNED] alias="${alias}" drinkId="${targetDrink.id}" businessUnit="${canonicalUnit || "global"}"`
    );

    return {
      status: "UPDATED",
      alias,
      normalizedAlias: normAlias,
      targetDrinkName: targetDrink.nome,
      resolvedDrinkId: targetDrink.id,
      businessUnit: canonicalUnit,
      message: `Vínculo atualizado: '${alias}' agora aponta para '${targetDrink.nome}'.`,
      drink: targetDrink,
    };
  }

  // 4. Insert new alias
  const { data: newAlias, error: insertErr } = await supabaseAdmin
    .from("drink_aliases")
    .insert({
      alias,
      normalized_alias: normAlias,
      drink_id: targetDrink.id,
      business_unit: canonicalUnit,
      source,
      created_by: userId || null,
      active: true,
    })
    .select()
    .single();

  if (insertErr || !newAlias) {
    return {
      status: "ERROR",
      alias,
      message: `Erro ao salvar alias no banco: ${insertErr?.message || "falha"}`,
    };
  }

  try {
    await supabaseAdmin.from("drink_alias_history").insert({
      alias_id: newAlias.id,
      alias,
      normalized_alias: normAlias,
      old_drink_id: null,
      new_drink_id: targetDrink.id,
      business_unit: canonicalUnit,
      action: "CREATED",
      source,
      changed_by: userId || null,
      performer_name: performerName || "GIA",
    });
  } catch (err) {
    // history logging
  }

  console.log(
    `[GOAT-AI][DRINK_MATCH][LEARNED] alias="${alias}" drinkId="${targetDrink.id}" businessUnit="${canonicalUnit || "global"}"`
  );

  return {
    status: "CREATED",
    alias,
    normalizedAlias: normAlias,
    targetDrinkName: targetDrink.nome,
    resolvedDrinkId: targetDrink.id,
    businessUnit: canonicalUnit,
    message: `Vínculo aprendido: '${alias}' → '${targetDrink.nome}'.`,
    drink: targetDrink,
  };
}

/**
 * Deterministic parser for explicit drink match instructions like:
 * "Spritz Veneziano = Aperol"
 * "Caipivodka Morango = caipi morango"
 * "Red Label = whisky (Dose)"
 * 
 * Safely ignores non-alias equations (e.g. "receita = 811", "lucro = 181", "total = 500").
 */
export function parseDrinkMatchInstructions(text: string): Array<{ alias: string; targetDrinkName: string }> {
  if (!text || typeof text !== "string") return [];

  const nonDrinkKeywords = [
    "total", "faturamento", "receita", "lucro", "custo", "despesa", "saldo", "repasse",
    "reposicao", "mao de obra", "barman", "barmen", "data", "periodo", "unidade", "evento",
    "cliente", "pix", "cartao", "dinheiro", "taxa", "desconto", "status", "responsavel"
  ];

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const results: Array<{ alias: string; targetDrinkName: string }> = [];

  for (const line of lines) {
    // Check if line contains '=', '->', '=>', ':' with valid sides
    const match = line.match(/^([^=\->:]+?)\s*(?:=|->|=>|:)\s*(.+)$/);
    if (!match) continue;

    const left = match[1].trim();
    const right = match[2].trim();

    if (left.length < 2 || right.length < 2) continue;

    const leftNorm = normalizeDrinkAlias(left);
    const rightNorm = normalizeDrinkAlias(right);

    // Reject non-drink keywords on left side
    if (nonDrinkKeywords.some((kw) => leftNorm === kw || leftNorm.startsWith(kw + " "))) {
      continue;
    }

    // Reject numeric equations (e.g. "receita = 811" or "lucro = 181" or "10 = 20")
    if (/^[\d\.,\sR$]+$/.test(right) || /^[\d\.,\s]+$/.test(left)) {
      continue;
    }

    results.push({
      alias: left,
      targetDrinkName: right,
    });
  }

  return results;
}
