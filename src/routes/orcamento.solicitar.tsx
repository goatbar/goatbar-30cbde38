import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/orcamento/solicitar")({
  component: () => <Outlet />,
});
