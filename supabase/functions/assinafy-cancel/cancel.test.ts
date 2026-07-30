import { describe, it, expect, vi, beforeEach } from "vitest";
import { processCancellation } from "./logic";
import * as assinafyClient from "../_shared/assinafy-client";

vi.mock("../_shared/assinafy-client", () => ({
  cancelDocument: vi.fn(),
}));

describe("assinafy-cancel", () => {
  let supabaseAdminMock: any;
  let updateMock: ReturnType<typeof vi.fn>;
  let eqMock: ReturnType<typeof vi.fn>;
  let inMock: ReturnType<typeof vi.fn>;
  let selectMock: ReturnType<typeof vi.fn>;
  let orderMock: ReturnType<typeof vi.fn>;
  let limitMock: ReturnType<typeof vi.fn>;
  let maybeSingleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    maybeSingleMock = vi.fn();
    const chainable = {
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      maybeSingle: maybeSingleMock,
    };
    
    // Alias explicitly so they can be spied on if needed, but we mainly care about `maybeSingle` and `update`
    eqMock = chainable.eq;
    inMock = chainable.in;
    selectMock = chainable.select;
    orderMock = chainable.order;
    limitMock = chainable.limit;
    updateMock = chainable.update;

    supabaseAdminMock = {
      from: vi.fn().mockReturnValue(chainable),
    };
  });

  it("deve retornar reconciliation_required em caso de 404 da API", async () => {
    // 1. Simula o lock bem-sucedido
    maybeSingleMock.mockResolvedValueOnce({
      data: { id: "req-1", external_document_id: "ext-1" },
      error: null,
    });

    // 2. Simula falha 404 na API externa
    vi.mocked(assinafyClient.cancelDocument).mockRejectedValueOnce(new Error("API falhou com HTTP status (404)"));

    const result = await processCancellation("contract-1", supabaseAdminMock);

    // O status final deve ser reconciliation_required
    expect(result.success).toBe(false);
    expect(result.error).toContain("404");
    expect(result.status).toBe("reconciliation_required");

    // Verifica se salvou reconciliation_required no banco
    expect(updateMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      dispatch_status: "reconciliation_required",
      last_error: expect.stringContaining("404"),
    }));
  });

  it("deve cancelar com sucesso quando a API retornar 200", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { id: "req-1", external_document_id: "ext-1" },
      error: null,
    });

    vi.mocked(assinafyClient.cancelDocument).mockResolvedValueOnce({} as any);

    const result = await processCancellation("contract-1", supabaseAdminMock);

    expect(result.success).toBe(true);
    expect(result.status).toBe("canceled");

    expect(updateMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      dispatch_status: "canceled",
      internal_status: "cancelled",
    }));
  });

  it("deve bloquear se não houver requests pendentes/ativos", async () => {
    // 1. Lock falha
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    // 2. Busca o request atual que está completado (não pode cancelar)
    maybeSingleMock.mockResolvedValueOnce({
      data: { dispatch_status: "completed" },
      error: null,
    });

    const result = await processCancellation("contract-1", supabaseAdminMock);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Não foi possível iniciar o cancelamento");
  });

  it("deve retornar imediatamente se já estiver cancelado", async () => {
    // 1. Lock falha (pois dispatch_status não é active/pending/idle)
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    // 2. Busca o request atual e vê que está 'canceled'
    maybeSingleMock.mockResolvedValueOnce({
      data: { dispatch_status: "canceled" },
      error: null,
    });

    const result = await processCancellation("contract-1", supabaseAdminMock);

    expect(result.success).toBe(true);
    expect(result.status).toBe("canceled");
    // Não deve chamar a API de cancelamento
    expect(assinafyClient.cancelDocument).not.toHaveBeenCalled();
  });
});
