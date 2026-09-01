import { describe, expect, it } from "vitest";
import {
  buildContractFilename,
  buildContractTitle,
  formatContractDate,
  FALLBACK_CONTRACT_FILENAME,
} from "./contract-filename";

describe("formatContractDate", () => {
  it("formats a YYYY-MM-DD date to DD-MM-YYYY", () => {
    expect(formatContractDate("2026-11-14")).toBe("14-11-2026");
  });

  it("accepts an ISO timestamp and uses only the date part", () => {
    expect(formatContractDate("2026-11-14T21:00:00.000Z")).toBe("14-11-2026");
  });

  it("returns empty string for null or undefined", () => {
    expect(formatContractDate(null)).toBe("");
    expect(formatContractDate(undefined)).toBe("");
    expect(formatContractDate("")).toBe("");
  });

  it("returns empty string for malformed dates", () => {
    expect(formatContractDate("14/11/2026")).toBe("");
    expect(formatContractDate("not-a-date")).toBe("");
  });
});

describe("buildContractFilename", () => {
  it("uses event_name and date when both are present", () => {
    expect(buildContractFilename("Gustavo & Mariana", "Mariana Campos", "2026-11-14")).toBe(
      "Contrato Goat Bar - Gustavo & Mariana - 14-11-2026.pdf",
    );
  });

  it("falls back to client_name when event_name is absent", () => {
    expect(buildContractFilename(null, "Mariana Campos Moreira", "2026-11-14")).toBe(
      "Contrato Goat Bar - Mariana Campos Moreira - 14-11-2026.pdf",
    );
  });

  it("omits the date segment when date is absent", () => {
    expect(buildContractFilename("Gustavo & Mariana", null, null)).toBe(
      "Contrato Goat Bar - Gustavo & Mariana.pdf",
    );
  });

  it("preserves accented characters", () => {
    expect(buildContractFilename("Celebração João & Vitória", null, "2026-06-21")).toBe(
      "Contrato Goat Bar - Celebração João & Vitória - 21-06-2026.pdf",
    );
  });

  it("removes illegal filename characters", () => {
    expect(buildContractFilename('Festa / \\ : * ? " <João> | Maria', null, null)).toBe(
      "Contrato Goat Bar - Festa João Maria.pdf",
    );
  });

  it("collapses duplicate whitespace", () => {
    expect(buildContractFilename("Nome   Duplo", null, "2026-01-01")).toBe(
      "Contrato Goat Bar - Nome Duplo - 01-01-2026.pdf",
    );
  });

  it.each([null, undefined, "", "  "])(
    "uses the fallback for absent/blank name (%s)",
    (name) => {
      expect(buildContractFilename(name, name, null)).toBe(FALLBACK_CONTRACT_FILENAME);
    },
  );

  it("always ends with .pdf", () => {
    expect(buildContractFilename("Evento", null, null)).toMatch(/\.pdf$/);
  });
});

describe("buildContractTitle", () => {
  it("strips the .pdf extension", () => {
    expect(buildContractTitle("Gustavo & Mariana", null, "2026-11-14")).toBe(
      "Contrato Goat Bar - Gustavo & Mariana - 14-11-2026",
    );
  });
});
