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
import { Route as PublicRequestRoute } from "@/routes/orcamento.solicitar.index";
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

  it("2. O formulário público renderiza 'Nome do casal *' para Casamento e 'Nome do evento *' para outros tipos, sem campos separados de noivo/noiva", async () => {
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

    // Padrão é Casamento: campo único "Nome do casal *" com placeholder "Ex.: João e Maria"
    const coupleInput = screen.getByLabelText(/Nome do casal \*/i);
    expect(coupleInput).toBeInTheDocument();
    expect(coupleInput).toHaveAttribute("placeholder", "Ex.: João e Maria");
    expect(screen.queryByText(/Nome do noivo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nome da noiva/i)).not.toBeInTheDocument();

    // Mudar para Corporativo: campo vira "Nome do evento *"
    fireEvent.change(screen.getByLabelText(/Tipo de evento/i), { target: { value: "Corporativo" } });
    expect(screen.getByLabelText(/Nome do evento \*/i)).toBeInTheDocument();
    expect(screen.queryByText(/Nome do casal/i)).not.toBeInTheDocument();
  });

  it("3. Renderiza os cards de drinks com object-contain, nome, descrição e SEM insumos", async () => {
    vi.spyOn(budgetRequestService, "validate").mockResolvedValue({
      state: "ACTIVE",
      public_drinks: sanitizePublicDrinks(mockPublicDrinks),
      metadata: {},
    });

    const submitSpy = vi.spyOn(budgetRequestService, "submit").mockResolvedValue({
      state: "USED",
      idempotent: false,
      event_id: "123e4567-e89b-42d3-a456-426614174000",
    });

    const Component = (Route as any).component;
    render(<Component />);

    await waitFor(() => {
      expect(screen.getByText(/Com base na nossa carta de drinks/i)).toBeInTheDocument();
    });

    // Nome e descrição presentes
    expect(screen.getByText("Moscow Mule")).toBeInTheDocument();
    expect(screen.getByText("Vodka, xarope de gengibre, limão e espuma artesanal.")).toBeInTheDocument();
    expect(screen.getByText("Gin Tônica Floral")).toBeInTheDocument();

    // Insumos NÃO são renderizados
    expect(screen.queryByText(/Insumos/i)).not.toBeInTheDocument();

    // Imagem usa object-contain
    const img = screen.getByAltText("Moscow Mule");
    expect(img).toHaveClass("object-contain");

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    fireEvent.change(screen.getByLabelText(/Nome do solicitante/i), { target: { value: "Carlos Eduardo" } });
    fireEvent.change(screen.getByLabelText(/WhatsApp/i), { target: { value: "(11) 98888-7777" } });
    fireEvent.change(screen.getByLabelText(/Nome do casal/i), { target: { value: "Carlos & Juliana" } });
    fireEvent.change(screen.getByLabelText(/Data do evento/i), { target: { value: "2026-11-20" } });

    fireEvent.click(screen.getByRole("button", { name: /Solicitar orçamento/i }));

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledTimes(1);
    });

    const submittedPayload = submitSpy.mock.calls[0][1];
    expect(submittedPayload.requested_drink_ids).toEqual(["drink-moscow-mule", "drink-gin-tonica"]);
    expect(submittedPayload.event_name).toBe("Carlos & Juliana");
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

  it("usa fallback controlado quando a imagem está ausente ou falha", async () => {
    vi.spyOn(budgetRequestService, "validate").mockResolvedValue({ state: "ACTIVE", public_drinks: sanitizePublicDrinks(mockPublicDrinks), metadata: {} });
    const Component = (Route as any).component;
    render(<Component />);
    const valid = await screen.findByAltText("Moscow Mule");
    expect(valid).toHaveAttribute("src", "https://example.com/moscow-mule.jpg");
    expect(screen.getByLabelText("Imagem indisponível para Gin Tônica Floral")).toBeInTheDocument();
    fireEvent.error(valid);
    expect(screen.getByLabelText("Imagem indisponível para Moscow Mule")).toBeInTheDocument();
  });

  it("backend não publica blob URL legado persistido", () => {
    const legacy = sanitizePublicDrinks([{ ...mockPublicDrinks[0], imagem: "blob:https://goatbar.vercel.app/expired" }]);
    expect(legacy[0].image).toBeNull();
  });

  it("5. Modo público sem token inicia jornada, captura lead e submete via submitPublicLeadRequest", async () => {
    const startSpy = vi.spyOn(budgetRequestService, "startPublicJourney").mockResolvedValue({
      state: "ACTIVE",
      public_drinks: sanitizePublicDrinks(mockPublicDrinks),
    });
    const submitPublicSpy = vi.spyOn(budgetRequestService, "submitPublicLeadRequest").mockResolvedValue({
      state: "USED",
      idempotent: false,
      event_id: "123e4567-e89b-42d3-a456-426614174000",
    });

    const { PublicBudgetRequestForm } = await import("@/components/public-budget/PublicBudgetRequestForm");
    render(<PublicBudgetRequestForm mode="public" />);

    await waitFor(() => {
      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Solicite seu orçamento")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Nome do solicitante/i), { target: { value: "Fernanda Costa" } });
    fireEvent.change(screen.getByLabelText(/WhatsApp/i), { target: { value: "(11) 97777-6666" } });
    fireEvent.change(screen.getByLabelText(/Nome do casal/i), { target: { value: "Lucas e Fernanda" } });
    fireEvent.change(screen.getByLabelText(/Data do evento/i), { target: { value: "2026-12-15" } });

    fireEvent.click(screen.getByRole("button", { name: /Solicitar orçamento/i }));

    await waitFor(() => {
      expect(submitPublicSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Solicitação recebida!")).toBeInTheDocument();
    });

    const submittedPublicPayload = submitPublicSpy.mock.calls[0][1];
    expect(submittedPublicPayload.event_name).toBe("Lucas e Fernanda");
  });

  it("abre a rota pública de nova solicitação com 6 horas no estado e envia 6 sem interação", async () => {
    vi.spyOn(budgetRequestService, "startPublicJourney").mockResolvedValue({
      state: "ACTIVE",
      public_drinks: [],
    });
    const submitPublicSpy = vi.spyOn(budgetRequestService, "submitPublicLeadRequest").mockResolvedValue({
      state: "USED",
      idempotent: false,
      event_id: "123e4567-e89b-42d3-a456-426614174000",
    });

    // This is the component registered for the real /orcamento/solicitar/ index route.
    const Component = (PublicRequestRoute as any).component;
    render(<Component />);

    await screen.findByText("Solicite seu orçamento");
    const duration = screen.getByLabelText(/Duração do evento/i) as HTMLSelectElement;

    expect(duration).toHaveValue("6");
    expect(duration.selectedOptions[0]).toHaveTextContent("6 horas");

    fireEvent.change(screen.getByLabelText(/Nome do solicitante/i), { target: { value: "Cliente Nova Solicitação" } });
    fireEvent.change(screen.getByLabelText(/WhatsApp/i), { target: { value: "(11) 97777-6666" } });
    fireEvent.change(screen.getByLabelText(/Nome do casal/i), { target: { value: "Ana e Beto" } });
    fireEvent.change(screen.getByLabelText(/Data do evento/i), { target: { value: "2026-12-15" } });
    fireEvent.click(screen.getByRole("button", { name: /Solicitar orçamento/i }));

    await waitFor(() => expect(submitPublicSpy).toHaveBeenCalledTimes(1));
    expect(submitPublicSpy.mock.calls[0][1].duration_hours).toBe(6);
  });

  it("permite alterar normalmente a duração da nova solicitação", async () => {
    vi.spyOn(budgetRequestService, "startPublicJourney").mockResolvedValue({
      state: "ACTIVE",
      public_drinks: [],
    });

    const Component = (PublicRequestRoute as any).component;
    render(<Component />);

    await screen.findByText("Solicite seu orçamento");
    const duration = screen.getByLabelText(/Duração do evento/i);

    fireEvent.change(duration, { target: { value: "5" } });
    expect(duration).toHaveValue("5");
    fireEvent.change(duration, { target: { value: "7" } });
    expect(duration).toHaveValue("7");
  });

  it("não mostra falso sucesso quando a API/RLS rejeita a persistência", async () => {
    vi.spyOn(budgetRequestService, "startPublicJourney").mockResolvedValue({
      state: "ACTIVE",
      public_drinks: [],
    });
    vi.spyOn(budgetRequestService, "submitPublicLeadRequest").mockRejectedValue(
      new Error("new row violates row-level security policy"),
    );
    const { PublicBudgetRequestForm } = await import("@/components/public-budget/PublicBudgetRequestForm");
    render(<PublicBudgetRequestForm mode="public" />);
    await screen.findByText("Solicite seu orçamento");
    fireEvent.change(screen.getByLabelText(/Nome do solicitante/i), { target: { value: "Cliente Teste" } });
    fireEvent.change(screen.getByLabelText(/WhatsApp/i), { target: { value: "(11) 97777-6666" } });
    fireEvent.change(screen.getByLabelText(/Nome do casal/i), { target: { value: "Ana e Beto" } });
    fireEvent.change(screen.getByLabelText(/Data do evento/i), { target: { value: "2026-12-15" } });
    fireEvent.click(screen.getByRole("button", { name: /Solicitar orçamento/i }));
    expect(await screen.findByText(/row-level security/i)).toBeInTheDocument();
    expect(screen.queryByText("Solicitação recebida!")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Nome do solicitante/i)).toHaveValue("Cliente Teste");
  });
});
