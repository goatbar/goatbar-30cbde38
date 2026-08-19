import { describe, expect, it } from "vitest";
import {
  beveragesToEditorValue,
  normalizeBeveragesForSave,
  preserveBeveragesInput,
} from "./budget-beverages";

describe("editor de bebidas do orçamento", () => {
  it.each(["Água com gás", "Refrigerante zero", "Suco de laranja", "Vinho branco"])(
    "preserva espaços durante a digitação de %s",
    (value) => expect(preserveBeveragesInput(value)).toBe(value),
  );

  it("preserva o espaço final durante onChange e não o trata como separador", () => {
    expect(preserveBeveragesInput("Água ")).toBe("Água ");
    expect(normalizeBeveragesForSave(preserveBeveragesInput("Água "))).toEqual(["Água"]);
  });

  it("usa Enter, e não Space, para separar itens e mantém o nome completo", () => {
    expect(normalizeBeveragesForSave("Água com gás\nRefrigerante zero")).toEqual([
      "Água com gás",
      "Refrigerante zero",
    ]);
    expect(normalizeBeveragesForSave("Espumante brut")).toEqual(["Espumante brut"]);
  });

  it("aplica trim somente ao salvar", () => {
    const editing = preserveBeveragesInput("  Água com gás  ");
    expect(editing).toBe("  Água com gás  ");
    expect(normalizeBeveragesForSave(editing)).toEqual(["Água com gás"]);
  });

  it("reabre a lista persistida sem perder espaços", () => {
    const persisted = ["Água com gás", "Refrigerante zero", "Vinho branco"];
    expect(normalizeBeveragesForSave(beveragesToEditorValue(persisted))).toEqual(persisted);
  });
});
