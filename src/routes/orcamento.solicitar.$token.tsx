import { createFileRoute } from "@tanstack/react-router";
import { PublicBudgetRequestForm } from "@/components/public-budget/PublicBudgetRequestForm";

export const Route = createFileRoute("/orcamento/solicitar/$token")({
  component: TokenBudgetRequestRoute,
});

function TokenBudgetRequestRoute() {
  const { token } = Route.useParams();
  return <PublicBudgetRequestForm mode="token" token={token} />;
}
