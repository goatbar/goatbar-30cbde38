import { describe, expect, it } from "vitest";
import { resolveContractDataRequestLinkIntent } from "./contract-data-request-intent.ts";

describe("intent determinístico de dados do contrato", () => {
  it("reconhece o pedido real que antes caía em orçamento", () => {
    const result = resolveContractDataRequestLinkIntent(
      "Gia, você consegue gerar o link de solicitação de dados para contrato do evento da Mariana & Gustavo de 23.01.27?",
    );
    expect(result.matched).toBe(true);
    expect(result.dateHint).toBe("2027-01-23");
  });

  for (const phrase of [
    "gere o formulário de dados do contrato da Mariana",
    "crie um link para o contratante preencher os dados do contrato",
    "me manda o link de coleta de dados contratuais",
  ]) {
    it(phrase, () =>
      expect(resolveContractDataRequestLinkIntent(phrase).matched).toBe(true));
  }

  it("não trata link de orçamento como contrato", () =>
    expect(resolveContractDataRequestLinkIntent("gere um link para solicitar orçamento").matched)
      .toBe(false));
});
