import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock assinafy client downloadArtifact
vi.mock("../../supabase/functions/_shared/assinafy-client", () => ({
  downloadArtifact: vi.fn(),
}));

import { archiveAssinafyDocument } from "../../supabase/functions/_shared/archive-assinafy-document";
import { downloadArtifact } from "../../supabase/functions/_shared/assinafy-client";

describe("archiveAssinafyDocument (Server-Side Archiver)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. [SUCESSO] converte documento 'pending' para 'archived', salva PDF no Storage e atualiza metadados", async () => {
    const mockPdfBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 53]); // %PDF-1.5
    (downloadArtifact as any).mockResolvedValue({ buffer: mockPdfBytes.buffer });

    const mockPendingDoc = {
      id: "doc-pending-1",
      event_id: "event-123",
      contract_id: "contract-123",
      addendum_id: null,
      external_document_id: "assinafy-doc-999",
      archive_status: "pending",
      storage_path: null,
    };

    const mockSelectDoc = vi.fn().mockReturnThis();
    const mockEqDoc = vi.fn().mockReturnThis();
    const mockSingleDoc = vi.fn().mockResolvedValue({ data: mockPendingDoc, error: null });

    const mockUploadStorage = vi.fn().mockResolvedValue({ data: { path: "events/event-123/contracts/contract-123/documents/doc-pending-1_Assinafy_Signed.pdf" }, error: null });

    let updatedPayload: any = null;
    const mockUpdateDoc = vi.fn().mockImplementation((payload) => {
      updatedPayload = payload;
      return {
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: { ...mockPendingDoc, ...payload }, error: null }),
          }),
        }),
      };
    });

    const mockAdminClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "contract_documents") {
          return {
            select: mockSelectDoc,
            eq: mockEqDoc,
            single: mockSingleDoc,
            update: mockUpdateDoc,
          };
        }
        return {};
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: mockUploadStorage,
        }),
      },
    };

    (mockSelectDoc as any).mockReturnValue({ eq: () => ({ single: mockSingleDoc }) });

    const result = await archiveAssinafyDocument(mockAdminClient, "doc-pending-1");

    expect(downloadArtifact).toHaveBeenCalledWith("assinafy-doc-999", "certificated");
    expect(mockUploadStorage).toHaveBeenCalledWith(
      "events/event-123/contracts/contract-123/documents/doc-pending-1_Assinafy_Signed.pdf",
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: "application/pdf", upsert: true }),
    );

    expect(result.alreadyArchived).toBe(false);
    expect(updatedPayload.archive_status).toBe("archived");
    expect(updatedPayload.storage_bucket).toBe("contract-documents");
    expect(updatedPayload.storage_path).toBe(
      "events/event-123/contracts/contract-123/documents/doc-pending-1_Assinafy_Signed.pdf",
    );
    expect(updatedPayload.mime_type).toBe("application/pdf");
    expect(updatedPayload.file_size).toBe(mockPdfBytes.byteLength);
    expect(updatedPayload.is_signed).toBe(true);
    expect(updatedPayload.is_final).toBe(true);
  });

  it("2. [FALHA] se o download da Assinafy falhar, atualiza archive_status = 'failed' sem alterar o status do contrato", async () => {
    (downloadArtifact as any).mockRejectedValue(new Error("Conexão interrompida"));

    const mockPendingDoc = {
      id: "doc-pending-2",
      event_id: "event-123",
      contract_id: "contract-123",
      external_document_id: "assinafy-doc-err",
      archive_status: "pending",
    };

    let updatedFailedStatus: string | null = null;
    const mockUpdateDoc = vi.fn().mockImplementation((payload) => {
      updatedFailedStatus = payload.archive_status;
      return {
        eq: () => Promise.resolve({ data: null, error: null }),
      };
    });

    const mockAdminClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "contract_documents") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnValue({ single: () => Promise.resolve({ data: mockPendingDoc, error: null }) }),
            update: mockUpdateDoc,
          };
        }
        return {};
      }),
      storage: {
        from: vi.fn(),
      },
    };

    await expect(archiveAssinafyDocument(mockAdminClient, "doc-pending-2")).rejects.toThrow(
      "Conexão interrompida",
    );

    expect(updatedFailedStatus).toBe("failed");
  });

  it("3. [IDEMPOTÊNCIA] documento já arquivado ('archived') não faz novo download nem upload", async () => {
    const mockArchivedDoc = {
      id: "doc-already-archived",
      archive_status: "archived",
      storage_path: "events/e1/contracts/c1/documents/doc_Assinafy_Signed.pdf",
      external_document_id: "assinafy-doc-111",
    };

    const mockAdminClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ single: () => Promise.resolve({ data: mockArchivedDoc, error: null }) }),
      }),
      storage: {
        from: vi.fn(),
      },
    };

    const result = await archiveAssinafyDocument(mockAdminClient, "doc-already-archived");

    expect(result.alreadyArchived).toBe(true);
    expect(downloadArtifact).not.toHaveBeenCalled();
    expect(mockAdminClient.storage.from).not.toHaveBeenCalled();
  });
});
