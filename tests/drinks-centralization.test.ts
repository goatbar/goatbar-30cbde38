import { describe, it, expect } from "vitest";
import {
  resolveCanonicalUnit,
  getDrinksForUnit,
  isDrinkAvailableForUnit,
  getDrinkPriceForUnit,
  getDrinkCostForUnit,
  buildDrinkSnapshot,
  hydrateDrinkNames,
  type CanonicalDrink,
} from "../src/lib/drinks-canonical";
import { calcularOrcamentoEvento, type Evento } from "../src/lib/mock-data";
import { financialService } from "../src/services/financial-service";
import { resolveDrinkMatch } from "../supabase/functions/_shared/goat-ai/matchers/drink-matcher";

describe("Centralização de Drinks e Sincronização por Unidade", () => {
  const sampleDrinks: CanonicalDrink[] = [
    {
      id: "drink-steak-only",
      nome: "Smoked Bourbon",
      categoria: "Whisky",
      custoUnitario: 8.5,
      status: "ativo",
      modalityConfig: {
        steakhouse: { active: true, price: 35.0, cost: 8.5 },
        goatbotequim: { active: false, price: 0, cost: 0 },
        evento: { active: false, cost: 0 },
      },
    },
    {
      id: "drink-botequim-steak",
      nome: "Caipirinha Clássica",
      categoria: "Cachaça",
      custoUnitario: 4.2,
      status: "ativo",
      modalityConfig: {
        steakhouse: { active: true, price: 28.0, cost: 5.0 },
        goatbotequim: { active: true, price: 22.0, cost: 4.2 },
        evento: { active: false, cost: 0 },
      },
    },
    {
      id: "drink-all-units",
      nome: "Gin Tropical",
      categoria: "Gin",
      custoUnitario: 6.0,
      status: "ativo",
      modalityConfig: {
        steakhouse: { active: true, price: 34.0, cost: 6.5 },
        goatbotequim: { active: true, price: 30.0, cost: 6.0 },
        evento: { active: true, cost: 6.0 },
      },
    },
    {
      id: "drink-event-only",
      nome: "Welcome Mimosa",
      categoria: "Espumante",
      custoUnitario: 7.0,
      status: "ativo",
      modalityConfig: {
        steakhouse: { active: false, price: 0, cost: 0 },
        goatbotequim: { active: false, price: 0, cost: 0 },
        evento: { active: true, cost: 7.0 },
      },
    },
    {
      id: "drink-inactive",
      nome: "Drink Antigo Descontinuado",
      categoria: "Vodka",
      custoUnitario: 5.0,
      status: "inativo",
      modalityConfig: {
        steakhouse: { active: true, price: 20.0, cost: 5.0 },
        goatbotequim: { active: true, price: 20.0, cost: 5.0 },
        evento: { active: true, cost: 5.0 },
      },
    },
  ];

  // =========================================================================
  // CENÁRIO A: Drink cadastrado para 1 unidade específica
  // =========================================================================
  it("Cenário A: Drink vinculado somente ao 7 Steak House aparece lá e não em Botequim nem Eventos", () => {
    const steakDrinks = getDrinksForUnit(sampleDrinks, "7Steakhouse");
    const botequimDrinks = getDrinksForUnit(sampleDrinks, "Goat Botequim");
    const eventoDrinks = getDrinksForUnit(sampleDrinks, "eventos");

    expect(steakDrinks.some((d) => d.id === "drink-steak-only")).toBe(true);
    expect(botequimDrinks.some((d) => d.id === "drink-steak-only")).toBe(false);
    expect(eventoDrinks.some((d) => d.id === "drink-steak-only")).toBe(false);

    expect(isDrinkAvailableForUnit(sampleDrinks[0], "7Steakhouse")).toBe(true);
    expect(isDrinkAvailableForUnit(sampleDrinks[0], "Goat Botequim")).toBe(false);
    expect(isDrinkAvailableForUnit(sampleDrinks[0], "eventos")).toBe(false);
  });

  // =========================================================================
  // CENÁRIO B: Drink vinculado a 2 unidades
  // =========================================================================
  it("Cenário B: Drink vinculado a 7 Steak House e Goat Botequim aparece em ambos e não em Eventos", () => {
    const steakDrinks = getDrinksForUnit(sampleDrinks, "7Steakhouse");
    const botequimDrinks = getDrinksForUnit(sampleDrinks, "Goat Botequim");
    const eventoDrinks = getDrinksForUnit(sampleDrinks, "eventos");

    expect(steakDrinks.some((d) => d.id === "drink-botequim-steak")).toBe(true);
    expect(botequimDrinks.some((d) => d.id === "drink-botequim-steak")).toBe(true);
    expect(eventoDrinks.some((d) => d.id === "drink-botequim-steak")).toBe(false);

    // Preços específicos por unidade
    expect(getDrinkPriceForUnit(sampleDrinks[1], "7Steakhouse")).toBe(28.0);
    expect(getDrinkPriceForUnit(sampleDrinks[1], "Goat Botequim")).toBe(22.0);
  });

  // =========================================================================
  // CENÁRIO C: Drink vinculado a todas as unidades
  // =========================================================================
  it("Cenário C: Drink vinculado a todas as unidades aparece em todos os módulos", () => {
    const steakDrinks = getDrinksForUnit(sampleDrinks, "7Steakhouse");
    const botequimDrinks = getDrinksForUnit(sampleDrinks, "Goat Botequim");
    const eventoDrinks = getDrinksForUnit(sampleDrinks, "eventos");

    expect(steakDrinks.some((d) => d.id === "drink-all-units")).toBe(true);
    expect(botequimDrinks.some((d) => d.id === "drink-all-units")).toBe(true);
    expect(eventoDrinks.some((d) => d.id === "drink-all-units")).toBe(true);
  });

  // =========================================================================
  // CENÁRIO D: Desvinculação de drink de uma unidade
  // =========================================================================
  it("Cenário D: Desvincular drink de uma unidade remove-o imediatamente dessa unidade", () => {
    const updatedDrink: CanonicalDrink = {
      ...sampleDrinks[1], // Caipirinha Clássica
      modalityConfig: {
        ...sampleDrinks[1].modalityConfig,
        steakhouse: { active: false, price: 28.0, cost: 5.0 },
      },
    };

    const modifiedCatalog = [updatedDrink, ...sampleDrinks.slice(2)];
    const steakDrinks = getDrinksForUnit(modifiedCatalog, "7Steakhouse");
    const botequimDrinks = getDrinksForUnit(modifiedCatalog, "Goat Botequim");

    expect(steakDrinks.some((d) => d.id === "drink-botequim-steak")).toBe(false);
    expect(botequimDrinks.some((d) => d.id === "drink-botequim-steak")).toBe(true);
  });

  // =========================================================================
  // CENÁRIO E: Inativação global do drink
  // =========================================================================
  it("Cenário E: Drink com status inativo não aparece em nenhuma unidade para novos usos", () => {
    const steakDrinks = getDrinksForUnit(sampleDrinks, "7Steakhouse");
    const botequimDrinks = getDrinksForUnit(sampleDrinks, "Goat Botequim");
    const eventoDrinks = getDrinksForUnit(sampleDrinks, "eventos");

    expect(steakDrinks.some((d) => d.id === "drink-inactive")).toBe(false);
    expect(botequimDrinks.some((d) => d.id === "drink-inactive")).toBe(false);
    expect(eventoDrinks.some((d) => d.id === "drink-inactive")).toBe(false);
  });

  // =========================================================================
  // CENÁRIO F: Preservação de snapshots em Vendas históricas
  // =========================================================================
  it("Cenário F: Alteração de preço no catálogo de drinks não contamina o histórico de vendas", () => {
    // Sessão histórica com preço unitário salvo R$ 25,00
    const historicalSessions = [
      {
        id: "sess-1",
        data: "2026-01-15",
        modalidade: "Goat Botequim",
        items: [
          {
            drinkId: "drink-all-units",
            nome: "Gin Tropical",
            quantidade: 10,
            precoUnitario: 25.0, // preço no dia da venda
            custoUnitario: 5.0,
            custoInsumo: 5.0,
          },
        ],
      },
    ];

    // Catálogo atual com preço alterado para R$ 35,00
    const currentCatalog = [
      {
        ...sampleDrinks[2],
        modalityConfig: {
          ...sampleDrinks[2].modalityConfig,
          goatbotequim: { active: true, price: 35.0, cost: 8.0 },
        },
      },
    ];

    const metrics = financialService.calculateMetrics(historicalSessions, [], currentCatalog as any);

    // A receita bruta deve ser 10 * 25 = 250, NUNCA 10 * 35 = 350
    expect(metrics.bot.receita).toBe(250.0);
    expect(metrics.bot.custo).toBe(50.0); // 10 * 5.0 = 50
    expect(metrics.bot.lucro).toBe(120.0); // (250 - 50) * 0.6 = 120 (regra 60% Botequim)
  });

  // =========================================================================
  // CENÁRIO G: Evento salvo com drinks não sofre alteração retroativa quando custo do catálogo muda
  // =========================================================================
  it("Cenário G: Reajuste no catálogo não altera o cálculo de evento histórico com snapshot", () => {
    const historicalEvent: Evento = {
      id: "ev-100",
      nome: "Casamento Ana e João",
      cliente: "Ana",
      data: "2026-06-20",
      convidados: 100,
      drinksPorPessoa: 4, // 400 doses
      markupAdicionalDrinks: 0,
      drinks: ["drink-all-units"],
      drinksSnapshots: [
        {
          drinkId: "drink-all-units",
          nome: "Gin Tropical",
          custoUnitario: 6.0, // custo congelado no fechamento do orçamento
        },
      ],
      equipe: {
        bartender: { qtd: 2, valorUnitario: 250 },
        keeper: { qtd: 1, valorUnitario: 200 },
        copeira: { qtd: 1, valorUnitario: 150 },
      },
      gelo: { valorUnitario: 6 },
      viagem: { incluir: false, valor: 0 },
      coposVinculados: {},
      historicoAlteracoes: [],
      historicoNegociacao: [],
    };

    // Catálogo sofre inflação e o drink passa a custar R$ 12,00
    const inflatedCatalog = [
      {
        ...sampleDrinks[2],
        custoUnitario: 12.0,
      },
    ];

    const calc = calcularOrcamentoEvento(historicalEvent, inflatedCatalog as any);
    expect(calc).not.toBeNull();

    // 400 doses * R$ 6.00 = R$ 2.400,00 (preservado pelo snapshot)
    expect(calc?.valorDrinksEvento).toBe(2400.0);
    expect(calc?.mediaCustoDrinks).toBe(6.0);
  });

  // =========================================================================
  // CENÁRIO H: Edição de variáveis operacionais preserva snapshots de drinks
  // =========================================================================
  it("Cenário H: Alterar número de convidados recalcula o volume mantendo o custo unitário congelado", () => {
    const historicalEvent: Evento = {
      id: "ev-101",
      nome: "Aniversário Pedro",
      cliente: "Pedro",
      data: "2026-07-10",
      convidados: 50,
      drinksPorPessoa: 4, // 200 doses
      markupAdicionalDrinks: 0,
      drinks: ["drink-all-units"],
      drinksSnapshots: [
        {
          drinkId: "drink-all-units",
          nome: "Gin Tropical",
          custoUnitario: 6.0,
        },
      ],
      equipe: {},
      gelo: { valorUnitario: 6 },
      viagem: { incluir: false, valor: 0 },
      coposVinculados: {},
      historicoAlteracoes: [],
      historicoNegociacao: [],
    };

    // Aumenta convidados de 50 para 80 sem trocar drinks
    const updatedGuestsEvent: Evento = {
      ...historicalEvent,
      convidados: 80, // 320 doses
    };

    const currentCatalogWithDifferentPrice = [
      {
        ...sampleDrinks[2],
        custoUnitario: 15.0,
      },
    ];

    const calc = calcularOrcamentoEvento(updatedGuestsEvent, currentCatalogWithDifferentPrice as any);
    // 320 doses * R$ 6.00 = R$ 1.920,00
    expect(calc?.valorDrinksEvento).toBe(1920.0);
    expect(calc?.mediaCustoDrinks).toBe(6.0);
  });

  // =========================================================================
  // CENÁRIO I: Remoção e re-adição explícita de drink busca o preço vigente
  // =========================================================================
  it("Cenário I: Adicionar novo drink ou re-adicionar drink busca o custo do catálogo vigente", () => {
    const updatedCatalog: CanonicalDrink[] = [
      {
        id: "drink-new-price",
        nome: "Negroni Especial",
        categoria: "Gin",
        custoUnitario: 10.0,
        status: "ativo",
        modalityConfig: {
          evento: { active: true, cost: 10.0 },
        },
      },
    ];

    // Criar snapshot fresco para a nova adição
    const freshSnapshot = buildDrinkSnapshot(updatedCatalog[0], "eventos");
    expect(freshSnapshot.unit_cost).toBe(10.0);

    const eventWithNewDrink: Evento = {
      id: "ev-102",
      nome: "Festa Corporativa",
      cliente: "Empresa X",
      data: "2026-08-15",
      convidados: 100,
      drinksPorPessoa: 4,
      markupAdicionalDrinks: 0,
      drinks: ["drink-new-price"],
      drinksSnapshots: [
        {
          drinkId: freshSnapshot.drink_id,
          nome: freshSnapshot.name,
          custoUnitario: freshSnapshot.unit_cost,
        },
      ],
      equipe: {},
      gelo: { valorUnitario: 6 },
      viagem: { incluir: false, valor: 0 },
      coposVinculados: {},
      historicoAlteracoes: [],
      historicoNegociacao: [],
    };

    const calc = calcularOrcamentoEvento(eventWithNewDrink, updatedCatalog as any);
    expect(calc?.valorDrinksEvento).toBe(4000.0); // 400 doses * 10 = 4000
    expect(calc?.mediaCustoDrinks).toBe(10.0);
  });

  // =========================================================================
  // CENÁRIO J: GIA / WhatsApp consultando cardápio por unidade
  // =========================================================================
  it("Cenário J: Matcher e catálogo para GIA filtram apenas drinks ativos da unidade", () => {
    const matchSteak = resolveDrinkMatch({
      inputName: "Smoked Bourbon",
      businessUnit: "7Steakhouse",
      catalog: sampleDrinks,
    });
    expect(matchSteak.matched).toBe(true);
    expect(matchSteak.drinkId).toBe("drink-steak-only");

    // O mesmo drink NÃO pode dar match para Goat Botequim porque não está ativo nessa unidade
    const matchBotequim = resolveDrinkMatch({
      inputName: "Smoked Bourbon",
      businessUnit: "Goat Botequim",
      catalog: sampleDrinks,
    });
    expect(matchBotequim.matched).toBe(false);
  });

  // =========================================================================
  // CENÁRIO K: Resolução de nomes e hidratação de cardápio para contratos
  // =========================================================================
  it("Cenário K: hydrateDrinkNames converte IDs e snapshots em nomes oficiais limpos", () => {
    const selectedDrinksWithSnapshots = {
      ids: ["drink-steak-only", "drink-all-units"],
      items: [
        { drink_id: "drink-steak-only", name: "Smoked Bourbon Especial", unit_cost: 8.5 },
        { drink_id: "drink-all-units", name: "Gin Tropical Premium", unit_cost: 6.0 },
      ],
    };

    const names = hydrateDrinkNames(selectedDrinksWithSnapshots, sampleDrinks);
    expect(names).toEqual(["Smoked Bourbon Especial", "Gin Tropical Premium"]);

    // Fallback legado com array de IDs
    const legacyNames = hydrateDrinkNames(["drink-steak-only", "drink-all-units"], sampleDrinks);
    expect(legacyNames).toEqual(["Smoked Bourbon", "Gin Tropical"]);
  });

  // =========================================================================
  // CENÁRIO L: Snapshot estruturado em selected_drinks.items
  // =========================================================================
  it("Cenário L: selected_drinks.items permite reconstruir lançamentos de forma determinística e autossuficiente", () => {
    const draftDrinks = ["drink-all-units", "drink-event-only"];
    const builtSnapshots = draftDrinks.map((dId) => {
      const d = sampleDrinks.find((x) => x.id === dId)!;
      return buildDrinkSnapshot(d, "eventos", "copo-1", "Taça Gin");
    });

    expect(builtSnapshots).toHaveLength(2);
    expect(builtSnapshots[0]).toEqual({
      drink_id: "drink-all-units",
      name: "Gin Tropical",
      unit_cost: 6.0,
      unit_price: undefined,
      glassware_id: "copo-1",
      glassware_name: "Taça Gin",
    });
    expect(builtSnapshots[1]).toEqual({
      drink_id: "drink-event-only",
      name: "Welcome Mimosa",
      unit_cost: 7.0,
      unit_price: undefined,
      glassware_id: "copo-1",
      glassware_name: "Taça Gin",
    });
  });
});
