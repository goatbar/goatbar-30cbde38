import { describe, expect, it } from "vitest";
import {
  compareContractVersions,
  extractDrinksList,
  formatPortugueseList,
} from "./contract-addendum-comparator";

describe("compareContractVersions", () => {
  const baseV1 = {
    id: "v1",
    version_number: 1,
    final_budget_value: 8000,
    guest_count: 100,
    average_value_per_person: 80,
    selected_drinks: ["Moscow Mule", "Gin Tônica", "Caipirinha"],
    paid_value: 4000,
    payment_method: "PIX",
    pending_payment_date: "2026-11-01",
  };

  it("preserva R$ 3.400 pagos ao elevar contrato de R$ 6.800 para R$ 8.000", () => {
    const result = compareContractVersions(
      { final_budget_value: 6800, paid_value: 3400 },
      { final_budget_value: 8000 },
    );
    expect(result.valor_diferenca).toBe(1200);
    expect(result.valor_ja_pago).toBe(3400);
    expect(result.novo_saldo_restante).toBe(4600);
  });

  it("expõe crédito quando o pagamento supera o novo total", () => {
    const result = compareContractVersions({ final_budget_value: 8000, paid_value: 7000 }, { final_budget_value: 6000 });
    expect(result.novo_saldo_restante).toBe(0);
    expect(result.credito_cliente).toBe(1000);
  });

  it("detecta somente convidados e gera mudança estruturada", () => {
    const result = compareContractVersions({ ...baseV1, guest_count: 100 }, { ...baseV1, guest_count: 120 });
    expect(result.changes.map((change) => change.key)).toEqual(["guest_count"]);
    expect(result.guestCount).toMatchObject({ changed: true, previous: 100, current: 120 });
  });

  it("separa à vista, PIX e vencimento", () => {
    const result = compareContractVersions(baseV1, { ...baseV1, payment_method: "À vista via PIX", pending_payment_date: "15/09/2026" });
    expect(result.forma_pagamento_saldo).toBe("À vista");
    expect(result.meio_pagamento_saldo).toBe("PIX");
    expect(result.datas_vencimento).toEqual(["15/09/2026"]);
  });

  it("1. detecta quando ocorre somente alteração de drinks", () => {
    const updatedV2 = {
      ...baseV1,
      version_number: 2,
      selected_drinks: ["Moscow Mule", "Gin Tônica", "Fitzgerald"],
    };

    const res = compareContractVersions(baseV1, updatedV2);

    expect(res.requiresAddendum).toBe(true);
    expect(res.drinks.changed).toBe(true);
    expect(res.drinks.added).toEqual(["Fitzgerald"]);
    expect(res.drinks.removed).toEqual(["Caipirinha"]);
    expect(res.drinks.finalListText).toBe("Moscow Mule, Gin Tônica e Fitzgerald");
    expect(res.totalValue.changed).toBe(false);
    expect(res.extraGuestValue.changed).toBe(false);
  });

  it("2. detecta quando ocorre somente alteração de valor total", () => {
    const updatedV2 = {
      ...baseV1,
      version_number: 2,
      final_budget_value: 9500,
    };

    const res = compareContractVersions(baseV1, updatedV2);

    expect(res.requiresAddendum).toBe(true);
    expect(res.drinks.changed).toBe(false);
    expect(res.totalValue.changed).toBe(true);
    expect(res.totalValue.previous).toBe(8000);
    expect(res.totalValue.current).toBe(9500);
    expect(res.totalValue.difference).toBe(1500);
    expect(res.totalValue.currentWords).toBe("Nove mil quinhentos reais");
    expect(res.financial.remainingBalance).toBe(5500); // 9500 - 4000
  });

  it("3. detecta quando ocorre somente alteração do valor por convidado", () => {
    const updatedV2 = {
      ...baseV1,
      version_number: 2,
      average_value_per_person: 95,
    };

    const res = compareContractVersions(baseV1, updatedV2);

    expect(res.requiresAddendum).toBe(true);
    expect(res.extraGuestValue.changed).toBe(true);
    expect(res.extraGuestValue.previous).toBe(80);
    expect(res.extraGuestValue.current).toBe(95);
  });

  it("4. detecta alteração simultânea dos três", () => {
    const updatedV2 = {
      ...baseV1,
      version_number: 2,
      final_budget_value: 10000,
      average_value_per_person: 100,
      selected_drinks: ["Moscow Mule", "Gin Tônica", "Aperol Spritz"],
    };

    const res = compareContractVersions(baseV1, updatedV2);

    expect(res.requiresAddendum).toBe(true);
    expect(res.drinks.changed).toBe(true);
    expect(res.totalValue.changed).toBe(true);
    expect(res.extraGuestValue.changed).toBe(true);
  });

  it("5. calcula pagamentos parciais e saldo restante", () => {
    const updatedV2 = {
      ...baseV1,
      final_budget_value: 9500,
      paid_value: 4000,
    };

    const res = compareContractVersions(baseV1, updatedV2);

    expect(res.financial.currentTotal).toBe(9500);
    expect(res.financial.paidAmount).toBe(4000);
    expect(res.financial.remainingBalance).toBe(5500);
    expect(res.financial.hasExcessPaymentCredit).toBe(false);
  });

  it("6. calcula contrato totalmente pago", () => {
    const updatedV2 = {
      ...baseV1,
      final_budget_value: 8000,
      paid_value: 8000,
    };

    const res = compareContractVersions(baseV1, updatedV2);

    expect(res.financial.remainingBalance).toBe(0);
    expect(res.financial.hasExcessPaymentCredit).toBe(false);
  });

  it("7. detecta quando o novo valor total é menor que o anterior, mas ainda cobre o pago", () => {
    const updatedV2 = {
      ...baseV1,
      final_budget_value: 7000,
      paid_value: 4000,
    };

    const res = compareContractVersions(baseV1, updatedV2);

    expect(res.totalValue.changed).toBe(true);
    expect(res.totalValue.difference).toBe(-1000);
    expect(res.financial.remainingBalance).toBe(3000); // 7000 - 4000
    expect(res.financial.hasExcessPaymentCredit).toBe(false);
  });

  it("8. detecta e ativa o bloqueio quando paid_value > new_total (crédito/estorno)", () => {
    const updatedV2 = {
      ...baseV1,
      final_budget_value: 7000,
      paid_value: 8000,
    };

    const res = compareContractVersions(baseV1, updatedV2);

    expect(res.financial.hasExcessPaymentCredit).toBe(true);
    expect(res.financial.creditAmount).toBe(1000);
    expect(res.financial.remainingBalance).toBe(0);
  });

  it("9. retorna requiresAddendum = false quando nenhuma alteração contratual relevante ocorre", () => {
    const updatedV2 = {
      ...baseV1,
      version_number: 2,
      internal_notes: "Apenas uma nota interna alterada",
    };

    const res = compareContractVersions(baseV1, updatedV2);

    expect(res.requiresAddendum).toBe(false);
    expect(res.drinks.changed).toBe(false);
    expect(res.totalValue.changed).toBe(false);
    expect(res.extraGuestValue.changed).toBe(false);
  });

  it("10. formata lista em português corretamente", () => {
    expect(formatPortugueseList(["A"])).toBe("A");
    expect(formatPortugueseList(["A", "B"])).toBe("A e B");
    expect(formatPortugueseList(["A", "B", "C"])).toBe("A, B e C");
  });

  it("11. extrai drinks e bebidas unificados", () => {
    const budget = {
      selected_drinks: ["Moscow Mule", "Gin Tônica"],
      beverages: ["Cerveja Heineken", "Refrigerante"],
    };
    const list = extractDrinksList(budget);
    expect(list).toEqual(["Moscow Mule", "Gin Tônica", "Cerveja Heineken", "Refrigerante"]);
  });
});
