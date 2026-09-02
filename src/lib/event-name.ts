/**
 * Normalizes the canonical event name without changing non-wedding events.
 * Only a standalone Portuguese conjunction surrounded by whitespace is replaced.
 */
export function normalizeEventName(
  eventName: string | null | undefined,
  eventType: string | null | undefined,
): string | null | undefined {
  if (
    typeof eventName !== "string" ||
    eventType?.trim().toLocaleLowerCase("pt-BR") !== "casamento"
  ) {
    return eventName;
  }

  return eventName.replace(/\s+e\s+/gi, " & ");
}
