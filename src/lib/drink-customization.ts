export const DRINK_CUSTOMIZATIONS = ["none", "monogram", "rice_paper"] as const;
export type DrinkCustomization = (typeof DRINK_CUSTOMIZATIONS)[number];

export type SelectedDrinksSnapshot = {
  ids: string[];
  customizations?: Record<string, DrinkCustomization>;
  [key: string]: unknown;
};

export function normalizeDrinkCustomization(value: unknown): DrinkCustomization {
  return value === "monogram" || value === "rice_paper" ? value : "none";
}

export function getDrinkCustomizations(value: unknown): Record<string, DrinkCustomization> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = (value as Record<string, unknown>).customizations;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).map(([id, customization]) => [
      id,
      normalizeDrinkCustomization(customization),
    ]),
  );
}

const suffix: Record<DrinkCustomization, string> = {
  none: "",
  monogram: " (com monograma)",
  rice_paper: " (com papel de arroz)",
};

/** Formats the version snapshot without creating a second menu entry for a customized drink. */
export function formatCustomizedDrinkNames(
  ids: string[],
  names: string[],
  customizations: Record<string, DrinkCustomization> = {},
): string[] {
  const seen = new Set<string>();
  return ids.flatMap((id, index) => {
    if (seen.has(id) || !names[index]?.trim()) return [];
    seen.add(id);
    return [`${names[index].trim()}${suffix[normalizeDrinkCustomization(customizations[id])]}`];
  });
}
