import type { Event } from "@/services/event-budget-service";

export const PUBLIC_BUDGET_ORIGIN = "public_budget_form";

export function isPendingPublicBudgetRequest(event: Event): boolean {
  return (
    event.origin === PUBLIC_BUDGET_ORIGIN && (event.status ?? "").toLowerCase() === "novo_orcamento"
  );
}

export function getPendingPublicBudgetRequests(events: Event[]): Event[] {
  return events
    .filter(isPendingPublicBudgetRequest)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}
