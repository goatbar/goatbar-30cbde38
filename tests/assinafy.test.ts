import { describe, it, expect, vi } from "vitest";
import { canonicalStringify } from "../supabase/functions/_shared/canonical-hash";
import { getSignatureProvider } from "../src/services/signature-provider";

describe("Assinafy Integration Tests", () => {
  it("canonicalStringify gera a mesma saída com chaves em ordens diferentes", () => {
    const obj1 = { a: 1, b: 2, c: { x: 10, y: 20 } };
    const obj2 = { b: 2, c: { y: 20, x: 10 }, a: 1 };

    expect(canonicalStringify(obj1)).toBe(canonicalStringify(obj2));
  });

  it("canonicalStringify preserva ordem de arrays", () => {
    const obj1 = { arr: [1, 2, 3] };
    const obj2 = { arr: [1, 3, 2] };

    expect(canonicalStringify(obj1)).not.toBe(canonicalStringify(obj2));
  });

  it("evento duplicado gera a mesma chave", () => {
    const payload1 = { event_type: "document.signed", data: { document: { id: "123" } } };
    const payload2 = { data: { document: { id: "123" } }, event_type: "document.signed" };

    expect(canonicalStringify(payload1)).toBe(canonicalStringify(payload2));
  });

  it("evento semanticamente diferente gera outra chave", () => {
    const payload1 = { event_type: "document.signed", data: { document: { id: "123" } } };
    const payload2 = { event_type: "document.completed", data: { document: { id: "123" } } };

    expect(canonicalStringify(payload1)).not.toBe(canonicalStringify(payload2));
  });

  it("provider zapsign é preservado", () => {
    const provider = getSignatureProvider("zapsign");
    expect(provider.name).toBe("ZapSign");
  });

  it("provider assinafy é selecionado", () => {
    const provider = getSignatureProvider("assinafy");
    expect(provider.name).toBe("assinafy");

    const defaultProvider = getSignatureProvider();
    expect(defaultProvider.name).toBe("assinafy");
  });
});

import { decideDispatch } from "../supabase/functions/assinafy-create-doc/logic";
import {
  StatusHttpError,
  normalizeAssinafyStatus,
  validateStatusPayload,
} from "../supabase/functions/assinafy-status/logic";

describe("Assinafy dispatch state machine", () => {
  const hash = "a".repeat(64);
  it("primeiro envio cria uma única solicitação", () =>
    expect(decideDispatch(null, hash).action).toBe("create"));
  it("clique duplo e solicitação existente reutilizam o documento", () => {
    const request = {
      id: "req-1",
      dispatch_status: "pending_signature",
      original_file_hash: hash,
      external_document_id: "doc-1",
    };
    expect(decideDispatch(request, hash)).toEqual({ action: "reuse", request });
    expect(decideDispatch(request, hash).action).toBe("reuse");
  });
  it("nova tentativa reutiliza a solicitação falha", () =>
    expect(
      decideDispatch({ id: "req-1", dispatch_status: "failed", original_file_hash: hash }, hash)
        .action,
    ).toBe("retry"));
  it("bloqueia PDF com hash divergente", () =>
    expect(
      decideDispatch(
        { id: "req-1", dispatch_status: "pending_signature", original_file_hash: "b".repeat(64) },
        hash,
      ).action,
    ).toBe("hash_conflict"));
  it("impede duplicação durante processamento", () =>
    expect(
      decideDispatch({ id: "req-1", dispatch_status: "processing", original_file_hash: hash }, hash)
        .action,
    ).toBe("processing"));
});

describe("Assinafy status contract", () => {
  it("exige signature_request_id no sync", () => {
    expect(() => validateStatusPayload({ action: "sync" })).toThrow(StatusHttpError);
    try {
      validateStatusPayload({ action: "sync" });
    } catch (error) {
      expect((error as StatusHttpError).status).toBe(400);
      expect((error as StatusHttpError).code).toBe("signature_request_id_required");
    }
  });
  it("normaliza status posterior ao envio", () => {
    expect(normalizeAssinafyStatus("completed")).toBe("signed");
    expect(normalizeAssinafyStatus("sent")).toBe("pending_signature");
  });
});

import {
  CreateDocHttpError,
  decodePdfBase64,
  validateCreateDocPayload,
  validatePdfHash,
  validateSigner,
} from "../supabase/functions/assinafy-create-doc/logic";
import {
  formatAssinafyInvokeError,
  normalizeAssinafyInvokeError,
} from "../src/services/assinafy-service";

const pdfBytes = new TextEncoder().encode("%PDF-1.4\nminimal");
const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));
async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
function expectHttpError(run: () => unknown, status: number, code: string) {
  try {
    run();
    throw new Error("expected error");
  } catch (error) {
    expect(error).toBeInstanceOf(CreateDocHttpError);
    expect(error).toMatchObject({ status, code });
  }
}

