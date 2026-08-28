import { describe, expect, it } from "vitest";
import { resolveDrinkImage } from "./drink-image";

describe("resolveDrinkImage", () => {
  it("preserva URL pública válida", () => expect(resolveDrinkImage("https://storage.example/drink.png")).toBe("https://storage.example/drink.png"));
  it("normaliza asset público relativo legado", () => expect(resolveDrinkImage("drinks/tom-collins.png")).toBe("/drinks/tom-collins.png"));
  it.each([null, "", "blob:https://goatbar.example/dead", "idb:drink", "data:image/png,x"])("não entrega referência não portável %s ao img", (value) => expect(resolveDrinkImage(value)).toBeNull());
});
