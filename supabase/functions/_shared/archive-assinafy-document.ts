import { downloadArtifact } from "./assinafy-client.ts";

/**
 * Função Canônica Server-Side para Arquivamento de PDF Assinado da Assinafy no Storage Próprio
 */
export async function archiveAssinafyDocument(adminClient: any, documentId: string) {
  // 1. Busca o documento em contract_documents
  const { data: doc, error } = await adminClient
    .from("contract_documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (error || !doc) {
    throw new Error("Registro em contract_documents não encontrado.");
  }

  // Idempotência: Se já estiver arquivado com storage_path, não faz novo download/upload
  if (doc.archive_status === "archived" && doc.storage_path) {
    return { doc, alreadyArchived: true };
  }

  if (!doc.external_document_id) {
    throw new Error("Documento não possui external_document_id da Assinafy.");
  }

  try {
    // 2. Baixa o PDF certificado final consolidado da Assinafy API
    const res: any = await downloadArtifact(doc.external_document_id, "certificated");
    if (!res?.buffer) {
      throw new Error("Servidor da Assinafy não retornou o PDF certificado final.");
    }

    const pdfBuffer = new Uint8Array(res.buffer);
    const parentFolder = doc.contract_id ? `contracts/${doc.contract_id}` : `addendums/${doc.addendum_id}`;
    const storagePath = `events/${doc.event_id}/${parentFolder}/documents/${doc.id}_Assinafy_Signed.pdf`;
    const bucket = "contract-documents";

    // 3. Upload seguro para o bucket privado do Supabase Storage
    const { error: uploadError } = await adminClient.storage
      .from(bucket)
      .upload(storagePath, pdfBuffer, { upsert: true, contentType: "application/pdf" });

    if (uploadError) {
      throw new Error(`Falha no upload para Supabase Storage: ${uploadError.message}`);
    }

    // 4. Transição atômica pending -> archived no banco
    const { data: updated, error: updateError } = await adminClient
      .from("contract_documents")
      .update({
        storage_bucket: bucket,
        storage_path: storagePath,
        mime_type: "application/pdf",
        file_size: pdfBuffer.byteLength,
        archive_status: "archived",
        is_signed: true,
        is_final: true,
        signed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId)
      .select()
      .single();

    if (updateError) throw updateError;
    return { doc: updated, alreadyArchived: false };
  } catch (err: any) {
    console.error(`[archiveAssinafyDocument] Erro ao arquivar documento ${documentId}:`, err);

    // Marca o arquivamento como 'failed' sem alterar o status assinado do contrato
    await adminClient
      .from("contract_documents")
      .update({
        archive_status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    throw err;
  }
}
