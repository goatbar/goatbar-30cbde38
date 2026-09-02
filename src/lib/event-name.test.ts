import { describe, expect, it } from "vitest";
import { normalizeEventName } from "./event-name";

describe("normalizeEventName", () => {
  it.each([
    ["Larissa e Marcos", "Larissa & Marcos"],
    ["Mariana E Gustavo", "Mariana & Gustavo"],
    ["Ana e João", "Ana & João"],
  ])("normaliza a conjunção isolada em casamento: %s", (input, expected) => {
    expect(normalizeEventName(input, "Casamento")).toBe(expected);
  });

  it("não altera letras dentro de palavras", () => {
    expect(normalizeEventName("Helena e Pierre", "casamento")).toBe("Helena & Pierre");
  });

  it("não altera nomes de outros tipos de evento", () => {
    expect(normalizeEventName("Pesquisa e Desenvolvimento", "Corporativo")).toBe(
      "Pesquisa e Desenvolvimento",
    );
  });
});
