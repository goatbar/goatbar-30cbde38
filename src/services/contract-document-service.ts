import { supabase } from "@/integrations/supabase/client";

export type DocumentType =
  | "original_contract"
  | "signed_contract"
  | "manual_signed_contract"
  | "attachment"
  | "addendum"
  | "signed_addendum"
  | "other";

export type DocumentSource = "system" | "assinafy" | "manual";
export type ArchiveStatus = "pending" | "archived" | "failed" | "external_only";

export interface ContractDocumentRow {
  id: string;
  event_id: string;
  contract_id: string | null;
  addendum_id: string | null;
  document_type: DocumentType;
  document_name: string;
  original_filename: string | null;
  storage_bucket: string;
  storage_path: string | null;
  external_url: string | null;
  mime_type: string | null;
  file_size: number | null;
  source: DocumentSource;
  external_document_id: string | null;
  external_assignment_id: string | null;
  is_signed: boolean;
  is_final: boolean;
  archive_status: ArchiveStatus;
  manual_signature_date: string | null;
  uploaded_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UploadDocumentParams {
  file: File;
  eventId: string;
  contractId?: string | null;
  addendumId?: string | null;
  documentType: DocumentType;
  documentName: string;
  isSigned?: boolean;
  manualSignatureDate?: string | null;
  markAsFinalContract?: boolean;
  source?: DocumentSource;
  userId?: string | null;
}

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const contractDocumentService = {
  /**
   * Upload de documento para o storage privado e registro na tabela canônica contract_documents
   */
  async uploadDocument(params: UploadDocumentParams): Promise<ContractDocumentRow> {
    const { file, eventId, contractId, addendumId, documentType, documentName } = params;

    let finalContractId = contractId;
    let finalAddendumId = addendumId;

    // 1. Resolução automática de contract_id a partir do addendumId
    if (finalAddendumId && !finalContractId) {
      const { data: addendum, error: addErr } = await supabase
        .from("contract_addendums")
        .select("contract_id")
        .eq("id", finalAddendumId)
        .single();

      if (addErr || !addendum?.contract_id) {
        throw new Error(`Termo aditivo "${finalAddendumId}" não possui contrato principal vinculado.`);
      }
      finalContractId = addendum.contract_id;
    }

    // 2. Resolução automática de vínculo contratual para o evento se não fornecido
    if (!finalContractId && !finalAddendumId) {
      const { data: contracts, error: fetchErr } = await supabase
        .from("event_contracts")
        .select("id, status, created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (fetchErr) throw fetchErr;

      if (contracts && contracts.length > 0) {
        const activeContracts = contracts.filter((c) => c.status !== "cancelled");
        if (activeContracts.length > 1) {
          throw new Error(
            "Múltiplos contratos ativos encontrados para este evento. Especifique qual contrato deseja vincular ao documento.",
          );
        }
        finalContractId = activeContracts[0]?.id || contracts[0]?.id;
      } else {
        // Se for um anexo genérico ou outro documento e não existir nenhum contrato, não cria contrato automático
        if (["attachment", "other"].includes(documentType) && !params.markAsFinalContract) {
          throw new Error(
            "Nenhum contrato existente para este evento. Crie ou envie o contrato principal antes de anexar documentos complementares.",
          );
        }

        // Se for um documento contratual principal, cria o registro inicial seguro (status draft)
        const nowStr = new Date().toISOString();
        const { data: newContract, error: createError } = await supabase
          .from("event_contracts")
          .insert({
            event_id: eventId,
            status: "draft",
            version: 1,
            generated_at: nowStr,
          })
          .select("id")
          .single();

        if (createError || !newContract) {
          throw new Error(`Falha ao criar contrato para o evento: ${createError?.message}`);
        }
        finalContractId = newContract.id;
      }
    }

    if (!finalContractId && !finalAddendumId) {
      throw new Error(
        "Todo documento deve estar vinculado a um contrato ou a um termo aditivo.",
      );
    }

    if (documentType === "signed_contract" && finalAddendumId) {
      throw new Error("Contrato assinado deve estar vinculado diretamente ao contrato principal.");
    }

    if (documentType === "signed_addendum" && (!finalContractId || !finalAddendumId)) {
      throw new Error("Termo aditivo assinado deve estar vinculado ao contrato e ao aditivo.");
    }

    // 2. Validação de tamanho e formato
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      throw new Error(
        `O arquivo ${file.name} possui ${sizeMB} MB, excedendo o limite máximo permitido de 25 MB.`,
      );
    }

    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error(
        `O formato ${file.type || "desconhecido"} não é aceito. Formatos suportados: PDF, JPG, PNG, WEBP, DOC, DOCX.`,
      );
    }

    // 3. Geração de caminho único e seguro no Storage privado
    const docId = crypto.randomUUID();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const parentFolder = finalContractId ? `contracts/${finalContractId}` : `addendums/${finalAddendumId}`;
    const storagePath = `events/${eventId}/${parentFolder}/documents/${docId}_${sanitizedName}`;
    const bucket = "contract-documents";

    // 4. Upload direto para o Storage privado (SEM Data URL Base64 fallback!)
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, file, { upsert: false, contentType: file.type });

    if (uploadError) {
      console.error("[contractDocumentService] Falha no upload para o Storage:", uploadError);
      throw new Error(`Erro ao enviar arquivo para o armazenamento: ${uploadError.message}`);
    }

