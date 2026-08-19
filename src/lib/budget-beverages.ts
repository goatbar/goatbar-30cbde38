/**
 * Keep the editor value untouched while the user is typing. In particular, a
 * trailing space is meaningful because it allows the next word to be entered.
 */
export function preserveBeveragesInput(value: string): string {
  return value;
}

/** Convert the line-based editor value into the JSON list persisted with a budget. */
export function normalizeBeveragesForSave(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function beveragesToEditorValue(beverages: unknown): string {
  if (!Array.isArray(beverages)) return "";
  return beverages.filter((item): item is string => typeof item === "string").join("\n");
}
