import { describe, expect, it } from "vitest";
import {
  calcularTotalOrcamentoComAdicionais,
  calcularTotalShots,
  calcularWelcomeDrinks,
  ADDITIONAL_COST_LABEL,
  normalizeAdditionalBudgetFields,
} from "./additional-budget-items";

const selection = (drinkId: string, cost: number) => ({
  drinkId,
  nameSnapshot: drinkId,
  unitCostSnapshot: cost,
});

describe("Welcome Drinks", () => {
  it("distribui custos diferentes igualmente", () => {
    const result = calcularWelcomeDrinks(100, 2, [selection("A", 4), selection("B", 10)], 0);
    expect(result.totalDrinks).toBe(200);
    expect(result.distribuicao.map((item) => item.quantidade)).toEqual([100, 100]);
    expect(result.custoTotal).toBe(1400);
  });
  it("preserva o total ao distribuir o resto", () => {
    const result = calcularWelcomeDrinks(
      101,
      1,
      [selection("A", 1), selection("B", 1), selection("C", 1)],
      0,
    );
    expect(result.distribuicao.map((item) => item.quantidade)).toEqual([34, 34, 33]);
    expect(result.distribuicao.reduce((sum, item) => sum + item.quantidade, 0)).toBe(101);
  });
  it("atribui tudo a um item e aplica lucro", () => {
    const result = calcularWelcomeDrinks(100, 1, [selection("A", 10)], 30);
    expect(result.custoTotal).toBe(1000);
    expect(result.valorFinal).toBe(1300);
  });
  it.each([
    [0, 2, [selection("A", 1)]],
    [10, 0, [selection("A", 1)]],
    [10, 2, []],
  ])("retorna zero sem consumo", (guests, perPerson, selected) => {
    const result = calcularWelcomeDrinks(guests, perPerson, selected, 30);
    expect(result.custoTotal).toBe(0);
    expect(Number.isNaN(result.valorFinal)).toBe(false);
  });
  it("mantém o snapshot após o catálogo mudar", () => {
    const snapshot = selection("A", 5);
    const catalog = { A: 9 };
    expect(catalog.A).toBe(9);
    expect(calcularWelcomeDrinks(1, 1, [snapshot], 0).custoTotal).toBe(5);
  });
});

describe("Shots e compatibilidade", () => {
  it("soma itens e neutraliza entradas inválidas", () => {
    expect(
      calcularTotalShots([
        { id: "1", nome: "Tequila", quantidade: 10, valorUnitario: 12 },
        { id: "2", nome: "Whisky", quantidade: 5, valorUnitario: 20 },
      ]),
    ).toBe(220);
    expect(
      calcularTotalShots([{ id: "x", nome: "x", quantidade: -2, valorUnitario: Number.NaN }]),
    ).toBe(0);
    expect(calcularTotalShots([])).toBe(0);
  });
  it("fornece defaults para versões antigas e total global", () => {
    expect(normalizeAdditionalBudgetFields({})).toMatchObject({
      hasWelcomeDrinks: false,
      welcomeDrinksSelected: [],
      hasShots: false,
      shotsItems: [],
    });
    expect(calcularTotalOrcamentoComAdicionais(1000, 1300, 220)).toBe(2520);
  });
});

describe("textos críticos", () => {
  it("mantém o novo rótulo em UTF-8 correto", () => {
    expect(ADDITIONAL_COST_LABEL).toBe("Custo Adicional");
  });
});
