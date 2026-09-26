import { describe, expect, it } from "vitest";
import {
  extractEventDateHint,
  resolveEventDocumentCommandIntent,
} from "./document-command-intent.ts";

describe("roteamento determinístico de documentos da GIA", () => {
  it("manda cardápio do evento de hoje", () => {
    const result = resolveEventDocumentCommandIntent(
      "me manda o cardápio do evento de hoje 26.09",
    );
    expect(result.matched).toBe(true);
    expect(result.action).toBe("generate_menu");
    expect(result.dateHint).toMatch(/-09-26$/);
  });

  it("gera proposta comercial", () => {
    const result = resolveEventDocumentCommandIntent(
      "GIA, gere a proposta comercial da Mariana & Gustavo de 23.01.27",
    );
    expect(result.action).toBe("generate_proposal");
    expect(result.dateHint).toBe("2027-01-23");
  });

  it("só envia contrato quando assinatura é explícita", () => {
    expect(
      resolveEventDocumentCommandIntent(
        "gere o contrato da Mariana e envie para assinatura",
      ).action,
    ).toBe("generate_contract_and_send");

    expect(
      resolveEventDocumentCommandIntent("gere uma minuta do contrato da Mariana").matched,
    ).toBe(false);
  });

  it("não sequestra formulário de dados do contrato", () => {
    expect(
      resolveEventDocumentCommandIntent(
        "gere o link de solicitação de dados para contrato da Mariana",
      ).matched,
    ).toBe(false);
  });

  it("entende data brasileira com ponto", () => {
    expect(extractEventDateHint("evento 23.01.27")).toBe("2027-01-23");
  });
});
