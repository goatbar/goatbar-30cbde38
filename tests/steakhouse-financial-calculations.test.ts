import { describe, it, expect } from "vitest";
import {
  calculateSteakhouseItemFinancials,
  calculateSteakhouseSessionFinancials,
  resolveSteakhouseItemValues,
} from "@/lib/steakhouse-financials";
import { financialService } from "@/services/financial-service";

describe("Auditoria e Cálculos Financeiros da 7 Steak House", () => {
  const catalogMock = [
    {
      id: "drink-a",
      nome: "Drink A",
      custoUnitario: 5.5,
      modalityConfig: {
        steakhouse: { active: true, price: 32.0, cost: 16.76 },
        evento: { active: true, cost: 6.0 },
        goatbotequim: { active: true, price: 28.0, cost: 7.0 },
      },
    },
    {
      id: "drink-b",
      nome: "Drink B",
      custoUnitario: 7.0,
      modalityConfig: {
        steakhouse: { active: true, price: 35.0, cost: 20.5 },
        evento: { active: true, cost: 8.0 },
        goatbotequim: { active: true, price: 30.0, cost: 8.0 },
      },
    },
    {
      id: "drink-c",
      nome: "Drink C",
      custoUnitario: 4.0,
      modalityConfig: {
        steakhouse: { active: true, price: 40.0, cost: 22.5 },
        evento: { active: true, cost: 10.0 },
        goatbotequim: { active: true, price: 35.0, cost: 9.0 },
      },
    },
  ];

  // =========================================================================
  // CENÁRIO OBRIGATÓRIO DE VALIDAÇÃO
  // =========================================================================
  it("Cenário de Validação Explícito: 5x Drink A (32 / 16.76) + 10x Drink B (35 / 20.50)", () => {
    const session = {
      id: "sess-validacao",
      data: "2026-08-05",
      modalidade: "7Steakhouse",
      items: [
        { drinkId: "drink-a", nome: "Drink A", quantidade: 5, precoUnitario: 32.0, custoUnitario: 16.76, custoInsumo: 6.0 },
        { drinkId: "drink-b", nome: "Drink B", quantidade: 10, precoUnitario: 35.0, custoUnitario: 20.5, custoInsumo: 8.0 },
      ],
      maoDeObraValor: 100,
      maoDeObraQtd: 1,
    };

    const fin = calculateSteakhouseSessionFinancials(session, catalogMock);

    // 1. Valor Total Bruto = 5 * 32 + 10 * 35 = 160 + 350 = 510.00
    expect(fin.valorTotalBruto).toBe(510.0);

    // 2. Receita Goat Bar = 5 * 16.76 + 10 * 20.50 = 83.80 + 205.00 = 288.80
    expect(fin.receitaGoatBar).toBe(288.8);

    // 3. Valor Retido pelo Restaurante = 510.00 - 288.80 = 221.20
    expect(fin.valorRetidoRestaurante).toBe(221.2);

    // 4. Custo dos Insumos = 5 * 6.00 + 10 * 8.00 = 30.00 + 80.00 = 110.00
    expect(fin.custoInsumos).toBe(110.0);

    // 5. Mão de Obra Semanal = 100.00
    expect(fin.maoDeObraSemanal).toBe(100.0);

    // 6. Custo Operacional Goat Bar = Mão de Obra + Custo Insumos = 100 + 110 = 210.00
    expect(fin.custoOperacionalGoatBar).toBe(210.0);

    // 7. Lucro Final = Receita Goat Bar - Custo Operacional Goat Bar = 288.80 - 210.00 = 78.80
    expect(fin.lucroFinal).toBe(78.8);
  });

  // =========================================================================
  // CENÁRIO REAL: 5x Mojito (32 / 16.76 / 3.00) + 10x Aperol Spritz (35 / 20.50 / 10.50) com MO = 400.00
  // =========================================================================
  it("Cenário Real do Sistema: 5 Mojitos + 10 Aperol Spritz com Mão de Obra de R$ 400,00", () => {
    const realCatalog = [
      {
        id: "mojito",
        nome: "Mojito",
        custoUnitario: 3.0,
        modalityConfig: {
          steakhouse: { active: true, price: 32.0, cost: 16.76 },
          evento: { active: true, cost: 3.0 },
        },
      },
      {
        id: "aperol-spritz",
        nome: "Aperol Spritz",
        custoUnitario: 10.5,
        modalityConfig: {
          steakhouse: { active: true, price: 35.0, cost: 20.5 },
          evento: { active: true, cost: 10.5 },
        },
      },
    ];

    const session = {
      id: "sess-real",
      data: "2026-08-05",
      modalidade: "7Steakhouse",
      items: [
        { drinkId: "mojito", nome: "Mojito", quantidade: 5, precoUnitario: 32.0, custoUnitario: 16.76, custoInsumo: 3.0 },
        { drinkId: "aperol-spritz", nome: "Aperol Spritz", quantidade: 10, precoUnitario: 35.0, custoUnitario: 20.5, custoInsumo: 10.5 },
      ],
      maoDeObraValor: 200,
      maoDeObraQtd: 2, // Total R$ 400,00
    };

    const fin = calculateSteakhouseSessionFinancials(session, realCatalog);

    // 1. Valor Total Bruto: 5 * 32 + 10 * 35 = 160.00 + 350.00 = 510.00
    expect(fin.valorTotalBruto).toBe(510.0);

    // 2. Receita Goat Bar: 5 * 16.76 + 10 * 20.50 = 83.80 + 205.00 = 288.80
    expect(fin.receitaGoatBar).toBe(288.8);

    // 3. Valor Retido pelo Restaurante: 510.00 - 288.80 = 221.20
    expect(fin.valorRetidoRestaurante).toBe(221.2);

    // 4. Custo dos Insumos: 5 * 3.00 + 10 * 10.50 = 15.00 + 105.00 = 120.00 (ORIGEM EXATA DOS R$ 120,00)
    expect(fin.custoInsumos).toBe(120.0);

    // 5. Mão de Obra: 2 * 200.00 = 400.00 (ORIGEM EXATA DOS R$ 400,00)
    expect(fin.maoDeObraSemanal).toBe(400.0);

    // 6. Custo Operacional Goat Bar: 400.00 + 120.00 = 520.00
    expect(fin.custoOperacionalGoatBar).toBe(520.0);

    // 7. Lucro Final Goat Bar: 288.80 - 520.00 = -231.20 (ORIGEM EXATA DE -R$ 231,20)
    expect(fin.lucroFinal).toBe(-231.2);
  });

  // =========================================================================
  // 1. Vários drinks com quantidades diferentes
  // =========================================================================
  it("1. Vários drinks com quantidades diferentes", () => {
    const session = {
      items: [
        { drinkId: "drink-a", quantidade: 12, precoUnitario: 32, custoUnitario: 16.76, custoInsumo: 6 },
        { drinkId: "drink-b", quantidade: 7, precoUnitario: 35, custoUnitario: 20.5, custoInsumo: 8 },
        { drinkId: "drink-c", quantidade: 3, precoUnitario: 40, custoUnitario: 22.5, custoInsumo: 10 },
      ],
      maoDeObraValor: 0,
      maoDeObraQtd: 0,
    };

    const fin = calculateSteakhouseSessionFinancials(session, catalogMock);

    expect(fin.totalDrinks).toBe(22);
    expect(fin.valorTotalBruto).toBe(12 * 32 + 7 * 35 + 3 * 40); // 384 + 245 + 120 = 749.00
    expect(fin.receitaGoatBar).toBe(Math.round((12 * 16.76 + 7 * 20.5 + 3 * 22.5) * 100) / 100); // 201.12 + 143.5 + 67.5 = 412.12
    expect(fin.custoInsumos).toBe(12 * 6 + 7 * 8 + 3 * 10); // 72 + 56 + 30 = 158.00
  });

  // =========================================================================
  // 2. Cálculo do valor bruto
  // =========================================================================
  it("2. Cálculo do valor bruto", () => {
    const session = {
      items: [
        { drinkId: "drink-a", quantidade: 20, precoUnitario: 32.5 },
      ],
    };
    const fin = calculateSteakhouseSessionFinancials(session, catalogMock);
    expect(fin.valorTotalBruto).toBe(650.0);
  });

  // =========================================================================
  // 3. Cálculo da receita Goat Bar pelo custo operacional Steak House
  // =========================================================================
  it("3. Receita Goat Bar é calculada estritamente pelo custo operacional 7 Steak House", () => {
    const session = {
      items: [
        { drinkId: "drink-a", quantidade: 10, precoUnitario: 99.0, custoUnitario: 16.76, custoInsumo: 2.0 },
      ],
    };
    const fin = calculateSteakhouseSessionFinancials(session, catalogMock);
    // Deve ser 10 * 16.76 = 167.60, independente do precoUnitario (99) ou custoInsumo (2)
    expect(fin.receitaGoatBar).toBe(167.6);
  });

  // =========================================================================
  // 4. Cálculo da retenção do restaurante
  // =========================================================================
  it("4. Retenção do restaurante é exatamente Valor Total Bruto - Receita Goat Bar", () => {
    const session = {
      items: [
        { drinkId: "drink-a", quantidade: 10, precoUnitario: 32.0, custoUnitario: 16.76, custoInsumo: 6.0 },
      ],
    };
    const fin = calculateSteakhouseSessionFinancials(session, catalogMock);
    // Bruto = 320.00, Receita Goat = 167.60, Retido = 152.40
    expect(fin.valorTotalBruto).toBe(320.0);
    expect(fin.receitaGoatBar).toBe(167.6);
    expect(fin.valorRetidoRestaurante).toBe(152.4);
    expect(fin.valorRetidoRestaurante).toBe(fin.valorTotalBruto - fin.receitaGoatBar);
  });

  // =========================================================================
  // 5. Cálculo dos insumos pelo custo Evento
  // =========================================================================
  it("5. Custo dos insumos usa exclusivamente o custo da modalidade Evento", () => {
    const session = {
      items: [
        { drinkId: "drink-b", quantidade: 15, precoUnitario: 35.0, custoUnitario: 20.5, custoInsumo: 8.0 },
      ],
    };
    const fin = calculateSteakhouseSessionFinancials(session, catalogMock);
    // 15 * 8.0 = 120.00 (NÃO 15 * 35 nem 15 * 20.5)
    expect(fin.custoInsumos).toBe(120.0);
  });

  // =========================================================================
  // 6. Inclusão da mão de obra
  // =========================================================================
  it("6. Inclusão da mão de obra (por detalhes ou valor/qtd)", () => {
    const sessionWithDetails = {
      items: [{ drinkId: "drink-a", quantidade: 10, precoUnitario: 32.0, custoUnitario: 16.76, custoInsumo: 6.0 }],
      maoDeObraDetalhes: [
        { data: "2026-08-05", valor: 150 },
        { data: "2026-08-06", valor: 180 },
      ],
    };
    const fin1 = calculateSteakhouseSessionFinancials(sessionWithDetails, catalogMock);
    expect(fin1.maoDeObraSemanal).toBe(330.0);
    expect(fin1.custoOperacionalGoatBar).toBe(330.0 + 60.0); // 390.00

    const sessionWithValQtd = {
      items: [{ drinkId: "drink-a", quantidade: 10, precoUnitario: 32.0, custoUnitario: 16.76, custoInsumo: 6.0 }],
      maoDeObraValor: 200,
      maoDeObraQtd: 2,
    };
    const fin2 = calculateSteakhouseSessionFinancials(sessionWithValQtd, catalogMock);
    expect(fin2.maoDeObraSemanal).toBe(400.0);
    expect(fin2.custoOperacionalGoatBar).toBe(400.0 + 60.0); // 460.00
  });

  // =========================================================================
  // 7. Lucro positivo
  // =========================================================================
  it("7. Lucro positivo quando Receita Goat Bar > Custo Operacional", () => {
    const session = {
      items: [
        { drinkId: "drink-a", quantidade: 50, precoUnitario: 32.0, custoUnitario: 16.76, custoInsumo: 6.0 },
      ],
      maoDeObraValor: 200,
      maoDeObraQtd: 1,
    };
    const fin = calculateSteakhouseSessionFinancials(session, catalogMock);
    // Receita Goat = 50 * 16.76 = 838.00
    // Custo Insumos = 50 * 6.00 = 300.00
    // Mão de Obra = 200.00
    // Lucro Final = 838 - 300 - 200 = 338.00 > 0
    expect(fin.lucroFinal).toBe(338.0);
    expect(fin.lucroFinal).toBeGreaterThan(0);
  });

  // =========================================================================
  // 8. Lucro negativo
  // =========================================================================
  it("8. Lucro negativo quando Mão de Obra + Insumos excedem Receita Goat Bar", () => {
    const session = {
      items: [
        { drinkId: "drink-a", quantidade: 5, precoUnitario: 32.0, custoUnitario: 16.76, custoInsumo: 6.0 },
      ],
      maoDeObraValor: 500,
      maoDeObraQtd: 1,
    };
    const fin = calculateSteakhouseSessionFinancials(session, catalogMock);
    // Receita Goat = 5 * 16.76 = 83.80
    // Insumos = 30.00, Mão de Obra = 500.00 -> Custo Op = 530.00
    // Lucro Final = 83.80 - 530.00 = -446.20 < 0
    expect(fin.lucroFinal).toBe(-446.2);
    expect(fin.lucroFinal).toBeLessThan(0);
  });

  // =========================================================================
  // 9. Quantidade zero
  // =========================================================================
  it("9. Quantidade zero lida com segurança", () => {
    const session = {
      items: [
        { drinkId: "drink-a", quantidade: 0, precoUnitario: 32.0, custoUnitario: 16.76, custoInsumo: 6.0 },
      ],
      maoDeObraValor: 0,
      maoDeObraQtd: 0,
    };
    const fin = calculateSteakhouseSessionFinancials(session, catalogMock);
    expect(fin.totalDrinks).toBe(0);
    expect(fin.valorTotalBruto).toBe(0);
    expect(fin.receitaGoatBar).toBe(0);
    expect(fin.valorRetidoRestaurante).toBe(0);
    expect(fin.custoInsumos).toBe(0);
    expect(fin.lucroFinal).toBe(0);
  });

  // =========================================================================
  // 10. Valores decimais
  // =========================================================================
  it("10. Precisão em cálculos com decimais", () => {
    const session = {
      items: [
        { drinkId: "drink-a", quantidade: 7, precoUnitario: 32.33, custoUnitario: 16.79, custoInsumo: 6.13 },
      ],
      maoDeObraValor: 125.45,
      maoDeObraQtd: 1,
    };
    const fin = calculateSteakhouseSessionFinancials(session, catalogMock);
    expect(fin.valorTotalBruto).toBe(226.31); // 7 * 32.33
    expect(fin.receitaGoatBar).toBe(117.53); // 7 * 16.79
    expect(fin.valorRetidoRestaurante).toBe(108.78); // 226.31 - 117.53
    expect(fin.custoInsumos).toBe(42.91); // 7 * 6.13
    expect(fin.custoOperacionalGoatBar).toBe(168.36); // 125.45 + 42.91
    expect(fin.lucroFinal).toBe(-50.83); // 117.53 - 168.36
  });

  // =========================================================================
  // 11. Sessão sem mão de obra
  // =========================================================================
  it("11. Sessão sem mão de obra calcula lucro como Receita Goat - Insumos", () => {
    const session = {
      items: [
        { drinkId: "drink-a", quantidade: 10, precoUnitario: 32.0, custoUnitario: 16.76, custoInsumo: 6.0 },
      ],
      maoDeObraValor: 0,
      maoDeObraQtd: 0,
    };
    const fin = calculateSteakhouseSessionFinancials(session, catalogMock);
    expect(fin.maoDeObraSemanal).toBe(0);
    expect(fin.custoOperacionalGoatBar).toBe(60.0);
    expect(fin.lucroFinal).toBe(107.6); // 167.60 - 60.00
  });

  // =========================================================================
  // 12. Alterar steakhouse.price não altera receitaGoatBar
  // =========================================================================
  it("12. Alterar steakhouse.price NÃO altera receitaGoatBar", () => {
    const sessionWithPrice1 = {
      items: [{ drinkId: "drink-a", quantidade: 10, precoUnitario: 32.0, custoUnitario: 16.76, custoInsumo: 6.0 }],
    };
    const sessionWithPrice2 = {
      items: [{ drinkId: "drink-a", quantidade: 10, precoUnitario: 50.0, custoUnitario: 16.76, custoInsumo: 6.0 }],
    };

    const fin1 = calculateSteakhouseSessionFinancials(sessionWithPrice1, catalogMock);
    const fin2 = calculateSteakhouseSessionFinancials(sessionWithPrice2, catalogMock);

    expect(fin1.receitaGoatBar).toBe(167.6);
    expect(fin2.receitaGoatBar).toBe(167.6);
    expect(fin1.receitaGoatBar).toBe(fin2.receitaGoatBar);
    // Mas altera o valor retido pelo restaurante:
    expect(fin1.valorRetidoRestaurante).toBe(152.4);
    expect(fin2.valorRetidoRestaurante).toBe(332.4);
  });

  // =========================================================================
  // 13. Alterar evento.cost não altera receitaGoatBar
  // =========================================================================
  it("13. Alterar evento.cost NÃO altera receitaGoatBar", () => {
    const sessionWithEventCost1 = {
      items: [{ drinkId: "drink-a", quantidade: 10, precoUnitario: 32.0, custoUnitario: 16.76, custoInsumo: 4.0 }],
    };
    const sessionWithEventCost2 = {
      items: [{ drinkId: "drink-a", quantidade: 10, precoUnitario: 32.0, custoUnitario: 16.76, custoInsumo: 12.0 }],
    };

    const fin1 = calculateSteakhouseSessionFinancials(sessionWithEventCost1, catalogMock);
    const fin2 = calculateSteakhouseSessionFinancials(sessionWithEventCost2, catalogMock);

    expect(fin1.receitaGoatBar).toBe(167.6);
    expect(fin2.receitaGoatBar).toBe(167.6);
    // Mas altera o custo dos insumos e o lucro final:
    expect(fin1.custoInsumos).toBe(40.0);
    expect(fin2.custoInsumos).toBe(120.0);
    expect(fin1.lucroFinal).toBe(127.6);
    expect(fin2.lucroFinal).toBe(47.6);
  });

  // =========================================================================
  // 14. Alterar steakhouse.cost altera receitaGoatBar
  // =========================================================================
  it("14. Alterar steakhouse.cost altera diretamente a receitaGoatBar", () => {
    const sessionWithSteakCost1 = {
      items: [{ drinkId: "drink-a", quantidade: 10, precoUnitario: 32.0, custoUnitario: 16.76, custoInsumo: 6.0 }],
    };
    const sessionWithSteakCost2 = {
      items: [{ drinkId: "drink-a", quantidade: 10, precoUnitario: 32.0, custoUnitario: 20.0, custoInsumo: 6.0 }],
    };

    const fin1 = calculateSteakhouseSessionFinancials(sessionWithSteakCost1, catalogMock);
    const fin2 = calculateSteakhouseSessionFinancials(sessionWithSteakCost2, catalogMock);

    expect(fin1.receitaGoatBar).toBe(167.6);
    expect(fin2.receitaGoatBar).toBe(200.0);
    expect(fin2.receitaGoatBar).not.toBe(fin1.receitaGoatBar);
  });

  // =========================================================================
  // 15. Snapshots históricos permanecem imutáveis quando catálogo muda
  // =========================================================================
  it("15. Snapshots gravados na sessão histórica prevalecem sobre alterações posteriores do catálogo", () => {
    const historicalSession = {
      id: "hist-1",
      data: "2026-04-10",
      modalidade: "7Steakhouse",
      items: [
        {
          drinkId: "drink-a",
          nome: "Drink A",
          quantidade: 10,
          precoUnitario: 32.0, // salvo no dia do lançamento
          custoUnitario: 16.76, // salvo no dia do lançamento
          custoInsumo: 6.0, // salvo no dia do lançamento
        },
      ],
      maoDeObraValor: 50,
      maoDeObraQtd: 1,
    };

    // Catálogo futuro reajustado
    const updatedFutureCatalog = [
      {
        id: "drink-a",
        nome: "Drink A",
        custoUnitario: 12.0,
        modalityConfig: {
          steakhouse: { active: true, price: 50.0, cost: 28.0 },
          evento: { active: true, cost: 15.0 },
        },
      },
    ];

    const fin = calculateSteakhouseSessionFinancials(historicalSession, updatedFutureCatalog);

    // Deve respeitar os valores salvos (32 / 16.76 / 6) e NÃO os valores do catálogo futuro (50 / 28 / 15)
    expect(fin.valorTotalBruto).toBe(320.0);
    expect(fin.receitaGoatBar).toBe(167.6);
    expect(fin.valorRetidoRestaurante).toBe(152.4);
    expect(fin.custoInsumos).toBe(60.0);
    expect(fin.lucroFinal).toBe(57.6); // 167.60 - 60.00 - 50.00
  });

  // =========================================================================
  // 16. Margem de Contribuição no nível do drink
  // =========================================================================
  it("16. Drink calcula margemContribuicao (Receita Goat - Insumos) e não lucro individual", () => {
    const item = {
      drinkId: "drink-a",
      quantidade: 5,
      precoUnitario: 32.0,
      custoUnitario: 16.76,
      custoInsumo: 6.0,
    };

    const itemFin = calculateSteakhouseItemFinancials(item, catalogMock);

    expect(itemFin.valorTotalBruto).toBe(160.0);
    expect(itemFin.receitaGoatBar).toBe(83.8);
    expect(itemFin.custoInsumos).toBe(30.0);
    expect(itemFin.margemContribuicao).toBe(53.8); // 83.80 - 30.00
  });

  // =========================================================================
  // 17. Reposição Restaurante NÃO deduz de Custo Operacional nem Lucro Goat Bar
  // =========================================================================
  it("17. Reposição Restaurante é informativa e NÃO deduz do Custo Operacional nem Lucro Final", () => {
    const sessionWithReposicao = {
      items: [
        { drinkId: "drink-a", quantidade: 10, precoUnitario: 32.0, custoUnitario: 16.76, custoInsumo: 6.0 },
      ],
      maoDeObraValor: 50,
      maoDeObraQtd: 1,
      reposicaoRestaurante: 150.0,
      custosRestauranteDetalhes: [{ descricao: "Limão e gelo", valor: 150.0 }],
    };

    const fin = calculateSteakhouseSessionFinancials(sessionWithReposicao, catalogMock);

    expect(fin.reposicaoRestaurante).toBe(150.0);
    // Custo Operacional Goat Bar deve ser apenas Mão de Obra (50) + Insumos (60) = 110.00
    expect(fin.custoOperacionalGoatBar).toBe(110.0);
    // Lucro Final deve ser Receita Goat Bar (167.60) - 110.00 = 57.60
    expect(fin.lucroFinal).toBe(57.6);
  });

  // =========================================================================
  // 18. Integração com financialService.calculateMetrics
  // =========================================================================
  it("18. financialService.calculateMetrics calcula métricas consolidadas da Steakhouse corretamente", () => {
    const sessions = [
      {
        id: "s1",
        data: "2026-08-01",
        modalidade: "7Steakhouse",
        items: [
          { drinkId: "drink-a", quantidade: 5, precoUnitario: 32.0, custoUnitario: 16.76, custoInsumo: 6.0 },
          { drinkId: "drink-b", quantidade: 10, precoUnitario: 35.0, custoUnitario: 20.5, custoInsumo: 8.0 },
        ],
        maoDeObraValor: 100,
        maoDeObraQtd: 1,
      },
    ];

    const metrics = financialService.calculateMetrics(sessions, [], catalogMock);

    expect(metrics.steak.receita).toBe(288.8);
    expect(metrics.steak.custo).toBe(110.0); // Custo Insumos
    expect(metrics.steak.lucro).toBe(78.8); // 288.80 - 110.00 - 100.00
    expect(metrics.consolidated.receita).toBe(288.8);
    expect(metrics.consolidated.lucro).toBe(78.8);
  });
});
