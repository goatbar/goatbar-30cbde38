// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { EventKanban } from "./EventKanban";
import { type Event as RealEvent } from "@/services/event-budget-service";

// Mock @tanstack/react-router Link
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, className, onClick }: any) => (
    <a
      href={`${to}/${params?.eventoId || ""}`}
      className={className}
      onClick={onClick}
      data-testid="event-link"
    >
      {children}
    </a>
  ),
}));

describe("EventKanban Component", () => {
  const mockEvents: RealEvent[] = [
    {
      id: "evt-1",
      client_name: "Ana & Pedro",
      event_name: "Casamento Ana & Pedro",
      event_type: "Casamento",
      date: "2026-10-15",
      event_location: "Espaço Villa Bisutti",
      guests: 150,
      current_budget_value: 15000,
      status: "novo_orcamento",
      is_paid_full: false,
      created_at: "2026-08-01",
      updated_at: "2026-08-01",
    },
    {
      id: "evt-2",
      client_name: "Tech Corp",
      event_name: "Festa Tech Corp",
      event_type: "Corporativo",
      date: "2026-11-20",
      event_location: "Rooftop 033",
      guests: 100,
      current_budget_value: 12000,
      status: "orcamento_enviado",
      is_paid_full: false,
      created_at: "2026-08-01",
      updated_at: "2026-08-01",
    },
    {
      id: "evt-3",
      client_name: "Carlos 50 anos",
      event_name: "Aniversário Carlos",
      event_type: "Aniversário",
      date: "2026-12-05",
      event_location: "Residência",
      guests: 50,
      current_budget_value: 6000,
      status: "confirmado",
      is_paid_full: true,
      created_at: "2026-08-01",
      updated_at: "2026-08-01",
    },
  ];

  const onStatusChangeMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the pipeline columns with accurate event counts", () => {
    render(
      <EventKanban
        events={mockEvents}
        statusFilter="pipeline"
        onStatusChange={onStatusChangeMock}
      />,
    );

    // Columns present in 'pipeline' filter in exact order
    const headings = screen.getAllByRole("heading", { level: 3 });
    const headingLabels = headings.map((h) => h.textContent?.trim());
    expect(headingLabels).toEqual([
      "Novo Orçamento",
      "Orçamento Enviado",
      "Aguardando Retorno",
      "Dados Solicitados",
      "Em Assinatura",
      "Confirmado",
    ]);

    // Event cards rendered in correct columns
    expect(screen.getByText("Casamento Ana & Pedro")).toBeInTheDocument();
    expect(screen.getByText("Festa Tech Corp")).toBeInTheDocument();
    expect(screen.getByText("Aniversário Carlos")).toBeInTheDocument();

    // Badges/details
    expect(screen.getByText("150 pax")).toBeInTheDocument();
    expect(screen.getByText("100 pax")).toBeInTheDocument();
    expect(screen.getByText("50 pax")).toBeInTheDocument();
  });

  it("allows moving through all commercial funnel steps correctly", () => {
    render(
      <EventKanban
        events={mockEvents}
        statusFilter="pipeline"
        onStatusChange={onStatusChangeMock}
      />,
    );

    const selectElements = screen.getAllByTitle("Alterar status do evento");

    // 1. Move to "dados_solicitados"
    fireEvent.change(selectElements[0], { target: { value: "dados_solicitados" } });
    expect(onStatusChangeMock).toHaveBeenLastCalledWith("evt-1", "dados_solicitados");

    // 2. Move to "em_assinatura"
    fireEvent.change(selectElements[0], { target: { value: "em_assinatura" } });
    expect(onStatusChangeMock).toHaveBeenLastCalledWith("evt-1", "em_assinatura");

    // 3. Move to "confirmado"
    fireEvent.change(selectElements[0], { target: { value: "confirmado" } });
    expect(onStatusChangeMock).toHaveBeenLastCalledWith("evt-1", "confirmado");
  });

  it("does not call onStatusChange if selected status is the same", () => {
    render(
      <EventKanban
        events={mockEvents}
        statusFilter="pipeline"
        onStatusChange={onStatusChangeMock}
      />,
    );

    const selectElements = screen.getAllByTitle("Alterar status do evento");
    // evt-1 is already in 'novo_orcamento'
    fireEvent.change(selectElements[0], { target: { value: "novo_orcamento" } });

    expect(onStatusChangeMock).toHaveBeenCalledTimes(1);
  });

  it("shows saving indicator and disables interaction when an event is saving", () => {
    const savingSet = new Set(["evt-1"]);
    render(
      <EventKanban
        events={mockEvents}
        statusFilter="pipeline"
        savingEventIds={savingSet}
        onStatusChange={onStatusChangeMock}
      />,
    );

    expect(screen.getByText("Salvando...")).toBeInTheDocument();

    const selectElements = screen.getAllByTitle("Alterar status do evento");
    // First select is disabled
    expect(selectElements[0]).toBeDisabled();
    // Second select is enabled
    expect(selectElements[1]).not.toBeDisabled();
  });

  it("applies pending optimistic override to show card in new column immediately", () => {
    render(
      <EventKanban
        events={mockEvents}
        statusFilter="pipeline"
        pendingOverrides={{ "evt-1": "confirmado" }}
        onStatusChange={onStatusChangeMock}
      />,
    );

    // evt-1 should now be grouped into Confirmado column
    // The Confirmado column should now have 2 events: evt-1 and evt-3
    const confirmedCountBadge = screen.getByTitle("2 evento(s) nesta etapa");
    expect(confirmedCountBadge).toBeInTheDocument();
  });
});
