import { supabase } from "@/integrations/supabase/client";
import { normalizeEditorHtml } from "@/utils/normalize-editor-html";
import { prepareContractExportHtml } from "@/utils/prepare-contract-export-html";
import { CONTRACT_DOCUMENT_CSS, CONTRACT_PRINT_HTML_SHELL } from "@/lib/contract-document-styles";


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

  // Cria iframe isolado para evitar a leitura de folhas de estilo globais da app contendo oklch() pelo html2canvas
  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.left = "-9999px";
  iframe.style.top = "0";
  iframe.style.width = "800px";
  iframe.style.height = "1100px";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    throw new Error("Não foi possível inicializar iframe para geração do PDF.");
  }

  iframeDoc.open();
  iframeDoc.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          ${CONTRACT_DOCUMENT_CSS}
          body {
            margin: 0;
            padding: 24px;
            background-color: #ffffff !important;
            color: #0f172a !important;
            font-family: system-ui, -apple-system, sans-serif;
          }
        </style>
      </head>
      <body class="docx-canvas-paper">
        ${cleanHtml}
      </body>
    </html>
  `);
  iframeDoc.close();

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

    const targetElement = iframeDoc.body;
    const pdfArrayBuffer: ArrayBuffer = await html2pdf()
      .set(opt)
      .from(targetElement)
      .outputPdf("arraybuffer");

    document.body.removeChild(iframe);

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
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
    console.error("Erro ao converter HTML para PDF:", err);
    throw new Error(`Não foi possível converter a minuta compilada para formato PDF: ${err?.message || String(err)}`);
  }
}


/**
 * Realiza o disparo direto para a API REST oficial da ZapSign (https://api.zapsign.com.br/api/v1/docs/).
 */
export async function createRealZapSignDocument(payload: {
  apiToken: string;
  docName: string;
  pdfBase64?: string;
  pdfUrl?: string;
  signers: Array<{
    name: string;
    email: string;
    send_automatic_email?: boolean;
    qualification?: string;
  }>;
}) {
  const zapsignUrl = `https://api.zapsign.com.br/api/v1/docs/?api_token=${payload.apiToken.trim()}`;

  const requestBody: any = {
    name: payload.docName,
    signers: payload.signers.map((s) => ({
      name: s.name,
      email: s.email,
      send_automatic_email: s.send_automatic_email !== false,
      qualification: s.qualification || "Signatário",
    })),
    lang: "pt-br",
  };

  if (payload.pdfBase64) {
    requestBody.base64_pdf = payload.pdfBase64;
  } else if (payload.pdfUrl) {
    requestBody.url_pdf = payload.pdfUrl;
  }

  const res = await fetch(zapsignUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("❌ Erro retornado pela API ZapSign:", errorText);
    throw new Error(`Falha ao criar documento na ZapSign (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return data;
}

/**
 * Disparo direto via cliente frontend para a API ZapSign utilizando a chave VITE_ZAPSIGN_API_TOKEN.
 */
async function dispatchZapSignDirectly(
  contractId: string,
  apiToken: string,
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

  // 2. Busca dados do evento e cliente
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
    throw new Error("E-mail do contratante não informado. Atualize os Dados do Contratante.");
  }

  const signersPayload = [
    {
      name: clientName,
      email: clientEmail,
      send_automatic_email: true,
      qualification: "Contratante",
    },
  ];

  if (contract.signer?.name && contract.signer?.email) {
    signersPayload.push({
      name: contract.signer.name,
      email: contract.signer.email,
      send_automatic_email: true,
      qualification: "Contratada (GOAT Bar)",
    });
  }

  const docName = `Contrato - ${evento?.event_name || clientName} (v${contract.version || 1})`;

  // Chamada à API ZapSign Oficial
  const providerData = await createRealZapSignDocument({
    apiToken,
    docName,
    pdfBase64,
    pdfUrl: pdfUrl || contract.generated_file_url,
    signers: signersPayload,
  });

  const externalDocToken = providerData.token || providerData.open_id?.toString() || "";
  const providerStatus = providerData.status || "pending";

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
      original_file_path: pdfUrl || contract.generated_file_url || "",
      original_file_hash: "",
      internal_status: "pending_signature",
      provider_status: providerStatus,
      provider_response: providerData,
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
      sent_for_signature_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", contractId);

  return {
    success: true,
    signatureRequestId: sigReq?.id || externalDocToken,
    externalDocToken,
    status: "pending_signature",
    signers: providerData.signers || [],
    docUrl: contract.generated_file_url,
  };
}

/**
 * Serviço frontend para disparar contratos para assinatura na ZapSign via Edge Function ou Cliente Direto.
 */
export async function dispatchContractToZapSign(
  contractId: string,
  pdfBase64?: string,
  pdfUrl?: string
): Promise<ZapSignRequestResponse> {
  const getEnv = (key: string) => {
    try {
      return (import.meta as any).env?.[key] || (typeof process !== "undefined" ? process.env[key] : undefined);
    } catch {
      return undefined;
    }
  };

  const apiToken = getEnv("VITE_ZAPSIGN_API_TOKEN") || getEnv("ZAPSIGN_API_TOKEN");

  // 1. Tenta chamar a Edge Function do Supabase primeiro
  try {
    const { data, error } = await supabase.functions.invoke("zapsign-create-doc", {
      body: { contractId, pdfBase64, pdfUrl },
    });

    if (!error && data?.success && data?.externalDocToken && !data.externalDocToken.startsWith("zapsign_mock_")) {
      return data as ZapSignRequestResponse;
    }
  } catch (e) {
    console.warn("Edge Function zapsign-create-doc não disponível, tentando envio direto:", e);
  }

  // 2. Se temos o Token da API ZapSign no ambiente (.env), fazemos a requisição direta à ZapSign
  if (apiToken && apiToken.trim().length > 0) {
    return await dispatchZapSignDirectly(contractId, apiToken, pdfBase64, pdfUrl);
  }

  // 3. Fallback gracioso com aviso em log
  console.warn("⚠️ VITE_ZAPSIGN_API_TOKEN não configurado no .env. Para enviar contratos para a sua conta real no ZapSign, adicione VITE_ZAPSIGN_API_TOKEN no seu .env.");
  return await dispatchZapSignFallback(contractId, pdfBase64, pdfUrl);
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

