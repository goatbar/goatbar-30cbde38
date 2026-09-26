import { type Drink } from "@/lib/mock-data";
import { type SelectedDrinksPayload } from "@/lib/drinks-canonical";

export interface EventMenuDrink {
  id: string;
  name: string;
  description: string;
  category?: string;
}

export interface EventMenuModel {
  title: string;
  subtitle?: string;
  drinks: EventMenuDrink[];
  layout: "compact" | "standard" | "expanded";
  columns: 1 | 2;
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

export function getEventMenuLayout(drinkCount: number): Pick<EventMenuModel, "layout" | "columns"> {
  if (drinkCount <= 5) return { layout: "expanded", columns: 1 };
  if (drinkCount <= 9) return { layout: "standard", columns: 2 };
  return { layout: "compact", columns: 2 };
}

export function buildEventMenuModel(input: {
  selectedDrinks: SelectedDrinksPayload | string[] | null | undefined;
  catalog: Drink[];
  eventName?: string | null;
}): EventMenuModel {
  const drinks = resolveEventMenuDrinks(input.selectedDrinks, input.catalog);
  return {
    title: "Carta de Drinks",
    subtitle: input.eventName?.trim() || undefined,
    drinks,
    ...getEventMenuLayout(drinks.length),
  };
}
