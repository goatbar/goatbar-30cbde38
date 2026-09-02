import { describe, expect, it } from "vitest";
import {
  INTERNAL_PROPOSAL_TEMPLATE_IDS,
  normalizeProposalEventType,
  resolveProposalTemplate,
} from "../src/lib/proposal-template-resolver";

const templates = [
  { id: INTERNAL_PROPOSAL_TEMPLATE_IDS.casamento, event_type: "casamento", is_active: true, provider: "internal", file_url: "/pdf/casamento.pdf" },
  { id: INTERNAL_PROPOSAL_TEMPLATE_IDS.aniversario, event_type: "aniversario", is_active: true, provider: "internal", file_url: "/pdf/celebracao.pdf" },
  { id: INTERNAL_PROPOSAL_TEMPLATE_IDS.comemoracao, event_type: "comemoracao", is_active: true, provider: "internal", file_url: "/pdf/comemoracao.pdf" },
];

describe("seleção efetiva do PDF-base da proposta", () => {
  it.each([
    ["Casamento", "casamento", "/pdf/casamento.pdf"],
    ["ANIVERSÁRIO", "aniversario", "/pdf/celebracao.pdf"],
    ["Comemoração", "comemoracao", "/pdf/comemoracao.pdf"],
    ["Corporativo", "comemoracao", "/pdf/comemoracao.pdf"],
    ["Despedida_de_Solteiro", "comemoracao", "/pdf/comemoracao.pdf"],
  ])("resolve %s para %s e carrega %s", (eventType, normalizedType, expectedPdf) => {
    expect(normalizeProposalEventType(eventType)).toBe(normalizedType);
    expect(resolveProposalTemplate(eventType, templates)?.file_url).toBe(expectedPdf);
  });

  it("uma nova versão ignora o template armazenado pela proposta anterior", () => {
    const previousProposal = { template_id: INTERNAL_PROPOSAL_TEMPLATE_IDS.casamento };
    const selected = resolveProposalTemplate("Corporativo", templates);

    expect(previousProposal.template_id).toBe(INTERNAL_PROPOSAL_TEMPLATE_IDS.casamento);
    expect(selected?.id).toBe(INTERNAL_PROPOSAL_TEMPLATE_IDS.comemoracao);
    expect(selected?.file_url).toBe("/pdf/comemoracao.pdf");
  });

  it("ignora is_default e escolhe pelo tipo do evento", () => {
    const contaminated = templates.map((template) => ({
      ...template,
      is_default: template.event_type === "casamento",
    }));
    expect(resolveProposalTemplate("Comemoração", contaminated)?.file_url).toBe("/pdf/comemoracao.pdf");
  });
});