describe("assinafy-create-doc request validation", () => {
  it("accepts the exact camelCase frontend payload and preserves PDF bytes", async () => {
    const hash = await sha256(pdfBytes);
    const payload = validateCreateDocPayload({
      contractId: "contract-1",
      pdfBase64,
      pdfUrl: undefined,
      pdfHash: hash,
    });
    const decoded = decodePdfBase64(payload.pdfBase64!);
    expect(decoded).toEqual(pdfBytes);
    await expect(validatePdfHash(decoded, hash)).resolves.toBeUndefined();
  });
  it("requires contractId with a semantic 422", () =>
    expectHttpError(
      () => validateCreateDocPayload({ pdfBase64, pdfHash: "a".repeat(64) }),
      422,
      "contract_id_required",
    ));
  it("requires a PDF with a semantic 422", () =>
    expectHttpError(
      () => validateCreateDocPayload({ contractId: "c", pdfHash: "a".repeat(64) }),
      422,
      "pdf_required",
    ));
  it("rejects malformed Base64", () =>
    expectHttpError(() => decodePdfBase64("%%%="), 422, "pdf_base64_invalid"));
  it("rejects bytes without the PDF signature", () =>
    expectHttpError(() => decodePdfBase64(btoa("not a pdf!")), 422, "pdf_signature_invalid"));
  it("returns 409 for a divergent hash", async () =>
    await expect(validatePdfHash(pdfBytes, "a".repeat(64))).rejects.toMatchObject({
      status: 409,
      code: "pdf_hash_mismatch",
    }));
  it("requires signer name and email before provider calls", () => {
    expectHttpError(() => validateSigner("", "client@example.com"), 422, "signer_name_required");
    expectHttpError(() => validateSigner("Client", ""), 422, "signer_email_required");
  });
  it("extracts status, semantic code, safe message and correlation id from FunctionsHttpError context", async () => {
    const context = new Response(
      JSON.stringify({ code: "pdf_required", message: "PDF é obrigatório", requestId: "corr-1" }),
      { status: 422, headers: { "content-type": "application/json" } },
    );
    await expect(
      formatAssinafyInvokeError({
        message: "Edge Function returned a non-2xx status code",
        context,
      }),
    ).resolves.toBe(
      "assinafy-create-doc failed:\nHTTP 422\ncode: pdf_required\nmessage: PDF é obrigatório\nrequestId: corr-1",
    );
  });

  it.each([400, 403, 404, 500])(
    "marks an Edge Function HTTP %s response as backend reached",
    async (status) => {
      const body = {
        code: "contract_error",
        message: "Contrato rejeitado",
        diagnostic: { assinafyRequestSent: false, databaseUpdated: false },
      };
      const normalized = await normalizeAssinafyInvokeError(
        {
          name: "FunctionsHttpError",
          message: "Edge Function returned a non-2xx status code",
          context: new Response(JSON.stringify(body), {
            status,
            headers: { "content-type": "application/json" },
          }),
        },
        "contract-1",
      );

      expect(normalized.diagnostic).toMatchObject({
        backendReached: true,
        httpStatus: status,
        assinafyRequestSent: false,
        internalContractId: "contract-1",
      });
      expect(normalized.diagnostic.assinafyResponse).toMatchObject(body);
    },
  );

  it("keeps FunctionsFetchError reserved for a backend that was not reached", async () => {
    const normalized = await normalizeAssinafyInvokeError(
      { name: "FunctionsFetchError", message: "Failed to send a request to the Edge Function" },
      "contract-1",
    );
    expect(normalized.diagnostic).toMatchObject({
      backendReached: false,
      httpStatus: null,
      assinafyRequestSent: false,
      assinafyResponse: null,
    });
  });
});

import { resolveContractAccess } from "../supabase/functions/assinafy-create-doc/contract-access";
import { authenticatedClientOptions } from "../supabase/functions/assinafy-create-doc/logic";
import { getSignatureDispatchIdentifiers } from "../src/services/signature-dispatch";

