import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/goat-ai")({
  component: () => <Navigate to="/gia" replace />,
});
