// _shared/assinafy-client.ts

export const ASSINAFY_ENV = Deno.env.get("ASSINAFY_ENVIRONMENT") || "sandbox";
export const ASSINAFY_BASE_URL =
  ASSINAFY_ENV === "production" ? "https://api.assinafy.com.br" : "https://sandbox.assinafy.com.br";
export const ASSINAFY_API_KEY = Deno.env.get("ASSINAFY_API_KEY");
export const ASSINAFY_ACCOUNT_ID = Deno.env.get("ASSINAFY_ACCOUNT_ID");

export type AssinafyDiagnostic = {
  requestStarted: boolean;
  assinafyRequestSent: boolean;
  endpoint: string;
  method: string;
  timestamp: string;
  httpStatus: number | null;
  responseBody: unknown;
  errorMessage: string | null;
  timedOut: boolean;
  authenticationRejected: boolean;
};

export class AssinafyApiError extends Error {
  constructor(
    public providerStatus: number | null,
    public diagnostic: AssinafyDiagnostic,
  ) {
    super(
      diagnostic.timedOut
        ? "Assinafy request timed out"
        : `Assinafy API Error (${providerStatus ?? "no response"})`,
    );
    this.name = "AssinafyApiError";
  }
}

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

function sanitizeProviderResponse(value: unknown, depth = 0): unknown {
  if (depth > 6) return "<truncated>";
  if (Array.isArray(value))
    return value.slice(0, 25).map((item) => sanitizeProviderResponse(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        /token|secret|password|api.?key|authorization|access.?code/i.test(key)
          ? "<redacted>"
          : sanitizeProviderResponse(item, depth + 1),
      ]),
    );
  }
  if (typeof value === "string") {
    try {
      const url = new URL(value);
      if (url.search) url.search = "?<redacted>";
      return url.toString();
    } catch {
      return value.length > 4000 ? `${value.slice(0, 4000)}…` : value;
    }
  }
  return value;
}

export async function assinafyFetch(url: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
  const parsedUrl = new URL(url);
  // Query values can contain signer PII. Keep the endpoint while redacting values.
  parsedUrl.search = parsedUrl.searchParams.size
    ? `?${[...parsedUrl.searchParams.keys()].map((key) => `${key}=<redacted>`).join("&")}`
    : "";
  const diagnostic: AssinafyDiagnostic = {
    requestStarted: true,
    assinafyRequestSent: false,
    endpoint: parsedUrl.toString(),
    method: options.method || "GET",
    timestamp: new Date().toISOString(),
    httpStatus: null,
    responseBody: null,
    errorMessage: null,
    timedOut: false,
    authenticationRejected: false,
  };

  try {
    diagnostic.assinafyRequestSent = true;
    console.info("[assinafy] outbound_request", { ...diagnostic, responseBody: undefined });
    const res = await fetch(url, { ...options, signal: controller.signal });
    diagnostic.httpStatus = res.status;
    diagnostic.authenticationRejected = res.status === 401 || res.status === 403;

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/pdf")) {
      const result = { buffer: await res.arrayBuffer(), headers: res.headers, diagnostic };
      console.info("[assinafy] inbound_response", { ...diagnostic, responseBody: "<pdf binary>" });
      return result;
    }

    const responseText = res.status === 204 ? "" : await res.text();
    let responseBody: unknown = responseText || null;
    if (contentType.includes("application/json") && responseText) {
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = responseText;
      }
    }
    // Limit log/diagnostic size. Provider validation bodies are retained; credentials never are.
    diagnostic.responseBody = sanitizeProviderResponse(responseBody);
    console.info("[assinafy] inbound_response", diagnostic);

    if (!res.ok) {
      diagnostic.errorMessage = `Assinafy returned HTTP ${res.status}`;
      throw new AssinafyApiError(res.status, diagnostic);
    }

    if (res.status === 204) return { data: null, diagnostic };
    if (contentType.includes("application/json"))
      return { ...(responseBody as Record<string, unknown>), diagnostic };
    return { data: responseBody, diagnostic };
  } catch (error) {
    if (error instanceof AssinafyApiError) throw error;
    diagnostic.timedOut = error instanceof DOMException && error.name === "AbortError";
    diagnostic.errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[assinafy] transport_error", diagnostic);
    throw new AssinafyApiError(null, diagnostic);
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
  signers: { id: string; verification_method?: string; notification_methods?: string[]; step?: number }[],
) {
  const url = `${ASSINAFY_BASE_URL}/v1/documents/${documentId}/assignments`;
  // Parallel notification (step 1 for all signers) ensures all required parties receive
  // the invitation email immediately upon assignment creation.
  const payload = {
    method: "virtual",
    signers: signers.map((signer) => ({
      id: signer.id,
      verification_method: signer.verification_method || "Email",
      notification_methods: signer.notification_methods || ["Email"],
      step: signer.step ?? 1,
    })),
  };

  return await assinafyFetch(url, {
    method: "POST",
    headers: getAssinafyHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getDocumentStatus(documentId: string) {
  const url = `${ASSINAFY_BASE_URL}/v1/documents/${documentId}?expand=assignment`;
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
