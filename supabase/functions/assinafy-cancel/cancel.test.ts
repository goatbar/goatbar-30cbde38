import { describe, it, expect, vi, beforeEach } from "vitest";
import { processCancellation } from "./logic";
import * as assinafyClient from "../_shared/assinafy-client";

vi.mock("../_shared/assinafy-client", () => ({
  cancelDocument: vi.fn(),
}));

describe("assinafy-cancel", () => {
  let admin: any;
  let maybeSingle: ReturnType<typeof vi.fn>;
  let updates: Array<{ table: string; payload: any }>;

  beforeEach(() => {
    vi.clearAllMocks();
    updates = [];
    maybeSingle = vi.fn();
    admin = {
      from: vi.fn((table: string) => {
        const chain: any = {
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          maybeSingle: () => maybeSingle(),
          update: vi.fn((payload: any) => {
            updates.push({ table, payload });
            return chain;
          }),
        };
        return chain;
      }),
    };
  });

  const contract = { id: "contract-1", status: "sent", signed_file_url: null, fully_signed_at: null };
  const request = {
    id: "req-1",
    dispatch_status: "pending_signature",
    external_document_id: "ext-1",
  };

  it("cancela na Assinafy e libera o rascunho após confirmação", async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: contract, error: null })
      .mockResolvedValueOnce({ data: request, error: null })
      .mockResolvedValueOnce({ data: request, error: null })
      .mockResolvedValueOnce({ data: { id: "contract-1" }, error: null });
    vi.mocked(assinafyClient.cancelDocument).mockResolvedValueOnce({} as any);

    const result = await processCancellation("contract-1", admin);

    expect(result).toEqual({ success: true, status: "canceled" });
    expect(assinafyClient.cancelDocument).toHaveBeenCalledWith("ext-1");
    expect(updates).toContainEqual(expect.objectContaining({
      table: "contract_signature_requests",
      payload: expect.objectContaining({ dispatch_status: "canceled", internal_status: "cancelled" }),
    }));
    expect(updates).toContainEqual(expect.objectContaining({
      table: "event_contracts",
      payload: expect.objectContaining({ status: "draft", legal_snapshot: null, sent_for_signature_at: null }),
    }));
  });

  it("suporta cancelamento após assinatura parcial sem apagar histórico", async () => {
    const partial = { ...request, dispatch_status: "partially_signed" };
    maybeSingle
      .mockResolvedValueOnce({ data: contract })
      .mockResolvedValueOnce({ data: partial })
      .mockResolvedValueOnce({ data: partial })
      .mockResolvedValueOnce({ data: { id: "contract-1" } });
    vi.mocked(assinafyClient.cancelDocument).mockResolvedValueOnce({} as any);

    expect((await processCancellation("contract-1", admin)).success).toBe(true);
  });

  it("permite cancelar uma solicitação em reconciliação com documento remoto conhecido", async () => {
    const pendingReconciliation = {
      ...request,
      dispatch_status: "reconciliation_required",
    };
    maybeSingle
      .mockResolvedValueOnce({ data: contract })
      .mockResolvedValueOnce({ data: pendingReconciliation })
      .mockResolvedValueOnce({ data: pendingReconciliation })
      .mockResolvedValueOnce({ data: { id: "contract-1" } });
    vi.mocked(assinafyClient.cancelDocument).mockResolvedValueOnce({} as any);

    expect((await processCancellation("contract-1", admin)).success).toBe(true);
    expect(assinafyClient.cancelDocument).toHaveBeenCalledWith("ext-1");
  });

  it("não tenta cancelar solicitação incerta sem ID externo", async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: contract })
      .mockResolvedValueOnce({ data: { ...request, dispatch_status: "reconciliation_required", external_document_id: null } });
    const result = await processCancellation("contract-1", admin);
    expect(result.success).toBe(false);
    expect(assinafyClient.cancelDocument).not.toHaveBeenCalled();
  });

  it("não libera a regeneração se a Assinafy retornar 404", async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: contract })
      .mockResolvedValueOnce({ data: request })
      .mockResolvedValueOnce({ data: request });
    vi.mocked(assinafyClient.cancelDocument).mockRejectedValueOnce(new Error("API (404)"));

    const result = await processCancellation("contract-1", admin);

    expect(result.success).toBe(false);
    expect(result.status).toBe("reconciliation_required");
    expect(updates.some((u) => u.table === "event_contracts")).toBe(false);
    expect(updates).toContainEqual(expect.objectContaining({
      table: "contract_signature_requests",
      payload: expect.objectContaining({ dispatch_status: "reconciliation_required" }),
    }));
  });

  it("não cancela contrato totalmente assinado", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { ...contract, status: "signed" } });

    const result = await processCancellation("contract-1", admin);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Termo Aditivo");
    expect(assinafyClient.cancelDocument).not.toHaveBeenCalled();
  });

  it("bloqueia solicitação já concluída", async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: contract })
      .mockResolvedValueOnce({ data: { ...request, dispatch_status: "completed" } });

    const result = await processCancellation("contract-1", admin);

    expect(result.success).toBe(false);
    expect(assinafyClient.cancelDocument).not.toHaveBeenCalled();
  });

  it("reconcilia o rascunho se o envio já foi cancelado anteriormente", async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: contract })
      .mockResolvedValueOnce({ data: { ...request, dispatch_status: "canceled" } })
      .mockResolvedValueOnce({ data: { id: "contract-1" } });

    const result = await processCancellation("contract-1", admin);

    expect(result).toEqual({ success: true, status: "canceled" });
    expect(assinafyClient.cancelDocument).not.toHaveBeenCalled();
  });
});
