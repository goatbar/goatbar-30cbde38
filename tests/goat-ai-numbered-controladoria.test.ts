import { describe, expect, it } from "vitest";
import {
  parseNumberedControladoriaEntries,
  numberedExpenseMissingFields,
  numberedExpenseMissingQuestion,
  updateNumberedExpenseFromReply,
  formatNumberedControladoriaPreview,
} from "../supabase/functions/_shared/goat-ai/validators/numbered-controladoria-expenses";
import { parseDrinkMatchInstructions } from "../supabase/functions/_shared/goat-ai/matchers/drink-matcher";

const userMessage = `Lançamento 3 - Mão de obra João (10/10/26):
* Valor: R$200,00
* Status: Pago
* Pagamento: Goat

Lançamento 4 - Mão de obra João (11/10/26):
* Valor: R$100,00
* Status: Pago
* Pagamento: Goat

Lançamento 5 - Insumos pessoal Romulo (09/10/26):
* Valor: R$119,31
* Status: Pago
* Pagamento: Pessoal (Romulo)

Lançamento 6 - Insumos pessoal Romulo (10/10/26):
* Valor: R$299,27
* Status: Pago
* Pagamento: Pessoal (Romulo)

Lançamento 7 - Xarope de Morango Monin 700ml (09/10/2026):
* Valor: R$59,90
* Status: Pago
* Pagamento: Goat

Lançamento 8 - Xarope de Maçã Verde Routin 1L:
* Valor: R$69,90
* Status: Pago
* Pagamento: Goat`;

describe("GIA — lançamentos numerados na Controladoria", () => {
  it("separa seis gastos, sem confundir pagador com profissional nem perder centavos", () => {
    const entries = parseNumberedControladoriaEntries(userMessage);
    expect(entries).toHaveLength(6);
    expect(entries.map(e => e.number)).toEqual([3,4,5,6,7,8]);
    expect(entries.map(e => e.amount)).toEqual([200,100,119.31,299.27,59.9,69.9]);
    expect(entries.map(e => e.category)).toEqual(["Equipe","Equipe","Insumos","Insumos","Insumos","Insumos"]);
    expect(entries[0].staff_name).toBe("João");
    expect(entries[1].staff_name).toBe("João");
    expect(entries[2].staff_name).toBeUndefined();
    expect(entries[2].payment_payer_name).toBe("Romulo");
    expect(entries[3].payment_payer_name).toBe("Romulo");
    expect(entries[2].payment_method).toBe("Pessoal");
    expect(entries[0].date).toBe("2026-10-10");
    expect(entries[3].date).toBe("2026-10-10");
    expect(entries[4].date).toBe("2026-10-09");
    expect(entries[5].date).toBeUndefined();
  });

  it("não inventa PIX/cartão quando o usuário só informa 'Goat', nem a data faltante", () => {
    const entries = parseNumberedControladoriaEntries(userMessage);
    expect(entries[0].payment_method).toBeUndefined();
    expect(entries[4].payment_method).toBeUndefined();
    const missing = numberedExpenseMissingFields(entries, "7 Steak House");
    expect(missing).toEqual(["payment_method:3", "payment_method:4", "payment_method:7", "date:8", "payment_method:8"]);
    const question = numberedExpenseMissingQuestion(entries, "7 Steak House");
    expect(question).toContain("3, 4, 7, 8");
    expect(question).toContain("data do(s) lançamento(s) 8");
    expect(question).not.toContain("modalidade");
  });

  it("corrige somente as lacunas em uma resposta e gera confirmação de todos os gastos", () => {
    const entries = parseNumberedControladoriaEntries(userMessage);
    const updated = updateNumberedExpenseFromReply(entries, "Os pagamentos Goat foram via PIX Goat, e o lançamento 8 foi em 11/10/26");
    expect(numberedExpenseMissingFields(updated, "7 Steak House")).toHaveLength(0);
    expect(updated[0].payment_method).toBe("PIX Goat");
    expect(updated[4].payment_method).toBe("PIX Goat");
    expect(updated[2].payment_method).toBe("Pessoal");
    expect(updated[5].date).toBe("2026-10-11");
    const preview = formatNumberedControladoriaPreview(updated, "7 Steak House");
    expect(preview).toContain("6 lançamentos");
    expect(preview).toContain("João");
    expect(preview).toContain("Pessoal (Romulo)");
    expect(preview).toContain("11/10/2026");
    expect(preview).toContain("Confirma");
  });

  it("nunca interpreta pagamentos financeiros como aliases de drinks", () => {
    expect(parseDrinkMatchInstructions(userMessage)).toEqual([]);
    expect(parseDrinkMatchInstructions("Pagamento: Goat\n* Pagamento: Pessoal (Romulo)")).toEqual([]);
    expect(parseDrinkMatchInstructions("Spritz Veneziano = Aperol")).toEqual([
      {alias:"Spritz Veneziano", targetDrinkName:"Aperol"},
    ]);
  });

  it("valida data real e não aceita 31/02", () => {
    const entries = parseNumberedControladoriaEntries("Lançamento 9 - Mão de obra João (31/02/26):\nValor: R$100,00\nStatus: Pendente");
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBeUndefined();
    expect(numberedExpenseMissingFields(entries, "7 Steak House")).toContain("date:9");
    expect(numberedExpenseMissingFields(entries, "7 Steak House")).not.toContain("payment_method:9");
  });
});