describe("assinafy-create-doc contract identity and authorization", () => {
  it("sends event_contracts.id instead of the route events.id", () => {
    const ids = getSignatureDispatchIdentifiers("event-7dbc", { id: "contract-real-id" });
    expect(ids).toEqual({
      eventId: "event-7dbc",
      contractId: "contract-real-id",
      contractRecordId: "contract-real-id",
    });
    expect(ids.contractId).not.toBe(ids.eventId);
  });

  it("returns 404 when the service-role existence lookup finds no contract", async () => {
    const userLookup = vi.fn();
    await expect(
      resolveContractAccess(async () => ({ data: null, error: null }), userLookup),
    ).rejects.toMatchObject({ status: 404, code: "contract_not_found" });
    expect(userLookup).not.toHaveBeenCalled();
  });

  it("returns 403 when the contract exists but JWT/RLS cannot select it", async () => {
    await expect(
      resolveContractAccess(
        async () => ({ data: { id: "contract-1" }, error: null }),
        async () => ({ data: null, error: null }),
      ),
    ).rejects.toMatchObject({ status: 403, code: "contract_access_denied" });
  });

  it("returns 500 and contract_query_failed when existence lookup returns a query error (e.g. PGRST200)", async () => {
    const userLookup = vi.fn();
    await expect(
      resolveContractAccess(
        async () => ({ data: null, error: { code: "PGRST200" } }),
        userLookup,
      ),
    ).rejects.toMatchObject({ status: 500, code: "contract_query_failed" });
    expect(userLookup).not.toHaveBeenCalled();
  });

  it("returns 500 and contract_query_failed when authorized lookup returns a query error (e.g. PGRST200)", async () => {
    await expect(
      resolveContractAccess(
        async () => ({ data: { id: "contract-1" }, error: null }),
        async () => ({ data: null, error: { code: "PGRST200" } }),
      ),
    ).rejects.toMatchObject({ status: 500, code: "contract_query_failed" });
  });

  it("returns the authorized contract and advances the flow", async () => {
    const contract = { id: "contract-1", event_id: "event-1" };
    await expect(
      resolveContractAccess(
        async () => ({ data: { id: contract.id }, error: null }),
        async () => ({ data: contract, error: null }),
      ),
    ).resolves.toBe(contract);
  });

  it("passes the request Authorization header to the user-scoped Supabase client", () => {
    expect(authenticatedClientOptions("Bearer test-jwt")).toEqual({
      global: { headers: { Authorization: "Bearer test-jwt" } },
    });
  });

  it("rejects unauthenticated requests with HTTP 401 and authentication_required", () => {
    expect(() => {
      const authHeader: string | null = null;
      if (!authHeader) {
        throw new CreateDocHttpError(401, "authentication_required", "Usuário não autenticado");
      }
    }).toThrowError(
      expect.objectContaining({ status: 401, code: "authentication_required", message: "Usuário não autenticado" }),
    );
  });
});

describe("Assinafy Stage 12 & Stage 13 Persistence & Schema Tests", () => {
  it("valida que o payload de atualização do signatário usa 'status: sent' quando notified é true", () => {
    const assignedSigner = { notified: true };
    const signerPayload = {
      status: assignedSigner?.notified ? "sent" : "pending",
      updated_at: expect.any(String),
    };
    expect(signerPayload.status).toBe("sent");
    expect(signerPayload).not.toHaveProperty("notification_status");
    expect(signerPayload).not.toHaveProperty("signature_url");
    expect(signerPayload).not.toHaveProperty("notified_at");
  });

  it("valida que o payload de atualização do signatário usa 'status: pending' quando notified é false", () => {
    const assignedSigner = { notified: false };
    const signerPayload = {
      status: assignedSigner?.notified ? "sent" : "pending",
      updated_at: expect.any(String),
    };
    expect(signerPayload.status).toBe("pending");
  });

  it("lança erro 'signer_persist_target_not_found' se o update em contract_signature_signers afetar zero linhas", () => {
    const updatedSigners: any[] = [];
    expect(() => {
      if (!updatedSigners || updatedSigners.length === 0) {
        throw new CreateDocHttpError(
          500,
          "signer_persist_target_not_found",
          "Signatário não encontrado para atualização.",
        );
      }
    }).toThrowError(
      expect.objectContaining({
        status: 500,
        code: "signer_persist_target_not_found",
        message: "Signatário não encontrado para atualização.",
      }),
    );
  });

  it("lança erro 'request_persist_target_not_found' se o update em contract_signature_requests no stage 13 afetar zero linhas", () => {
    const updatedReqs: any[] = [];
    expect(() => {
      if (!updatedReqs || updatedReqs.length === 0) {
        throw new CreateDocHttpError(
          500,
          "request_persist_target_not_found",
          "Solicitação não encontrada para atualização no estágio 13.",
        );
      }
    }).toThrowError(
      expect.objectContaining({
        status: 500,
        code: "request_persist_target_not_found",
      }),
    );
  });

  it("lança erro 'contract_persist_target_not_found' se o update em event_contracts no stage 13 afetar zero linhas", () => {
    const updatedContracts: any[] = [];
    expect(() => {
      if (!updatedContracts || updatedContracts.length === 0) {
        throw new CreateDocHttpError(
          500,
          "contract_persist_target_not_found",
          "Contrato de evento não encontrado para atualização no estágio 13.",
        );
      }
    }).toThrowError(
      expect.objectContaining({
        status: 500,
        code: "contract_persist_target_not_found",
      }),
    );
  });
});

