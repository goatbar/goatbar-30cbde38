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
  it("1. lança erro ao tentar fazer upload sem contrato nem aditivo quando a criação de contrato falha", async () => {
    (supabase.from as any) = vi.fn().mockImplementation((table: string) => {
      if (table === "event_contracts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: new Error("Falha ao criar contrato") }),
            }),
          }),
        };
      }
      return {};
    });

    const file = new File(["test content"], "contrato.pdf", { type: "application/pdf" });

    await expect(
      contractDocumentService.uploadDocument({
        file,
        eventId: "event-123",
        documentType: "manual_signed_contract",
        documentName: "Contrato Sem Vínculo",
      }),
    ).rejects.toThrow("Falha ao criar contrato para o evento");
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

  it("9. Caso A: cria contrato automático quando evento não possui event_contracts e realiza o upload", async () => {
    const file = new File(["pdf content"], "contrato_novo.pdf", { type: "application/pdf" });

    const mockSelectContracts = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const mockInsertContract = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "created-contract-1", status: "signed" }, error: null }),
      }),
    });

    const mockUploadStorage = vi.fn().mockResolvedValue({ data: { path: "events/e1/contracts/created-contract-1/documents/doc1.pdf" }, error: null });

    (supabase.storage.from as any) = vi.fn().mockReturnValue({ upload: mockUploadStorage });
    (supabase.from as any) = vi.fn().mockImplementation((table: string) => {
      if (table === "event_contracts") {
        return {
          select: mockSelectContracts,
          insert: mockInsertContract,
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        };
      }
      if (table === "contract_documents") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "doc-created-1",
                  contract_id: "created-contract-1",
                  document_type: "manual_signed_contract",
                  storage_bucket: "contract-documents",
                  storage_path: "events/e1/contracts/created-contract-1/documents/doc1.pdf",
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const doc = await contractDocumentService.uploadDocument({
      file,
      eventId: "e1",
      documentType: "manual_signed_contract",
      documentName: "Contrato Manual Novo",
      markAsFinalContract: true,
    });

    expect(doc.contract_id).toBe("created-contract-1");
    expect(mockInsertContract).toHaveBeenCalled();
  });

  it("10. Casos B e C: reutiliza o contrato existente para 2º upload sem criar contratos duplicados", async () => {
    const file = new File(["pdf content"], "anexo_segundo.pdf", { type: "application/pdf" });

    const mockSelectContracts = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [{ id: "existing-contract-1", status: "signed", created_at: "2026-09-01T10:00:00Z" }],
          error: null,
        }),
      }),
    });

    const mockInsertContract = vi.fn();
    const mockUploadStorage = vi.fn().mockResolvedValue({ data: { path: "events/e1/contracts/existing-contract-1/documents/doc2.pdf" }, error: null });

    (supabase.storage.from as any) = vi.fn().mockReturnValue({ upload: mockUploadStorage });
    (supabase.from as any) = vi.fn().mockImplementation((table: string) => {
      if (table === "event_contracts") {
        return {
          select: mockSelectContracts,
          insert: mockInsertContract,
        };
      }
      if (table === "contract_documents") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "doc-2",
                  contract_id: "existing-contract-1",
                  document_type: "attachment",
                  storage_bucket: "contract-documents",
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const doc = await contractDocumentService.uploadDocument({
      file,
      eventId: "e1",
      documentType: "attachment",
      documentName: "Segundo Documento",
    });

    expect(doc.contract_id).toBe("existing-contract-1");
    expect(mockInsertContract).not.toHaveBeenCalled();
  });

  it("11. Caso D: lança erro se houver múltiplos contratos ativos ambíguos", async () => {
    const file = new File(["pdf content"], "doc.pdf", { type: "application/pdf" });

    const mockSelectContracts = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            { id: "c1", status: "signed", created_at: "2026-09-01T10:00:00Z" },
            { id: "c2", status: "draft", created_at: "2026-09-01T11:00:00Z" },
          ],
          error: null,
        }),
      }),
    });

    (supabase.from as any) = vi.fn().mockReturnValue({
      select: mockSelectContracts,
    });

    await expect(
      contractDocumentService.uploadDocument({
        file,
        eventId: "e1",
        documentType: "attachment",
        documentName: "Anexo Ambíguo",
      }),
    ).rejects.toThrow("Múltiplos contratos ativos encontrados para este evento.");
  });

  it("12. Casos E e F: anexo não altera o status do contrato para signed, contrato final sim", async () => {
    const file = new File(["pdf content"], "anexo.pdf", { type: "application/pdf" });
    const mockEqUpdate = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockUpdateContract = vi.fn().mockReturnValue({ eq: mockEqUpdate });

    (supabase.storage.from as any) = vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: "path" }, error: null }),
    });

    (supabase.from as any) = vi.fn().mockImplementation((table: string) => {
      if (table === "event_contracts") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [{ id: "c1", status: "draft" }],
              error: null,
            }),
          }),
          update: mockUpdateContract,
        };
      }
      if (table === "contract_documents") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "d1", contract_id: "c1" }, error: null }),
            }),
          }),
        };
      }
      return {};
    });

    // Caso E: Anexo sem marcação de contrato final
    await contractDocumentService.uploadDocument({
      file,
      eventId: "e1",
      contractId: "c1",
      documentType: "attachment",
      documentName: "Anexo",
      markAsFinalContract: false,
    });

    expect(mockUpdateContract).not.toHaveBeenCalled();

    // Caso F: Contrato final manual
    await contractDocumentService.uploadDocument({
      file,
      eventId: "e1",
      contractId: "c1",
      documentType: "manual_signed_contract",
      documentName: "Contrato Final",
      markAsFinalContract: true,
    });

    expect(mockUpdateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "signed",
      }),
    );
  });

  it("13. Cenário 4: se o upload para o Storage falhar, o contrato NÃO é alterado para 'signed'", async () => {
    const file = new File(["pdf content"], "contrato_falha.pdf", { type: "application/pdf" });
    const mockUpdateContract = vi.fn();

    (supabase.storage.from as any) = vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: null, error: new Error("Storage cheio / Indisponível") }),
    });

    (supabase.from as any) = vi.fn().mockImplementation((table: string) => {
      if (table === "event_contracts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [{ id: "c1", status: "draft" }], error: null }),
            }),
          }),
          update: mockUpdateContract,
        };
      }
      return {};
    });

    await expect(
      contractDocumentService.uploadDocument({
        file,
        eventId: "e1",
        contractId: "c1",
        documentType: "manual_signed_contract",
        documentName: "Contrato Falha",
        markAsFinalContract: true,
      }),
    ).rejects.toThrow("Erro ao enviar arquivo para o armazenamento: Storage cheio / Indisponível");

    expect(mockUpdateContract).not.toHaveBeenCalled();
  });

  it("14. Cenário 5: resolve contract_id automaticamente a partir do addendumId", async () => {
    const file = new File(["pdf content"], "aditivo_assinado.pdf", { type: "application/pdf" });

    (supabase.storage.from as any) = vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: "path" }, error: null }),
    });

    (supabase.from as any) = vi.fn().mockImplementation((table: string) => {
      if (table === "contract_addendums") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { contract_id: "parent-contract-99" }, error: null }),
            }),
          }),
        };
      }
      if (table === "contract_documents") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "doc-add-1",
                  contract_id: "parent-contract-99",
                  addendum_id: "add-123",
                  document_type: "signed_addendum",
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const doc = await contractDocumentService.uploadDocument({
      file,
      eventId: "e1",
      addendumId: "add-123",
      documentType: "signed_addendum",
      documentName: "Aditivo 1 Assinado",
    });

    expect(doc.contract_id).toBe("parent-contract-99");
  });

  it("15. Anexo genérico sem contrato existente não cria contrato automático e lança erro", async () => {
    const file = new File(["pdf content"], "anexo_orfao.pdf", { type: "application/pdf" });

    (supabase.from as any) = vi.fn().mockImplementation((table: string) => {
      if (table === "event_contracts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      return {};
    });

    await expect(
      contractDocumentService.uploadDocument({
        file,
        eventId: "e-no-contract",
        documentType: "attachment",
        documentName: "Anexo Órfão",
        markAsFinalContract: false,
      }),
    ).rejects.toThrow(
      "Nenhum contrato existente para este evento. Crie ou envie o contrato principal antes de anexar documentos complementares.",
    );
  });

  it("16. Teste A e B: lote com apenas 'other' ou 'attachment' sem contrato existente bloqueia upload", async () => {
    const fileOther = new File(["content"], "outro.pdf", { type: "application/pdf" });
    const mockInsertContract = vi.fn();

    (supabase.from as any) = vi.fn().mockImplementation((table: string) => {
      if (table === "event_contracts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
          insert: mockInsertContract,
        };
      }
      return {};
    });

    await expect(
      contractDocumentService.uploadDocument({
        file: fileOther,
        eventId: "e-no-contract-other",
        documentType: "other",
        documentName: "Outro Documento",
        markAsFinalContract: false,
      }),
    ).rejects.toThrow(
      "Nenhum contrato existente para este evento. Crie ou envie o contrato principal antes de anexar documentos complementares.",
    );

    expect(mockInsertContract).not.toHaveBeenCalled();
  });

  it("17. Teste C: lote misto em evento sem contrato cria EXATAMENTE 1 contrato e vincula os 3 documentos", async () => {
    const fileMain = new File(["pdf"], "contrato_assinado.pdf", { type: "application/pdf" });
    const fileAtt1 = new File(["pdf"], "anexo1.pdf", { type: "application/pdf" });
    const fileAtt2 = new File(["pdf"], "anexo2.pdf", { type: "application/pdf" });

    let contractCreationCount = 0;
    const mockInsertContract = vi.fn().mockImplementation(() => {
      contractCreationCount++;
      return {
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: "batch-contract-uuid-1", status: "draft" }, error: null }),
        }),
      };
    });

    (supabase.storage.from as any) = vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: "path" }, error: null }),
    });

    (supabase.from as any) = vi.fn().mockImplementation((table: string) => {
      if (table === "event_contracts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockImplementation(() => {
                // Primeira chamada retorna [], chamadas posteriores retornam o contrato criado
                if (contractCreationCount === 0) return Promise.resolve({ data: [], error: null });
                return Promise.resolve({ data: [{ id: "batch-contract-uuid-1", status: "draft" }], error: null });
              }),
            }),
          }),
          insert: mockInsertContract,
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        };
      }
      if (table === "contract_documents") {
        return {
          insert: vi.fn().mockImplementation((payload) => ({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: payload.id, contract_id: payload.contract_id }, error: null }),
            }),
          })),
        };
      }
      return {};
    });

    // Simula lote de 3 documentos (1 principal + 2 anexos)
    const doc1 = await contractDocumentService.uploadDocument({
      file: fileMain,
      eventId: "e-batch-1",
      documentType: "manual_signed_contract",
      documentName: "Contrato Assinado",
      markAsFinalContract: true,
    });

    const doc2 = await contractDocumentService.uploadDocument({
      file: fileAtt1,
      eventId: "e-batch-1",
      contractId: doc1.contract_id, // Reutiliza o contrato do lote
      documentType: "attachment",
      documentName: "Anexo 1",
    });

    const doc3 = await contractDocumentService.uploadDocument({
      file: fileAtt2,
      eventId: "e-batch-1",
      contractId: doc1.contract_id, // Reutiliza o contrato do lote
      documentType: "other",
      documentName: "Outro Documento",
    });

    expect(contractCreationCount).toBe(1);
    expect(doc1.contract_id).toBe("batch-contract-uuid-1");
    expect(doc2.contract_id).toBe("batch-contract-uuid-1");
    expect(doc3.contract_id).toBe("batch-contract-uuid-1");
  });

  it("18. Teste D: evento com contrato existente reutiliza o contrato para anexo normalmente", async () => {
    const fileAtt = new File(["pdf"], "anexo_existente.pdf", { type: "application/pdf" });
    const mockInsertContract = vi.fn();

    (supabase.storage.from as any) = vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: "path" }, error: null }),
    });

    (supabase.from as any) = vi.fn().mockImplementation((table: string) => {
      if (table === "event_contracts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [{ id: "existing-c-100", status: "signed" }], error: null }),
            }),
          }),
          insert: mockInsertContract,
        };
      }
      if (table === "contract_documents") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "doc-att-100", contract_id: "existing-c-100" }, error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const doc = await contractDocumentService.uploadDocument({
      file: fileAtt,
      eventId: "e-existing",
      documentType: "attachment",
      documentName: "Anexo em Contrato Existente",
    });

    expect(doc.contract_id).toBe("existing-c-100");
    expect(mockInsertContract).not.toHaveBeenCalled();
  });
});
