// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock tanstack router before importing route
vi.mock("@tanstack/react-router", () => {
  return {
    createFileRoute: () => (options: any) => ({
      ...options,
      useParams: () => ({ token: "mock-token-123" }),
    }),
  };
});

import { budgetRequestService } from "@/services/budget-request-service";
import { Route } from "@/routes/orcamento.solicitar.$token";
import { sanitizePublicDrinks, parseWeddingCoupleName, validatePublicBudgetPayload } from "../supabase/functions/budget-request/logic";

describe("Public Budget Request Form & Drink Catalog", () => {
  const mockPublicDrinks = [
    {
      id: "drink-moscow-mule",
      nome: "Moscow Mule",
      descricao: "Vodka, xarope de gengibre, limão e espuma artesanal.",
      imagem: "https://example.com/moscow-mule.jpg",
      show_in_public_menu: true,
      modality_config: {
        evento: { active: true, cost: 8.5 },
        steakhouse: { active: false },
      },
      insumos: [{ nome: "Vodka", custo: 5.0 }, { nome: "Espuma de Gengibre", custo: 3.5 }],
    },
    {
      id: "drink-gin-tonica",
      nome: "Gin Tônica Floral",
      descricao: "Gin premium com tônica e botânicos selecionados.",
      imagem: null,
      show_in_public_menu: true,
      modality_config: {
        evento: { active: true, cost: 7.0 },
      },
      insumos: [{ nome: "Gin", custo: 4.0 }, { nome: "Tônica", custo: 3.0 }],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Sanitiza catálogo público mantendo apenas drinks com show_in_public_menu=true e evento ativo", () => {
    const sanitized = sanitizePublicDrinks(mockPublicDrinks);
    expect(sanitized).toHaveLength(2);
    expect(sanitized[0]).toEqual({
      id: "drink-moscow-mule",
      name: "Moscow Mule",
      description: "Vodka, xarope de gengibre, limão e espuma artesanal.",
      image: "https://example.com/moscow-mule.jpg",
      ingredients: ["Vodka", "Espuma de Gengibre"],
    });
    expect((sanitized[0] as any).cost).toBeUndefined();
    expect((sanitized[0] as any).custo_unitario).toBeUndefined();
  });

  it("2. O formulário público renderiza APENAS 'Nome do evento / casal' e NÃO renderiza 'Nome do noivo' / 'Nome da noiva'", async () => {
    vi.spyOn(budgetRequestService, "validate").mockResolvedValue({
      state: "ACTIVE",
      public_drinks: sanitizePublicDrinks(mockPublicDrinks),
      metadata: {},
    });

    const Component = (Route as any).component;
    render(<Component />);

    await waitFor(() => {
      expect(screen.getByText("Solicite seu orçamento")).toBeInTheDocument();
    });

    // Confirma campo único
    expect(screen.getByText("Nome do evento / casal")).toBeInTheDocument();
    expect(screen.queryByText(/Nome do noivo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nome da noiva/i)).not.toBeInTheDocument();
  });

  it("3. Renderiza os cards de drinks quando public_drinks possui itens e permite seleção múltipla", async () => {
    vi.spyOn(budgetRequestService, "validate").mockResolvedValue({
      state: "ACTIVE",
      public_drinks: sanitizePublicDrinks(mockPublicDrinks),
      metadata: {},
    });

    const submitSpy = vi.spyOn(budgetRequestService, "submit").mockResolvedValue({
      state: "USED",
      idempotent: false,
    });

    const Component = (Route as any).component;
    render(<Component />);

    await waitFor(() => {
      expect(screen.getByText("Tem algum drink que não pode faltar?")).toBeInTheDocument();
    });

    expect(screen.getByText("Moscow Mule")).toBeInTheDocument();
    expect(screen.getByText("Gin Tônica Floral")).toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    fireEvent.change(screen.getByLabelText(/Nome do solicitante/i), { target: { value: "Carlos Eduardo" } });
    fireEvent.change(screen.getByLabelText(/WhatsApp/i), { target: { value: "(11) 98888-7777" } });
    fireEvent.change(screen.getByLabelText(/Nome do evento \/ casal/i), { target: { value: "Carlos & Juliana" } });
    fireEvent.change(screen.getByLabelText(/Data do evento/i), { target: { value: "2026-11-20" } });

    fireEvent.click(screen.getByRole("button", { name: /Solicitar orçamento/i }));

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledTimes(1);
    });

    const submittedPayload = submitSpy.mock.calls[0][1];
    expect(submittedPayload.requested_drink_ids).toEqual(["drink-moscow-mule", "drink-gin-tonica"]);
    expect(submittedPayload.event_name).toBe("Carlos & Juliana");
    expect((submittedPayload as any).groom_name).toBeUndefined();
    expect((submittedPayload as any).bride_name).toBeUndefined();
  });

  it("4. No backend, validatePublicBudgetPayload deriva groom_name e bride_name preservando event_name", () => {
    const backendResult = validatePublicBudgetPayload({
      client_name: "Carlos Eduardo",
      event_name: "Carlos & Juliana",
      phone: "(11) 98888-7777",
      date: "2026-11-20",
      event_type: "Casamento",
      guests: 120,
      duration_hours: 5,
      requested_drink_ids: ["drink-moscow-mule", "drink-gin-tonica"],
    });

    expect(backendResult.event_name).toBe("Carlos & Juliana");
    expect(backendResult.groom_name).toBe("Carlos");
    expect(backendResult.bride_name).toBe("Juliana");
    expect(backendResult.requested_drink_ids).toEqual(["drink-moscow-mule", "drink-gin-tonica"]);
  });
});
