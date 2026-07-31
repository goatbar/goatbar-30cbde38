// _shared/assinafy-client.ts

export const ASSINAFY_ENV = Deno.env.get("ASSINAFY_ENVIRONMENT") || "sandbox";
export const ASSINAFY_BASE_URL =
  ASSINAFY_ENV === "production" ? "https://api.assinafy.com.br" : "https://sandbox.assinafy.com.br";
export const ASSINAFY_API_KEY = Deno.env.get("ASSINAFY_API_KEY");
export const ASSINAFY_ACCOUNT_ID = Deno.env.get("ASSINAFY_ACCOUNT_ID");

if (!ASSINAFY_API_KEY || !ASSINAFY_ACCOUNT_ID) {
  console.warn("ASSINAFY_API_KEY ou ASSINAFY_ACCOUNT_ID não configurados no ambiente!");
}

export function getAssinafyHeaders(isFormData = false) {
  const headers: Record<string, string> = {
    "X-Api-Key": ASSINAFY_API_KEY || "",
  };
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

export async function assinafyFetch(url: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });

    if (!res.ok) {
      let errText = "Erro desconhecido";
      try {
        errText = await res.text();
      } catch (e) {}
      // Limpa chave de API caso ela esteja no erro
      const sanitizedErr = errText.replace(new RegExp(ASSINAFY_API_KEY || "N/A", "g"), "***");
      throw new Error(`Assinafy API Error (${res.status}): ${sanitizedErr}`);
    }

    if (res.status === 204) {
      return { data: null };
    }

    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await res.json();
    } else if (contentType && contentType.includes("application/pdf")) {
      return { buffer: await res.arrayBuffer(), headers: res.headers };
    }

    return { data: await res.text() };
  } finally {
    clearTimeout(timeout);
  }
}

export async function uploadDocument(fileName: string, pdfBuffer: Uint8Array) {
  const url = `${ASSINAFY_BASE_URL}/v1/accounts/${ASSINAFY_ACCOUNT_ID}/documents`;
  const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);

  const parts = [
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`,
    `Content-Type: application/pdf\r\n\r\n`,
  ];

  const encoder = new TextEncoder();
  const preamble = encoder.encode(parts.join(""));
  const postamble = encoder.encode(`\r\n--${boundary}--\r\n`);

  const body = new Uint8Array(preamble.length + pdfBuffer.length + postamble.length);
  body.set(preamble, 0);
  body.set(pdfBuffer, preamble.length);
  body.set(postamble, preamble.length + pdfBuffer.length);

  const headers = getAssinafyHeaders(true);
  headers["Content-Type"] = `multipart/form-data; boundary=${boundary}`;

  return await assinafyFetch(url, { method: "POST", headers, body });
}

export async function findSigner(email: string) {
  const targetEmail = email.trim().toLowerCase();
  const encodedSearch = encodeURIComponent(targetEmail);
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = `${ASSINAFY_BASE_URL}/v1/accounts/${ASSINAFY_ACCOUNT_ID}/signers?search=${encodedSearch}&page=${page}&per-page=${perPage}`;
    const res = await assinafyFetch(url, { method: "GET", headers: getAssinafyHeaders() });

    const signers = res.data || res || [];
    if (!Array.isArray(signers) || signers.length === 0) break;

    // Match exato
    const match = signers.find((s: any) => s.email?.trim().toLowerCase() === targetEmail);
    if (match) return match;

    if (signers.length < perPage) break;
    page++;
  }

  return null;
}

export async function createSigner(fullName: string, email: string) {
  const url = `${ASSINAFY_BASE_URL}/v1/accounts/${ASSINAFY_ACCOUNT_ID}/signers`;
  return await assinafyFetch(url, {
    method: "POST",
    headers: getAssinafyHeaders(),
    body: JSON.stringify({ full_name: fullName, email: email.trim().toLowerCase() }),
  });
}

export async function createAssignment(
  documentId: string,
  signers: { id: string; verification_method?: string; notification_methods?: string[] }[],
) {
  const url = `${ASSINAFY_BASE_URL}/v1/documents/${documentId}/assignments`;
  // Do not rely on provider defaults: without an explicit notification method the
  // assignment can be created successfully without sending the invitation email.
  const payload = {
    method: "virtual",
    signers: signers.map((signer, index) => ({
      ...signer,
      verification_method: signer.verification_method || "Email",
      notification_methods: signer.notification_methods || ["Email"],
      step: index + 1,
    })),
  };

  return await assinafyFetch(url, {
    method: "POST",
    headers: getAssinafyHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getDocumentStatus(documentId: string) {
  const url = `${ASSINAFY_BASE_URL}/v1/documents/${documentId}`;
  return await assinafyFetch(url, { method: "GET", headers: getAssinafyHeaders() });
}

export async function downloadArtifact(documentId: string, artifactName: string) {
  const url = `${ASSINAFY_BASE_URL}/v1/documents/${documentId}/download/${artifactName}`;
  return await assinafyFetch(url, { method: "GET", headers: getAssinafyHeaders() });
}

export async function resendAssignment(documentId: string, assignmentId: string, signerId: string) {
  const url = `${ASSINAFY_BASE_URL}/v1/documents/${documentId}/assignments/${assignmentId}/signers/${signerId}/resend`;
  return await assinafyFetch(url, { method: "PUT", headers: getAssinafyHeaders() });
}

export async function cancelDocument(documentId: string) {
  const url = `${ASSINAFY_BASE_URL}/v1/documents/${documentId}`;
  return await assinafyFetch(url, { method: "DELETE", headers: getAssinafyHeaders() });
}
