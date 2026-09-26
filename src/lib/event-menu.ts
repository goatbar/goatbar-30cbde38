import { type Drink } from "@/lib/mock-data";
import { type SelectedDrinksPayload } from "@/lib/drinks-canonical";

export interface EventMenuDrink {
  id: string;
  name: string;
  description: string;
  category?: string;
}

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
  layout: "compact" | "standard" | "expanded";
  columns: 1 | 2;
  personalization: EventMenuPersonalization;
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


function initialsFromNames(names: string[]) {
  return names.filter(Boolean).slice(0, 2).map(name => name.trim().charAt(0).toUpperCase()).join("");
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
    const label = names.length === 2 ? names.join(" & ") : eventName;
    return { kind: "wedding", initials: initialsFromNames(names.length ? names : eventName.split(/\s*(?:&| e )\s*/i)), label, date: input.date || undefined };
  }
  if (type.includes("anivers")) return { kind: "birthday", label: "Happy Birthday" };
  if (type.includes("corporat") || type.includes("confratern")) return { kind: "corporate", label: eventName || "Cheers!" };
  if (type.includes("despedida") || type.includes("solteir")) return { kind: "bachelor", label: "Game Over" };
  return { kind: "generic", label: eventName };
}

export function buildEventMenuModel(input: {
  selectedDrinks: SelectedDrinksPayload | string[] | null | undefined;
  catalog: Drink[];
  eventName?: string | null;
  eventType?: string | null;
  clientName?: string | null;
  brideName?: string | null;
  groomName?: string | null;
  date?: string | null;
}): EventMenuModel {
  const drinks = resolveEventMenuDrinks(input.selectedDrinks, input.catalog);
  return {
    title: "Carta de Drinks",
    subtitle: input.eventName?.trim() || undefined,
    drinks,
    ...getEventMenuLayout(drinks.length),
    personalization: resolveEventMenuPersonalization(input),
  };
}
