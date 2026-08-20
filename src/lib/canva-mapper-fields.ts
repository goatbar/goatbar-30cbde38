import {
  OFFICIAL_CANVA_PROPOSAL_FIELDS,
  mergeOfficialCanvaFields,
  normalizeCanvaFieldKey,
  type CanvaDatasetField,
} from "./proposal-field-catalog";

export type CanvaMapperSourceType = "field" | "static" | "none";
export type CanvaMapperFieldFilter = "all" | "mapped" | "unmapped" | "valid" | "missing";

export interface CanvaMapperMapping {
  canva_field_key: string;
  source_type?: string | null;
  source_field_key?: string | null;
  static_value?: string | null;
  formatter?: string | null;
  required?: boolean | null;
}

export interface CanvaMapperField {
  index: number;
  key: string;
  name: string;
  type: string;
  source_type: CanvaMapperSourceType;
  source_field_key: string | null;
  static_value: string | null;
  formatter: string;
  required: boolean;
  isRemoved?: boolean;
  existsInCanva: boolean;
  expectedKey: string;
}

/** Builds the main mapper navigation from the local catalog, never from Canva or mappings. */
export function buildOfficialCanvaMapperFields(
  dataset: CanvaDatasetField[],
  mappings: CanvaMapperMapping[] = [],
): CanvaMapperField[] {
  const mappingsByKey = new Map(
    mappings.map((mapping) => [normalizeCanvaFieldKey(mapping.canva_field_key), mapping]),
  );
  const datasetKeys = new Set(dataset.map((field) => normalizeCanvaFieldKey(field.key)));

  return mergeOfficialCanvaFields(dataset).map((field, index) => {
    // mergeOfficialCanvaFields has exactly the catalog order, so this key cannot
    // disappear because of dataset metadata, persisted mappings, or filtering.
    const expectedKey = OFFICIAL_CANVA_PROPOSAL_FIELDS[index];
    const mapping = mappingsByKey.get(normalizeCanvaFieldKey(expectedKey));
    const sourceType: CanvaMapperSourceType =
      mapping?.source_type === "static"
        ? "static"
        : mapping?.source_type === "none"
          ? "none"
          : "field";

    return {
      index: index + 1,
      key: field.key,
      name: field.name,
      type: field.type,
      source_type: sourceType,
      source_field_key: mapping?.source_field_key || null,
      static_value: mapping?.static_value || null,
      formatter:
        mapping?.formatter || (expectedKey.toLowerCase().includes("valor") ? "currency" : "raw"),
      required: Boolean(mapping?.required),
      isRemoved: false,
      existsInCanva: datasetKeys.has(normalizeCanvaFieldKey(expectedKey)),
      expectedKey,
    };
  });
}

export function isCanvaMapperFieldMapped(field: CanvaMapperField): boolean {
  return (
    field.source_type === "none" ||
    (field.source_type === "field" && Boolean(field.source_field_key)) ||
    (field.source_type === "static" && Boolean(field.static_value?.trim()))
  );
}

/** Applies view-only filters after the complete official list has been built. */
export function filterOfficialCanvaMapperFields(
  fields: CanvaMapperField[],
  search: string,
  filter: CanvaMapperFieldFilter,
): CanvaMapperField[] {
  const query = search.trim().toLowerCase();
  return fields.filter((field) => {
    const isMapped = isCanvaMapperFieldMapped(field);
    const matchesFilter =
      filter === "all" ||
      (filter === "mapped" && isMapped) ||
      (filter === "unmapped" && !isMapped) ||
      (filter === "valid" && field.existsInCanva) ||
      (filter === "missing" && !field.existsInCanva);

    return (
      matchesFilter &&
      (!query ||
        [field.key, field.expectedKey, field.name, field.source_field_key || ""].some((value) =>
          value.toLowerCase().includes(query),
        ))
    );
  });
}
