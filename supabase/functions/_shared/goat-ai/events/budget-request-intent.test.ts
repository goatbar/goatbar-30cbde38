import { describe, expect, it } from "vitest";
import { resolveBudgetRequestLinkIntent } from "./budget-request-intent.ts";

describe("intent determinístico de link da GIA", () => {
  for (const phrase of [
    "gere um link para orçamento",
    "cria um link de orçamento",
    "me manda um link para o cliente preencher",
  ]) {
    it(phrase, () => expect(resolveBudgetRequestLinkIntent(phrase).matched).toBe(true));
  }
  it("extrai dica opcional", () =>
    expect(
      resolveBudgetRequestLinkIntent("GIA, gere um link de orçamento para Mariana")
        .customerNameHint,
    ).toBe("Mariana"));
});
