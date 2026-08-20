import { describe, expect, it } from "vitest";
import { OFFICIAL_CANVA_PROPOSAL_FIELDS, getFieldCatalogItem } from "./proposal-field-catalog";
import {
  buildOfficialCanvaMapperFields,
  filterOfficialCanvaMapperFields,
  isCanvaMapperFieldMapped,
} from "./canva-mapper-fields";

describe("official Canva mapper fields", () => {
  it("keeps exactly the 15 official fields, including BEBIDAS", () => {
    expect(OFFICIAL_CANVA_PROPOSAL_FIELDS).toHaveLength(15);
    expect(OFFICIAL_CANVA_PROPOSAL_FIELDS.some((key) => key === "BEBIDAS")).toBe(true);
  });

  it("keeps BEBIDAS visible and missing when the Canva dataset does not contain it", () => {
    const fields = buildOfficialCanvaMapperFields([{ key: "DRINKS" }]);
    const bebidas = fields.find((field) => field.expectedKey === "BEBIDAS");

    expect(fields).toHaveLength(15);
    expect(bebidas).toBeDefined();
    expect(bebidas?.existsInCanva).toBe(false);
    expect(filterOfficialCanvaMapperFields(fields, "", "missing")).toContainEqual(bebidas);
  });

  it("keeps BEBIDAS valid in the list when the dataset contains it", () => {
    const fields = buildOfficialCanvaMapperFields([
      { key: " bebidas ", name: "Bebidas", type: "text" },
    ]);
    const bebidas = fields.find((field) => field.expectedKey === "BEBIDAS");

    expect(fields).toHaveLength(15);
    expect(bebidas?.existsInCanva).toBe(true);
    expect(bebidas?.type).toBe("text");
    expect(isCanvaMapperFieldMapped(bebidas!)).toBe(false);
  });

  it("keeps unmapped BEBIDAS visible", () => {
    const fields = buildOfficialCanvaMapperFields([]);
    const results = filterOfficialCanvaMapperFields(fields, "", "unmapped");

    expect(results.some((field) => field.expectedKey === "BEBIDAS")).toBe(true);
  });

  it("restores the persisted budget.beverages mapping", () => {
    const fields = buildOfficialCanvaMapperFields(
      [{ key: "BEBIDAS" }],
      [
        {
          canva_field_key: "BEBIDAS",
          source_type: "field",
          source_field_key: "budget.beverages",
        },
      ],
    );
    const bebidas = fields.find((field) => field.expectedKey === "BEBIDAS");

    expect(bebidas?.source_field_key).toBe("budget.beverages");
    expect(isCanvaMapperFieldMapped(bebidas!)).toBe(true);
    expect(filterOfficialCanvaMapperFields(fields, "", "mapped")).toContainEqual(bebidas);
    expect(getFieldCatalogItem("budget.beverages")).toMatchObject({
      label: "Bebidas selecionadas",
      group: "Bebidas",
      type: "list",
    });
  });

  it('returns exactly BEBIDAS when searching for "BEBIDAS"', () => {
    const results = filterOfficialCanvaMapperFields(
      buildOfficialCanvaMapperFields([]),
      "BEBIDAS",
      "all",
    );

    expect(results).toHaveLength(1);
    expect(results[0].expectedKey).toBe("BEBIDAS");
  });
});
