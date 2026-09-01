import { describe, expect, it } from "vitest";
import { numberToWordsBRL } from "./number-to-words-brl";

describe("numberToWordsBRL", () => {
  it("converte valores inteiros comuns", () => {
    expect(numberToWordsBRL(9500)).toBe("Nove mil quinhentos reais");
    expect(numberToWordsBRL(8000)).toBe("Oito mil reais");
    expect(numberToWordsBRL(85)).toBe("Oitenta e cinco reais");
    expect(numberToWordsBRL(1)).toBe("Um real");
    expect(numberToWordsBRL(0)).toBe("Zero reais");
  });

  it("converte valores com centavos", () => {
    expect(numberToWordsBRL(9500.5)).toBe("Nove mil quinhentos reais e cinquenta centavos");
    expect(numberToWordsBRL(85.75)).toBe("Oitenta e cinco reais e setenta e cinco centavos");
    expect(numberToWordsBRL(0.25)).toBe("Vinte e cinco centavos");
  });
});
