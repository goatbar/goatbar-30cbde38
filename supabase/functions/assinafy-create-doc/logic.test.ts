import { describe, expect, it } from "vitest";
import {
  buildRequiredAssignment,
  CreateDocHttpError,
  decideDispatch,
  validateRequiredSigners,
} from "./logic";

describe("Assinafy dispatch invariants", () => {
  it("requires exactly the client and the selected Goat Bar legal representative", () => {
    expect(
      validateRequiredSigners(
        { name: "Cliente Teste", email: "cliente@example.com" },
        { name: "Representante Goat", email: "goat@example.com" },
      ),
    ).toEqual([
      { role: "client", name: "Cliente Teste", email: "cliente@example.com" },
      { role: "company", name: "Representante Goat", email: "goat@example.com" },
    ]);
  });

  it("refuses silent one-party dispatch", () => {
    expect(() =>
      validateRequiredSigners({ name: "Cliente Teste", email: "cliente@example.com" }, null),
    ).toThrowError(
      expect.objectContaining<CreateDocHttpError>({ code: "company_signer_required", status: 422 }),
    );
  });

  it("builds one ordered Assinafy assignment containing exactly both parties", () => {
    expect(
      buildRequiredAssignment([
        { role: "client", externalSignerId: "client-id" },
        { role: "company", externalSignerId: "company-id" },
      ]),
    ).toEqual([{ id: "client-id" }, { id: "company-id" }]);
    expect(() =>
      buildRequiredAssignment([{ role: "client", externalSignerId: "client-id" }]),
    ).toThrowError(expect.objectContaining({ code: "two_party_assignment_required" }));
  });

  it("reconciles rather than recreating after remote IDs were persisted", () => {
    expect(
      decideDispatch(
        {
          id: "request",
          dispatch_status: "failed",
          external_document_id: "doc",
          external_assignment_id: "assignment",
        },
        "a".repeat(64),
      ).action,
    ).toBe("reconcile_local_persistence");
    expect(
      decideDispatch(
        { id: "request", dispatch_status: "reconciliation_required", external_document_id: "doc" },
        "a".repeat(64),
      ).action,
    ).toBe("reconcile");
  });
});
