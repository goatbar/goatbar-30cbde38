export type DispatchRecord = {
  id: string;
  dispatch_status: string;
  original_file_hash?: string | null;
  external_document_id?: string | null;
  external_assignment_id?: string | null;
};

export class CreateDocHttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public providerStatus?: number,
  ) {
    super(message);
    this.name = "CreateDocHttpError";
  }
}

export function authenticatedClientOptions(authHeader: string) {
  return { global: { headers: { Authorization: authHeader } } };
}

export type CreateDocPayload = {
  contractId: string;
  pdfBase64?: string;
  pdfUrl?: string;
  pdfHash: string;
};

export function validateCreateDocPayload(value: unknown): CreateDocPayload {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new CreateDocHttpError(400, "invalid_json_body", "O body deve ser um objeto JSON.");
  const body = value as Record<string, unknown>;
  if (typeof body.contractId !== "string" || !body.contractId.trim())
    throw new CreateDocHttpError(422, "contract_id_required", "contractId é obrigatório.");
  if (typeof body.pdfHash !== "string" || !/^[a-f0-9]{64}$/i.test(body.pdfHash))
    throw new CreateDocHttpError(
      422,
      "pdf_hash_invalid",
      "pdfHash deve ser um SHA-256 hexadecimal.",
    );
  const hasBase64 = typeof body.pdfBase64 === "string" && body.pdfBase64.length > 0;
  const hasUrl = typeof body.pdfUrl === "string" && body.pdfUrl.length > 0;
  if (!hasBase64 && !hasUrl)
    throw new CreateDocHttpError(422, "pdf_required", "PDF é obrigatório (pdfBase64 ou pdfUrl).");
  return {
    contractId: body.contractId,
    pdfBase64: hasBase64 ? (body.pdfBase64 as string) : undefined,
    pdfUrl: hasUrl ? (body.pdfUrl as string) : undefined,
    pdfHash: body.pdfHash.toLowerCase(),
  };
}

export function decodePdfBase64(input: string): Uint8Array {
  const encoded = input.startsWith("data:application/pdf;base64,")
    ? input.slice("data:application/pdf;base64,".length)
    : input;
  if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0)
    throw new CreateDocHttpError(422, "pdf_base64_invalid", "pdfBase64 inválido.");
  let binary: string;
  try {
    binary = atob(encoded);
  } catch {
    throw new CreateDocHttpError(422, "pdf_base64_invalid", "pdfBase64 inválido.");
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (!bytes.length) throw new CreateDocHttpError(422, "pdf_empty", "O PDF está vazio.");
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
    throw new CreateDocHttpError(
      422,
      "pdf_signature_invalid",
      "O arquivo recebido não possui assinatura PDF válida.",
    );
  return bytes;
}

export async function validatePdfHash(bytes: Uint8Array, expectedHash: string): Promise<void> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const actual = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  if (actual !== expectedHash.toLowerCase())
    throw new CreateDocHttpError(
      409,
      "pdf_hash_mismatch",
      "Hash do PDF recebido não confere com o conteúdo.",
    );
}

export function validateSigner(name: unknown, email: unknown): { name: string; email: string } {
  if (typeof name !== "string" || !name.trim())
    throw new CreateDocHttpError(
      422,
      "signer_name_required",
      "Nome do signatário não informado no evento.",
    );
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    throw new CreateDocHttpError(
      422,
      "signer_email_required",
      "E-mail válido do signatário não informado no evento.",
    );
  return { name: name.trim(), email: email.trim().toLowerCase() };
}

export type RequiredSigner = { role: "client" | "company"; name: string; email: string };

/** Both parties are mandatory; the company party comes from event_contracts.signer_id. */
export function validateRequiredSigners(
  client: { name: unknown; email: unknown },
  company: { name: unknown; email: unknown } | null,
): RequiredSigner[] {
  const validatedClient = validateSigner(client.name, client.email);
  if (!company) {
    throw new CreateDocHttpError(
      422,
      "company_signer_required",
      "Selecione o responsável legal da Goat Bar no contrato antes do envio.",
    );
  }
  const validatedCompany = validateSigner(company.name, company.email);
  if (validatedClient.email === validatedCompany.email) {
    throw new CreateDocHttpError(
      422,
      "distinct_signers_required",
      "Contratante e contratada devem possuir signatários distintos.",
    );
  }
  return [
    { role: "client", ...validatedClient },
    { role: "company", ...validatedCompany },
  ];
}

export function buildRequiredAssignment(
  signerIds: Array<{ role: RequiredSigner["role"]; externalSignerId: string }>,
): Array<{ id: string }> {
  const byRole = new Map(signerIds.map((signer) => [signer.role, signer.externalSignerId]));
  const clientId = byRole.get("client");
  const companyId = byRole.get("company");
  if (signerIds.length !== 2 || !clientId || !companyId || clientId === companyId) {
    throw new CreateDocHttpError(
      422,
      "two_party_assignment_required",
      "O assignment exige exatamente contratante e contratada.",
    );
  }
  return [{ id: clientId }, { id: companyId }];
}

export function decideDispatch(existing: DispatchRecord | null, pdfHash: string) {
  if (!existing) return { action: "create" as const, request: null };

  const hasExternalDoc = Boolean(existing.external_document_id);
  const hasExternalAssign = Boolean(existing.external_assignment_id);
  const hasExternalOperationSucceeded = hasExternalDoc && hasExternalAssign;

  if (["pending_signature", "signed", "completed"].includes(existing.dispatch_status)) {
    return { action: "reuse" as const, request: existing };
  }

  if (existing.dispatch_status === "failed") {
    if (hasExternalOperationSucceeded) {
      return { action: "reconcile_local_persistence" as const, request: existing };
    }
    if (!hasExternalDoc && !hasExternalAssign) {
      return { action: "obsolete_failed_without_external_ids" as const, request: existing };
    }
    return { action: "hash_conflict" as const, request: existing };
  }

  if (existing.dispatch_status === "processing")
    return { action: "processing" as const, request: existing };
  if (existing.dispatch_status === "reconciliation_required")
    return { action: "reconcile" as const, request: existing };

  if (existing.original_file_hash && existing.original_file_hash !== pdfHash) {
    return { action: "hash_conflict" as const, request: existing };
  }

  return { action: "continue" as const, request: existing };
}
