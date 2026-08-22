import { type Drink, type ModalityConfig } from "@/lib/mock-data";

export type CanonicalUnitId = "steakhouse" | "goat_botequim" | "eventos";
export type CanonicalModalityName = "7Steakhouse" | "Goat Botequim" | "Evento";

export interface CanonicalUnitInfo {
  id: CanonicalUnitId;
  canonicalName: string;
  modalityName: CanonicalModalityName;
  modalityKey: "steakhouse" | "goatbotequim" | "evento";
}

export interface SelectedDrinkItemSnapshot {
  drink_id: string;
  name: string;
  unit_cost: number;
  unit_price?: number;
  glassware_id?: string;
  glassware_name?: string;
}

export interface SelectedDrinksPayload {
  ids: string[];
  items?: SelectedDrinkItemSnapshot[];
  copos?: Record<string, string>;
  descricaoBebidas?: string;
}

const UNIT_MAP: Record<CanonicalUnitId, CanonicalUnitInfo> = {
  steakhouse: {
    id: "steakhouse",
    canonicalName: "7 Steak House",
    modalityName: "7Steakhouse",
    modalityKey: "steakhouse",
  },
  goat_botequim: {
    id: "goat_botequim",
    canonicalName: "Goat Botequim",
    modalityName: "Goat Botequim",
    modalityKey: "goatbotequim",
  },
  eventos: {
    id: "eventos",
    canonicalName: "Eventos",
    modalityName: "Evento",
    modalityKey: "evento",
  },
};

/**
 * Resolves any string/id variant into a canonical unit info.
 */
export function resolveCanonicalUnit(input?: string | null): CanonicalUnitInfo {
  if (!input || typeof input !== "string") {
    return UNIT_MAP.eventos;
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
    return UNIT_MAP.steakhouse;
  }

  if (
    clean.includes("botequim") ||
    clean.includes("boteco") ||
    clean.includes("goat botequim") ||
    clean.includes("goatbotequim")
  ) {
    return UNIT_MAP.goat_botequim;
  }

  return UNIT_MAP.eventos;
}

/**
 * Returns only the active drinks available for the specified business unit.
 * Rule: Drink active + unit linked (modalityConfig[unit].active === true).
 */
export function getDrinksForUnit(drinks: Drink[], unitInput?: string | null): Drink[] {
  const unit = resolveCanonicalUnit(unitInput);
  const key = unit.modalityKey;

  return drinks.filter((d) => {
    // Check status if present (legacy or store)
    const isGloballyActive = (d as any).status !== "inativo";
    const modConfig = d.modalityConfig?.[key];
    const isUnitActive = Boolean(modConfig?.active);
    return isGloballyActive && isUnitActive;
  });
}

/**
 * Checks if a drink is active and available for a given unit.
 */
export function isDrinkAvailableForUnit(drink: Drink, unitInput?: string | null): boolean {
  if (!drink) return false;
  if ((drink as any).status === "inativo") return false;
  const unit = resolveCanonicalUnit(unitInput);
  return Boolean(drink.modalityConfig?.[unit.modalityKey]?.active);
}

/**
 * Returns the current default price for a new launch in this unit.
 */
export function getDrinkPriceForUnit(drink: Drink, unitInput?: string | null): number {
  if (!drink) return 0;
  const unit = resolveCanonicalUnit(unitInput);
  const conf = drink.modalityConfig?.[unit.modalityKey];
  return Number(conf?.price ?? (drink as any).precoVenda ?? (drink as any).preco_venda ?? 0);
}

/**
 * Returns the current default cost for a new launch in this unit.
 */
export function getDrinkCostForUnit(drink: Drink, unitInput?: string | null): number {
  if (!drink) return 0;
  const unit = resolveCanonicalUnit(unitInput);
  const conf = drink.modalityConfig?.[unit.modalityKey];
  return Number(conf?.cost || drink.custoUnitario || 0);
}

/**
 * Builds an immutable financial snapshot of a drink for saving in an event budget or session.
 */
export function buildDrinkSnapshot(
  drink: Drink,
  unitInput?: string | null,
  glasswareId?: string,
  glasswareName?: string,
): SelectedDrinkItemSnapshot {
  const unit = resolveCanonicalUnit(unitInput);
  const unitCost = getDrinkCostForUnit(drink, unitInput);
  const unitPrice = getDrinkPriceForUnit(drink, unitInput);

  return {
    drink_id: drink.id,
    name: drink.nome,
    unit_cost: unitCost,
    unit_price: unitPrice > 0 ? unitPrice : undefined,
    glassware_id: glasswareId,
    glassware_name: glasswareName,
  };
}

/**
 * Hydrates drink names safely from ID list or snapshot items.
 * Preserves historical names if a drink was later deactivated or deleted from catalog.
 */
export function hydrateDrinkNames(
  selectedDrinks: SelectedDrinksPayload | string[] | null | undefined,
  catalogDrinks: Drink[] = [],
): string[] {
  if (!selectedDrinks) return [];

  // If passed as array of strings
  if (Array.isArray(selectedDrinks)) {
    return selectedDrinks.map((val) => {
      const match = catalogDrinks.find((d) => d.id === val || d.nome === val);
      return match ? match.nome : val;
    });
  }

  // If passed as structured SelectedDrinksPayload
  if (selectedDrinks.items && Array.isArray(selectedDrinks.items) && selectedDrinks.items.length > 0) {
    return selectedDrinks.items.map((it) => it.name);
  }

  const ids = selectedDrinks.ids || [];
  return ids.map((id) => {
    const match = catalogDrinks.find((d) => d.id === id || d.nome === id);
    return match ? match.nome : id;
  });
}
