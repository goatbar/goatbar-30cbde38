import { describe, expect, it } from "vitest";
import {
  resolveProposalModel,
  resolveProposalTemplateForEvent,
  selectProposalTemplateForEvent,
} from "./internal-proposal-generator";

describe("resolução do modelo de proposta pelo tipo persistido do evento", () => {
  it.each([
    ["Casamento", "casamento", "goatbar-commercial"],
    ["Aniversário", "aniversario", "goatbar-aniversario"],
    ["Comemoração", "comemoracao", "goatbar-comemoracao"],
    ["Confraternização", "comemoracao", "goatbar-comemoracao"],
    ["Corporativo", "comemoracao", "goatbar-comemoracao"],
  ] as const)("resolve %s como %s", (eventType, expectedModel, expectedTemplateId) => {
    expect(resolveProposalModel(eventType)).toBe(expectedModel);
    expect(selectProposalTemplateForEvent(eventType).id).toBe(expectedTemplateId);
  });

  it("usa Aniversário para Festa de 15 anos sem considerar o nome do evento", () => {
    const event = {
      event_type: "Aniversário",
      event_name: "Festa de 15 anos",
    };

    expect(resolveProposalModel(event.event_type)).toBe("aniversario");
    expect(resolveProposalTemplateForEvent(event).id).toBe("goatbar-aniversario");
  });

  it("normaliza somente caixa, espaços e acentuação", () => {
    expect(resolveProposalModel("  CONFRATERNIZAÇÃO  ")).toBe("comemoracao");
    expect(resolveProposalModel("aniversario")).toBe("aniversario");
    expect(() => resolveProposalModel("Festa de Aniversário")).toThrow(
      "Tipo de evento sem modelo de proposta vinculado",
    );
  });

  it("não faz fallback silencioso para casamento", () => {
    expect(() => resolveProposalModel("Outro")).toThrow(
      'Tipo de evento sem modelo de proposta vinculado: "Outro".',
    );
  });
});
