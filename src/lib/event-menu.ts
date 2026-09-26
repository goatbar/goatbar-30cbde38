import { type Drink } from "@/lib/mock-data";
import { type SelectedDrinksPayload } from "@/lib/drinks-canonical";

export interface EventMenuDrink {
  id: string;
  name: string;
  description: string;
  category?: string;
}

export type EventMenuLayout = "compact" | "standard" | "expanded";
export type EventMenuArtworkMode = "automatic" | "library" | "ai" | "upload";

export type EventMenuPersonalization =
  | { kind: "wedding"; initials: string; label: string; date?: string }
  | { kind: "birthday"; label: string }
  | { kind: "corporate"; label: string }
  | { kind: "bachelor"; label: string }
  | { kind: "generic"; label: string };

export interface EventMenuModel {
  title: string;
  subtitle?: string;
  drinks: EventMenuDrink[];
  layout: EventMenuLayout;
  columns: 1;
  pages: EventMenuDrink[][];
  personalization: EventMenuPersonalization;
  artworkMode: EventMenuArtworkMode;
  artworkUrl?: string | null;
  warnings: string[];
}

export interface EventMenuContext {
  selectedDrinks: SelectedDrinksPayload | string[] | null | undefined;
  catalog: Drink[];
  eventName?: string | null;
  eventType?: string | null;
  clientName?: string | null;
  brideName?: string | null;
  groomName?: string | null;
  date?: string | null;
  artworkMode?: EventMenuArtworkMode;
  artworkUrl?: string | null;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function selectedEntries(selected: SelectedDrinksPayload | string[] | null | undefined) {
  if (!selected) return [] as Array<{ id?: string; name?: string }>;
  if (Array.isArray(selected)) return selected.map((value) => ({ id: value, name: value }));
  if (selected.items?.length) {
    return selected.items.map((item) => ({ id: item.drink_id, name: item.name }));
  }
  return (selected.ids || []).map((id) => ({ id }));
}

export function resolveEventMenuDrinks(
  selected: SelectedDrinksPayload | string[] | null | undefined,
  catalog: Drink[],
): EventMenuDrink[] {
  const seen = new Set<string>();

  return selectedEntries(selected).flatMap((entry) => {
    const byId = entry.id ? catalog.find((drink) => drink.id === entry.id) : undefined;
    const byName = entry.name
      ? catalog.find((drink) => normalize(drink.nome) === normalize(entry.name!))
      : undefined;
    const drink = byId || byName;
    const name = drink?.nome || entry.name || entry.id || "";
    if (!name) return [];

    const key = drink?.id || normalize(name);
    if (seen.has(key)) return [];
    seen.add(key);

    return [{
      id: drink?.id || entry.id || key,
      name,
      description: drink?.descricao?.trim() || "",
      category: drink?.categoria,
    }];
  });
}

function drinkWeight(drink: EventMenuDrink) {
  const nameLines = Math.max(1, Math.ceil(drink.name.length / 30));
  const descriptionLines = drink.description ? Math.max(1, Math.ceil(drink.description.length / 58)) : 0;
  return 1.15 + (nameLines - 1) * 0.35 + descriptionLines * 0.72;
}

function totalWeight(drinks: EventMenuDrink[]) {
  return drinks.reduce((sum, drink) => sum + drinkWeight(drink), 0);
}

export function getEventMenuLayout(
  drinkCount: number,
  estimatedWeight = drinkCount * 1.9,
): Pick<EventMenuModel, "layout" | "columns"> {
  if (drinkCount <= 5 && estimatedWeight <= 10) return { layout: "expanded", columns: 1 };
  if (drinkCount <= 8 && estimatedWeight <= 15) return { layout: "standard", columns: 1 };
  return { layout: "compact", columns: 1 };
}

export function paginateEventMenuDrinks(drinks: EventMenuDrink[], maxWeight = 18.5): EventMenuDrink[][] {
  if (drinks.length === 0) return [[]];

  const pages: EventMenuDrink[][] = [];
  let current: EventMenuDrink[] = [];
  let weight = 0;

  for (const drink of drinks) {
    const nextWeight = drinkWeight(drink);
    if (current.length > 0 && weight + nextWeight > maxWeight) {
      pages.push(current);
      current = [];
      weight = 0;
    }
    current.push(drink);
    weight += nextWeight;
  }

  if (current.length) pages.push(current);
  return pages;
}

function initialsFromNames(names: string[]) {
  return names
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name.trim().charAt(0).toUpperCase())
    .join("");
}

function formatMenuDate(value?: string | null) {
  if (!value) return undefined;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function resolveEventMenuPersonalization(input: {
  eventType?: string | null;
  eventName?: string | null;
  clientName?: string | null;
  brideName?: string | null;
  groomName?: string | null;
  date?: string | null;
}): EventMenuPersonalization {
  const type = normalize(input.eventType || "");
  const eventName = input.eventName?.trim() || input.clientName?.trim() || "";

  if (type.includes("casamento")) {
    const names = [input.groomName || "", input.brideName || ""].filter(Boolean);
    const fallbackNames = eventName.split(/\s*(?:&| e )\s*/i).filter(Boolean);
    const resolvedNames = names.length ? names : fallbackNames;
    const label = resolvedNames.length >= 2 ? resolvedNames.slice(0, 2).join(" & ") : eventName;
    return {
      kind: "wedding",
      initials: initialsFromNames(resolvedNames),
      label,
      date: formatMenuDate(input.date),
    };
  }

  if (type.includes("anivers")) return { kind: "birthday", label: "Happy Birthday" };
  if (type.includes("corporat") || type.includes("confratern")) {
    return { kind: "corporate", label: eventName || "Cheers!" };
  }
  if (type.includes("despedida") || type.includes("solteir")) {
    return { kind: "bachelor", label: "Game Over" };
  }
  return { kind: "generic", label: eventName };
}

export function validateEventMenuModel(menu: Pick<EventMenuModel, "drinks" | "pages">) {
  const warnings: string[] = [];
  if (menu.drinks.length === 0) warnings.push("Nenhum drink selecionado no orçamento atual.");

  const missingDescriptions = menu.drinks.filter((drink) => !drink.description.trim());
  if (missingDescriptions.length) {
    warnings.push(
      `${missingDescriptions.length} drink(s) sem descrição cadastrada no módulo de Drinks.`,
    );
  }

  if (menu.pages.length > 1) {
    warnings.push(`O cardápio será gerado em ${menu.pages.length} páginas para evitar sobreposição.`);
  }
  return warnings;
}

export function buildEventMenuModel(input: EventMenuContext): EventMenuModel {
  const drinks = resolveEventMenuDrinks(input.selectedDrinks, input.catalog);
  const weight = totalWeight(drinks);
  const pages = paginateEventMenuDrinks(drinks);
  const layout = getEventMenuLayout(drinks.length, pages.length > 1 ? 99 : weight);

  const base = {
    title: "Menu",
    subtitle: input.eventName?.trim() || undefined,
    drinks,
    ...layout,
    pages,
    personalization: resolveEventMenuPersonalization(input),
    artworkMode: input.artworkMode || "automatic",
    artworkUrl: input.artworkUrl || null,
  } satisfies Omit<EventMenuModel, "warnings">;

  return {
    ...base,
    warnings: validateEventMenuModel(base),
  };
}
