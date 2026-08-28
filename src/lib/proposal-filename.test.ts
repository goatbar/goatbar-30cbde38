import { describe, expect, it } from "vitest";
import { buildProposalFilename } from "./proposal-filename";

describe("buildProposalFilename", () => {
  it("uses a normal canonical event name", () => {
    expect(buildProposalFilename("Casamento Lucas e Sidney")).toBe(
      "Proposta Comercial - Casamento Lucas e Sidney.pdf",
    );
  });

  it("preserves accents and spaces", () => {
    expect(buildProposalFilename("Celebração de João e Vitória")).toBe(
      "Proposta Comercial - Celebração de João e Vitória.pdf",
    );
  });

  it("removes invalid characters and collapses duplicate whitespace", () => {
    expect(buildProposalFilename('Festa / \\ : * ? " <João> |  Maria')).toBe(
      "Proposta Comercial - Festa João Maria.pdf",
    );
  });

  it.each([null, undefined, "", "  ", '/\\:*?"<>|'])(
    "uses the fallback for an invalid or absent name (%s)",
    (name) => {
      expect(buildProposalFilename(name)).toBe("Proposta Comercial - Evento.pdf");
    },
  );

  it("always appends a lowercase PDF extension", () => {
    expect(buildProposalFilename("Evento")).toMatch(/\.pdf$/);
  });
});
