import { describe, expect, it, vi } from "vitest";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn(),
      storage: {
        from: vi.fn(),
      },
      functions: {
        invoke: vi.fn(),
      },
    },
  };
});

import { supabase } from "@/integrations/supabase/client";
import { contractDocumentService } from "./contract-document-service";

describe("contractDocumentService", () => {
  it("1. lança erro ao tentar fazer upload sem contrato nem aditivo (documento órfão)", async () => {
    const file = new File(["test content"], "contrato.pdf", { type: "application/pdf" });

    await expect(
      contractDocumentService.uploadDocument({
        file,
        eventId: "event-123",
        documentType: "manual_signed_contract",
        documentName: "Contrato Sem Vínculo",
      }),
    ).rejects.toThrow("Todo documento deve estar vinculado a um contrato ou a um termo aditivo.");
  });

  it("2. lança erro se o tamanho do arquivo exceder 25 MB", async () => {
    const hugeFile = {
      name: "giant_contract.pdf",
      size: 30 * 1024 * 1024, // 30 MB
      type: "application/pdf",
    } as File;

    await expect(
      contractDocumentService.uploadDocument({
        file: hugeFile,
        eventId: "event-123",
        contractId: "contract-123",
        documentType: "manual_signed_contract",
        documentName: "Contrato Gigante",
      }),
    ).rejects.toThrow("excedendo o limite máximo permitido de 25 MB.");
  });

  it("3. lança erro se o formato do arquivo não for um MIME type permitido", async () => {
    const invalidFile = {
      name: "script.exe",
      size: 1024,
      type: "application/x-msdownload",
    } as File;

    await expect(
      contractDocumentService.uploadDocument({
        file: invalidFile,
        eventId: "event-123",
        contractId: "contract-123",
        documentType: "attachment",
        documentName: "Arquivo Executável",
      }),
    ).rejects.toThrow("não é aceito. Formatos suportados: PDF, JPG, PNG, WEBP, DOC, DOCX.");
  });

  it("4. realiza upload no storage privado e insere registro na tabela contract_documents", async () => {
    const mockUpload = vi.fn().mockResolvedValue({ data: { path: "events/event-1/contracts/c1/documents/doc1.pdf" }, error: null });
    const mockInsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: "doc-123",
        event_id: "event-1",
        contract_id: "c1",
        document_type: "manual_signed_contract",
        document_name: "Contrato Físico",
        storage_bucket: "contract-documents",
        storage_path: "events/event-1/contracts/c1/documents/doc1.pdf",
        source: "manual",
        is_signed: true,
        archive_status: "archived",
      },
      error: null,
    });

    (supabase.storage.from as any) = vi.fn().mockReturnValue({ upload: mockUpload });
    (supabase.from as any) = vi.fn().mockImplementation((table: string) => {
      if (table === "contract_documents") {
        return {
          insert: mockInsert,
          select: mockSelect,
          single: mockSingle,
        };
      }
      if (table === "event_contracts") {
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {};
    });

    const file = new File(["pdf content"], "contrato_fisico.pdf", { type: "application/pdf" });

    const doc = await contractDocumentService.uploadDocument({
      file,
      eventId: "event-1",
      contractId: "c1",
      documentType: "manual_signed_contract",
      documentName: "Contrato Físico",
      markAsFinalContract: true,
    });

    expect(doc.id).toBe("doc-123");
    expect(doc.storage_bucket).toBe("contract-documents");
    expect(mockUpload).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();
  });

  it("5. impede soft delete de documentos assinados com valor jurídico", async () => {
    (supabase.from as any) = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { is_signed: true, document_type: "signed_contract" } }),
    });

    await expect(contractDocumentService.softDeleteDocument("doc-signed-1")).rejects.toThrow(
      "Documentos assinados possuem valor jurídico e não podem ser excluídos diretamente.",
    );
  });

  it("6. permite soft delete de anexos não assinados", async () => {
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });

    (supabase.from as any) = vi.fn().mockImplementation((table: string) => {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { is_signed: false, document_type: "attachment" } }),
          update: mockUpdate,
        }),
        update: mockUpdate,
      };
    });

    (mockUpdate as any).mockReturnValue({ eq: mockEq });

    await contractDocumentService.softDeleteDocument("doc-attachment-1", "user-123");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted_by: "user-123",
      }),
    );
  });

  it("7. invoca Edge Function assinafy-archive no retry sem expor segredos no browser", async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      data: { success: true, alreadyArchived: false },
      error: null,
    });
    (supabase.functions.invoke as any) = mockInvoke;

    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: "doc-assinafy-1",
        archive_status: "archived",
        storage_path: "events/e1/contracts/c1/documents/doc-assinafy-1_Assinafy_Signed.pdf",
        is_signed: true,
      },
      error: null,
    });

    (supabase.from as any) = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockSingle,
    });

    const result = await contractDocumentService.retryArchivingFromAssinafy("doc-assinafy-1");

    expect(mockInvoke).toHaveBeenCalledWith("assinafy-archive", {
      body: { documentId: "doc-assinafy-1" },
    });
    expect(result.archive_status).toBe("archived");
  });

  it("8. lança erro amigável se a Edge Function assinafy-archive retornar falha no retry", async () => {
    (supabase.functions.invoke as any) = vi.fn().mockResolvedValue({
      data: { success: false, error: "Falha na conexão com Assinafy" },
      error: null,
    });

    await expect(
      contractDocumentService.retryArchivingFromAssinafy("doc-failed-1"),
    ).rejects.toThrow("Falha na conexão com Assinafy");
  });
});
