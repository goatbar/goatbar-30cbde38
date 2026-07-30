import { describe, it, expect } from "vitest";
import {
  getSignatureIntegrationState,
  canDeleteOrRegenerateContract,
  canCancelContract,
} from "./contract-state";

describe("Contract State Machine Helper", () => {
  it("envio nunca iniciado", () => {
    const state = getSignatureIntegrationState("draft", null);
    expect(state).toBe("not_sent");
    expect(canDeleteOrRegenerateContract(state)).toBe(true);
    expect(canCancelContract(state)).toBe(false);
  });

  it("falha confirmada", () => {
    const state = getSignatureIntegrationState("draft", { dispatch_status: "failed" });
    expect(state).toBe("send_failed");
    expect(canDeleteOrRegenerateContract(state)).toBe(true);
    expect(canCancelContract(state)).toBe(false);
  });

  it("resposta ambígua (pending_signature sem external_id)", () => {
    const state = getSignatureIntegrationState("draft", {
      dispatch_status: "pending_signature",
      externalDocumentId: null,
    });
    expect(state).toBe("reconciliation_required");
    expect(canDeleteOrRegenerateContract(state)).toBe(false);
    expect(canCancelContract(state)).toBe(false);
  });

  it("envio ativo", () => {
    const state = getSignatureIntegrationState("sent", {
      dispatch_status: "pending_signature",
      externalDocumentId: "abc-123",
    });
    expect(state).toBe("active");
    expect(canDeleteOrRegenerateContract(state)).toBe(false);
    expect(canCancelContract(state)).toBe(true);
  });

  it("cancelamento em andamento", () => {
    const state = getSignatureIntegrationState("sent", { dispatch_status: "canceling" });
    expect(state).toBe("canceling");
    expect(canDeleteOrRegenerateContract(state)).toBe(false);
    expect(canCancelContract(state)).toBe(false);
  });

  it("cancelamento confirmado", () => {
    const state = getSignatureIntegrationState("draft", { dispatch_status: "canceled" });
    expect(state).toBe("canceled");
    expect(canDeleteOrRegenerateContract(state)).toBe(true);
    expect(canCancelContract(state)).toBe(false);
  });

  it("contrato concluído", () => {
    const state1 = getSignatureIntegrationState("signed", null);
    expect(state1).toBe("completed");

    const state2 = getSignatureIntegrationState("sent", { dispatch_status: "completed" });
    expect(state2).toBe("completed");

    expect(canDeleteOrRegenerateContract(state1)).toBe(false);
    expect(canCancelContract(state1)).toBe(false);
  });
});
