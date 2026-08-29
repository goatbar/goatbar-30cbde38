import { describe, it, expect } from "vitest";
import { normalizeAssinafyStatus, validateStatusPayload, StatusHttpError } from "./logic";

describe("Assinafy Status Logic & Resilience Tests", () => {
  it("normaliza corretamente os status de ciclo de vida da Assinafy", () => {
    expect(normalizeAssinafyStatus("uploading")).toBe("uploading");
    expect(normalizeAssinafyStatus("uploaded")).toBe("uploaded");
    expect(normalizeAssinafyStatus("metadata_ready")).toBe("metadata_ready");
    expect(normalizeAssinafyStatus("pending_signature")).toBe("pending_signature");
    expect(normalizeAssinafyStatus("certificated")).toBe("signed");
    expect(normalizeAssinafyStatus("signed")).toBe("signed");
    expect(normalizeAssinafyStatus("completed")).toBe("signed");
    expect(normalizeAssinafyStatus("rejected_by_signer")).toBe("rejected_by_signer");
    expect(normalizeAssinafyStatus("rejected_by_user")).toBe("canceled");
    expect(normalizeAssinafyStatus("canceled")).toBe("canceled");
    expect(normalizeAssinafyStatus("")).toBe("pending_signature");
    expect(normalizeAssinafyStatus(undefined)).toBe("pending_signature");
  });

  it("valida payload de sincronização por signatureRequestId", () => {
    const input = { action: "sync", signatureRequestId: "req-123" };
    const validated = validateStatusPayload(input);
    expect(validated.action).toBe("sync");
    expect(validated.signatureRequestId).toBe("req-123");
  });

  it("valida payload de sincronização por documentId", () => {
    const input = { action: "sync", documentId: "doc-123" };
    const validated = validateStatusPayload(input);
    expect(validated.action).toBe("sync");
    expect(validated.documentId).toBe("doc-123");
  });

  it("rejeita payload de sincronização sem identificador", () => {
    expect(() => validateStatusPayload({ action: "sync" })).toThrowError(
      expect.objectContaining({
        status: 400,
        code: "signature_request_id_required",
      }),
    );
  });

  it("valida payload de download de artefatos", () => {
    const input = { action: "download", documentId: "doc-123", artifact: "certificated" };
    const validated = validateStatusPayload(input);
    expect(validated.action).toBe("download");
    expect(validated.artifact).toBe("certificated");
  });

  it("rejeita payload de download sem documentId", () => {
    expect(() => validateStatusPayload({ action: "download", artifact: "bundle" })).toThrowError(
      expect.objectContaining({
        status: 400,
        code: "document_id_required",
      }),
    );
  });
});
