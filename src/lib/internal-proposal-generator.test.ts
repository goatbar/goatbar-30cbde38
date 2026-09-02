import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  event: { id: "event-created-by-pipeline", event_name: "Festa", event_type: "casamento" } as any,
  budget: {} as any,
  insertedProposal: null as any,
}));

vi.mock("@/integrations/supabase/client", () => {
  function queryFor(table: string) {
    const query: any = {
      select: () => query,
      eq: () => query,
      neq: () => query,
      update: () => query,
      in: async () => ({ data: [{ id: "stamping", nome: "Stamping Passion" }], error: null }),
      single: async () => {
        if (table === "event_budget_versions") return { data: state.budget, error: null };
        if (table === "events") return { data: state.event, error: null };
        if (table === "generated_proposals") return { data: state.insertedProposal, error: null };
        return { data: null, error: null };
      },
      insert: (record: any) => {
        state.insertedProposal = record;
        return query;
      },
    };
    return query;
  }
  return {
    supabase: {
      from: (table: string) => queryFor(table),
      storage: {
        from: () => ({
          upload: vi.fn(async () => ({ error: null })),
          getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.test/${path}` } }),
          remove: vi.fn(async () => ({ error: null })),
        }),
      },
    },
  };
});

vi.mock("./pdf-engine/renderer", () => ({
  ProposalPdfRenderer: {
    render: vi.fn(async () => ({
      pdfBytes: new Uint8Array([37, 80, 68, 70]),
      pageCount: 1,
      generatedAt: "2026-09-01T00:00:00.000Z",
    })),
  },
}));

import {
  generateAndPersistProposal,
  generateProposalPreview,
  loadProposalContext,
} from "./internal-proposal-generator";

function savedVersion(customization?: "monogram" | "rice_paper") {
  return {
    id: "budget-v1",
    event_id: "event-created-by-pipeline",
    selected_drinks: {
      // A duplicate in a legacy snapshot must not duplicate the menu entry.
      ids: ["stamping", "stamping"],
      customizations: customization ? { stamping: customization } : {},
    },
    event_snapshot: { event_name: "Festa", event_type: "casamento" },
  };
}

describe("proposal generation identity and drink customization regression", () => {
  beforeEach(() => {
    state.insertedProposal = null;
  });

  it.each([
    ["sem personalização", undefined, "Stamping Passion"],
    ["com monograma", "monogram", "Stamping Passion (com monograma)"],
    ["com papel de arroz", "rice_paper", "Stamping Passion (com papel de arroz)"],
  ] as const)(
    "reabre a primeira versão %s sem perder o evento",
    async (_label, customization, expected) => {
      state.budget = savedVersion(customization);

      // Simulates reopening from a public-request URL whose id is not the event id.
      const context = await loadProposalContext("public-request-link-id", "budget-v1");

      expect(context.event.id).toBe("event-created-by-pipeline");
      expect(context.budget.id).toBe("budget-v1");
      expect(context.resolvedDrinkNames).toEqual([expected]);
    },
  );

  it("gera a prévia usando a relação canônica da versão salva", async () => {
    state.budget = savedVersion("monogram");
    const result = await generateProposalPreview({
      eventId: "public-request-link-id",
      budgetVersionId: "budget-v1",
    });
    expect(result.canonicalData.drinks).toEqual(["Stamping Passion (com monograma)"]);
    expect(result.renderResult.pageCount).toBe(1);
  });

  it("persiste a proposta oficial com o event_id canônico", async () => {
    state.budget = savedVersion("rice_paper");
    const result = await generateAndPersistProposal({
      eventId: "public-request-link-id",
      budgetVersionId: "budget-v1",
    });

    expect(state.insertedProposal.event_id).toBe("event-created-by-pipeline");
    expect(state.insertedProposal.proposal_data.drinks).toEqual([
      "Stamping Passion (com papel de arroz)",
    ]);
    expect(result.storagePath).toContain("events/event-created-by-pipeline/budgets/budget-v1/");
  });
});
