import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/eventos")({
  component: EventosLayout,
});

function EventosLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
