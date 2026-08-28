export const BUDGET_EVENT_SNAPSHOT_FIELDS = [
  "event_name", "client_name", "groom_name", "bride_name", "date", "event_time",
  "duration_hours", "event_location", "city", "event_type",
] as const;

export function createBudgetEventSnapshot(event: Record<string, unknown>) {
  return Object.fromEntries(BUDGET_EVENT_SNAPSHOT_FIELDS.map((field) => [field, event[field] ?? null]));
}

/** Event fallback is deliberately limited to versions created before snapshots existed. */
export function getBudgetVersionGuestCount(
  budget: Record<string, unknown>, event?: Record<string, unknown>,
): number | null {
  const historical = Number(budget.guest_count);
  if (budget.guest_count != null && Number.isFinite(historical)) return historical;
  const legacy = Number(event?.guests);
  return event?.guests != null && Number.isFinite(legacy) ? legacy : null;
}

export function getBudgetVersionEventContext(
  budget: Record<string, unknown>, event: Record<string, unknown>,
) {
  const snapshot = budget.event_snapshot;
  return snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
    ? { ...event, ...(snapshot as Record<string, unknown>) }
    : event;
}
