import { createFileRoute } from "@tanstack/react-router";
import { PublicBudgetRequestForm } from "@/components/public-budget/PublicBudgetRequestForm";

export const Route = createFileRoute("/orcamento/solicitar/")({
  component: PublicBudgetRequestRoute,
});

function PublicBudgetRequestRoute() {
  return <PublicBudgetRequestForm mode="public" />;
}
