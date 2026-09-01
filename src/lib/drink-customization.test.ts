import { describe, expect, it } from "vitest";
import { formatCustomizedDrinkNames, getDrinkCustomizations } from "./drink-customization";

describe("drink customization snapshots", () => {
  it("renders one line per drink and appends its customization", () => {
    expect(
      formatCustomizedDrinkNames(
        ["a", "a", "b"],
        ["Stamping Passion", "Stamping Passion", "Mojito"],
        { a: "monogram" },
      ),
    ).toEqual(["Stamping Passion (com monograma)", "Mojito"]);
  });

  it("reads each historical version independently", () => {
    const oldVersion = { ids: ["a"], customizations: { a: "rice_paper" } };
    const currentVersion = { ids: ["a"], customizations: { a: "monogram" } };
    expect(
      formatCustomizedDrinkNames(
        oldVersion.ids,
        ["Stamping Passion"],
        getDrinkCustomizations(oldVersion),
      ),
    ).toEqual(["Stamping Passion (com papel de arroz)"]);
    expect(
      formatCustomizedDrinkNames(
        currentVersion.ids,
        ["Stamping Passion"],
        getDrinkCustomizations(currentVersion),
      ),
    ).toEqual(["Stamping Passion (com monograma)"]);
  });
});