    // 5. Inserção do registro na tabela canônica contract_documents
    const isSigned = params.isSigned ?? ["signed_contract", "manual_signed_contract", "signed_addendum"].includes(documentType);
    const source = params.source || "manual";
    const manualSigDate = params.manualSignatureDate ? new Date(params.manualSignatureDate).toISOString() : null;

    const { data: newDoc, error: dbError } = await supabase
      .from("contract_documents")
      .insert({
        id: docId,
        event_id: eventId,
        contract_id: finalContractId || null,
        addendum_id: finalAddendumId || null,
        document_type: documentType,
        document_name: documentName,
        original_filename: file.name,
        storage_bucket: bucket,
        storage_path: storagePath,
        mime_type: file.type || "application/pdf",
        file_size: file.size,
        source: source,
        is_signed: isSigned,
        is_final: params.markAsFinalContract || false,
        archive_status: "archived",
        manual_signature_date: manualSigDate,
        signed_at: isSigned ? manualSigDate || new Date().toISOString() : null,
        uploaded_by: params.userId || null,
      })
      .select()
      .single();

    if (dbError) {
      console.error("[contractDocumentService] Falha ao registrar documento no banco:", dbError);
      throw new Error(`Erro ao registrar documento: ${dbError.message}`);
    }

    // 6. Atualização consciente do status do contrato (se solicitado explicitamente pelo usuário)
    if (params.markAsFinalContract && finalContractId) {
      await supabase
        .from("event_contracts")
        .update({
          status: "signed",
          fully_signed_at: manualSigDate || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", finalContractId);
    }

    return newDoc as ContractDocumentRow;
  },

  /**
   * Registra um documento gerado pelo sistema (HTML/PDF original)
   */
  async registerSystemDocument(params: {
    eventId: string;
    contractId?: string | null;
    addendumId?: string | null;
    documentType: DocumentType;
    documentName: string;
    storagePath: string;
    externalUrl?: string | null;
    fileSize?: number;
  }): Promise<ContractDocumentRow> {
    const { data, error } = await supabase
      .from("contract_documents")
      .insert({
        event_id: params.eventId,
        contract_id: params.contractId || null,
        addendum_id: params.addendumId || null,
        document_type: params.documentType,
        document_name: params.documentName,
        original_filename: `${params.documentName.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`,
        storage_bucket: "contract-documents",
        storage_path: params.storagePath,
        external_url: params.externalUrl || null,
        mime_type: "application/pdf",
        file_size: params.fileSize || 0,
        source: "system",
        is_signed: false,
        is_final: false,
        archive_status: params.storagePath ? "archived" : "external_only",
      })
      .select()
      .single();

    if (error) throw error;
    return data as ContractDocumentRow;
  },

  /**
   * Lista todos os documentos ativos do evento, contrato ou aditivo
   */
  async listDocuments(params: {
    eventId: string;
    contractId?: string;
    addendumId?: string;
  }): Promise<ContractDocumentRow[]> {
    let query = supabase
      .from("contract_documents")
      .select("*")
      .eq("event_id", params.eventId)
      .is("deleted_at", null);

    if (params.contractId) {
      query = query.eq("contract_id", params.contractId);
    }
    if (params.addendumId) {
      query = query.eq("addendum_id", params.addendumId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;
    return (data as ContractDocumentRow[]) || [];
  },

  /**
   * Obtém uma Signed URL temporária (1 hora) para visualização/download seguro de um documento
   */
  async getDocumentSignedUrl(documentId: string): Promise<string> {
    const { data: doc, error } = await supabase
      .from("contract_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (error || !doc) throw new Error("Documento não encontrado.");

    // Se for URL externa legada (sem storage_path local)
    if (doc.archive_status === "external_only" || !doc.storage_path) {
      if (doc.external_url) return doc.external_url;
      throw new Error("Documento legado sem URL de acesso.");
    }

    // Gera Signed URL temporária com expiração de 3600s (1 hora)
    const { data: signedData, error: signedError } = await supabase.storage
      .from(doc.storage_bucket || "contract-documents")
      .createSignedUrl(doc.storage_path, 3600);

    if (signedError || !signedData?.signedUrl) {
      throw new Error(`Falha ao gerar link de acesso seguro ao documento: ${signedError?.message || "Erro de armazenamento"}`);
    }

    return signedData.signedUrl;
  },

  /**
   * Soft delete para remoção controlada de documentos não jurídicos
   */
  async softDeleteDocument(documentId: string, userId?: string): Promise<void> {
    const { data: doc } = await supabase
      .from("contract_documents")
      .select("is_signed, document_type")
      .eq("id", documentId)
      .single();

    if (doc?.is_signed) {
      throw new Error(
        "Documentos assinados possuem valor jurídico e não podem ser excluídos diretamente.",
      );
    }

    const { error } = await supabase
      .from("contract_documents")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    if (error) throw error;
  },

  /**
   * Re-executa o arquivamento de um documento assinado via Assinafy invocando a Edge Function server-side assinafy-archive
   */
  async retryArchivingFromAssinafy(documentId: string): Promise<ContractDocumentRow> {
    // Invoca a Edge Function server-side assinafy-archive com autorização JWT
    const { data: res, error } = await supabase.functions.invoke("assinafy-archive", {
      body: { documentId },
    });

    if (error || !res?.success) {
      throw new Error(
        res?.error || error?.message || "Falha ao executar arquivamento server-side.",
      );
    }

    const { data: updated, error: dbErr } = await supabase
      .from("contract_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (dbErr) throw dbErr;
    return updated as ContractDocumentRow;
  },
};
