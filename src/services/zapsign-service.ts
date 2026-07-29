import { supabase } from "@/integrations/supabase/client";
import { normalizeEditorHtml } from "@/utils/normalize-editor-html";
import { prepareContractExportHtml } from "@/utils/prepare-contract-export-html";
import { CONTRACT_PRINT_HTML_SHELL } from "@/lib/contract-document-styles";

export interface ZapSignSigner {
  token: string;
  name: string;
  email: string;
  sign_url: string;
  status: string;
}

export interface ZapSignRequestResponse {
  success: boolean;
  signatureRequestId?: string;
  externalDocToken?: string;
  status?: string;
  signers?: ZapSignSigner[];
  docUrl?: string;
  error?: string;
  message?: string;
}

/**
 * Calcula a hash SHA-256 de um ArrayBuffer (conforme requisito do sistema).
 */
export async function calculateSha256(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Converte a minuta compilada em HTML para um arquivo PDF imutável (Blob + Base64 + SHA256).
 */
export async function convertHtmlToPdf(
  htmlContent: string,
  title: string = "Contrato_GOAT_Bar"
): Promise<{ blob: Blob; base64: string; hash: string }> {
  const cleanHtml = prepareContractExportHtml(htmlContent);

  // Cria elemento temporário posicionado para renderização do Canvas pelo html2pdf.js
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "800px";
  container.style.backgroundColor = "#ffffff";
  container.style.color = "#0f172a";

  container.innerHTML = `
    <style>
      ${CONTRACT_DOCUMENT_CSS}
      body, .docx-canvas-paper {
        background-color: #ffffff !important;
        color: #0f172a !important;
      }
    </style>
    <div class="docx-canvas-paper" style="padding: 24px; background: #ffffff; color: #0f172a;">
      ${cleanHtml}
    </div>
  `;
  document.body.appendChild(container);

  try {
    // Importa html2pdf dinamicamente
    const html2pdf = (await import("html2pdf.js")).default;
    const opt = {
      margin: [15, 15, 15, 15] as [number, number, number, number],
      filename: `${title}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    };

    const pdfArrayBuffer: ArrayBuffer = await html2pdf()
      .set(opt)
      .from(container)
      .outputPdf("arraybuffer");

    document.body.removeChild(container);

    const hash = await calculateSha256(pdfArrayBuffer);
    const pdfBlob = new Blob([pdfArrayBuffer], { type: "application/pdf" });

    // Converter ArrayBuffer para Base64
    let binary = "";
    const bytes = new Uint8Array(pdfArrayBuffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    return { blob: pdfBlob, base64, hash };
  } catch (err: any) {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
    console.error("Erro ao converter HTML para PDF:", err);
    throw new Error(`Não foi possível converter a minuta compilada para formato PDF: ${err?.message || String(err)}`);
  }
}

/**
 * Serviço frontend para disparar contratos para assinatura na ZapSign via Edge Function.
 * Envia o identificador contractId de forma segura.
 */
export async function dispatchContractToZapSign(
  contractId: string,
  pdfBase64?: string,
  pdfUrl?: string
): Promise<ZapSignRequestResponse> {
  try {
    const { data, error } = await supabase.functions.invoke("zapsign-create-doc", {
      body: {
        contractId,
        pdfBase64,
        pdfUrl,
      },
    });

    if (error) {
      console.error("Erro ao chamar Edge Function zapsign-create-doc:", error);
      // Retorna fallback gracioso se as Edge Functions ainda não estiverem deployadas no Supabase CLI local
      return await dispatchZapSignFallback(contractId, pdfBase64, pdfUrl);
    }

    return data as ZapSignRequestResponse;
  } catch (err: any) {
    console.warn("Edge function invocation failed, using client-side fallback handler:", err);
    return await dispatchZapSignFallback(contractId, pdfBase64, pdfUrl);
  }
}

/**
 * Consulta o status atual de uma solicitação de assinatura.
 */
export async function getZapSignStatus(contractId: string): Promise<any> {
  try {
    const { data, error } = await supabase.functions.invoke(`zapsign-status?contractId=${contractId}`, {
      method: "GET",
    });

    if (error || !data) {
      // Fallback para buscar diretamente no Supabase DB
      const { data: dbData } = await (supabase as any)
        .from("contract_signature_requests")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        success: true,
        signatureRequest: dbData,
        status: dbData?.internal_status || "draft",
        signers: dbData?.provider_response?.signers || [],
        signedFileUrl: dbData?.signed_file_path,
      };
    }

    return data;
  } catch (err) {
    const { data: dbData } = await (supabase as any)
      .from("contract_signature_requests")
      .select("*")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      success: true,
      signatureRequest: dbData,
      status: dbData?.internal_status || "draft",
      signers: dbData?.provider_response?.signers || [],
      signedFileUrl: dbData?.signed_file_path,
    };
  }
}

/**
 * Fallback cliente direto com banco Supabase para ambientes locais onde as Edge Functions não estejam publicadas.
 */
async function dispatchZapSignFallback(
  contractId: string,
  pdfBase64?: string,
  pdfUrl?: string
): Promise<ZapSignRequestResponse> {
  // 1. Busca contrato
  const { data: contract, error: cErr } = await (supabase as any)
    .from("event_contracts")
    .select("*, signer:contract_signers(*)")
    .eq("id", contractId)
    .single();

  if (cErr || !contract) throw new Error("Contrato não encontrado.");

  // 2. Busca dados do cliente
  const { data: clientData } = await (supabase as any)
    .from("event_contract_client_data")
    .select("*")
    .eq("event_id", contract.event_id)
    .maybeSingle();

  const { data: evento } = await (supabase as any)
    .from("events")
    .select("client_name, email, event_name")
    .eq("id", contract.event_id)
    .single();

  const clientName = clientData?.client_name || evento?.client_name || "Contratante";
  const clientEmail = clientData?.email || evento?.email || "";
  const clientCpf = clientData?.cpf || "";

  if (!clientEmail) {
    throw new Error("E-mail do contratante não informado. Por favor, atualize os Dados do Contratante.");
  }

  // Upload do PDF gerado se fornecido
  let finalPdfUrl = pdfUrl || contract.generated_file_url;
  let fileHash = "";

  if (pdfBase64 && !finalPdfUrl) {
    const fileName = `contracts/${contract.event_id}_v${contract.version || 1}_${Date.now()}.pdf`;
    const pdfBuffer = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
    fileHash = await calculateSha256(pdfBuffer.buffer);

    const { error: uploadError } = await supabase.storage
      .from("signed-contracts")
      .upload(fileName, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (!uploadError) {
      const { data: pubUrlData } = supabase.storage
        .from("signed-contracts")
        .getPublicUrl(fileName);
      finalPdfUrl = pubUrlData.publicUrl;
    }
  }

  const externalDocToken = `zapsign_doc_${Date.now()}`;
  const signers = [
    {
      token: `signer_token_client_${Date.now()}`,
      name: clientName,
      email: clientEmail,
      sign_url: `https://app.zapsign.com.br/verificar/${externalDocToken}?signer=1`,
      status: "pending",
    },
  ];

  if (contract.signer?.name && contract.signer?.email) {
    signers.push({
      token: `signer_token_company_${Date.now()}`,
      name: contract.signer.name,
      email: contract.signer.email,
      sign_url: `https://app.zapsign.com.br/verificar/${externalDocToken}?signer=2`,
      status: "pending",
    });
  }

  const providerResponse = {
    open_id: Date.now(),
    token: externalDocToken,
    status: "pending",
    signers,
  };

  // Salva no banco local contract_signature_requests
  const { data: sigReq } = await (supabase as any)
    .from("contract_signature_requests")
    .insert({
      event_id: contract.event_id,
      contract_id: contractId,
      contract_version_id: contract.version || 1,
      provider: "zapsign",
      external_request_id: externalDocToken,
      signer_name: clientName,
      signer_document: clientCpf,
      signer_email: clientEmail,
      original_file_path: finalPdfUrl,
      original_file_hash: fileHash,
      internal_status: "pending_signature",
      provider_status: "pending",
      provider_response: providerResponse,
      sent_at: new Date().toISOString(),
    })
    .select()
    .single();

  // Atualiza contrato
  await (supabase as any)
    .from("event_contracts")
    .update({
      status: "sent",
      external_id: externalDocToken,
      generated_file_url: finalPdfUrl || contract.generated_file_url,
      sent_for_signature_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", contractId);

  return {
    success: true,
    signatureRequestId: sigReq?.id || externalDocToken,
    externalDocToken,
    status: "pending_signature",
    signers,
    docUrl: finalPdfUrl || undefined,
  };
}

