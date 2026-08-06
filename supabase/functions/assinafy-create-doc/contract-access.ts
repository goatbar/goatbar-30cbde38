import { CreateDocHttpError } from "./logic.ts";

export type ContractLookupResult<T> = {
  data: T | null;
  error: { code?: string } | null;
};

/**
 * Separates existence (service role) from access (the caller's JWT/RLS).
 * Responses contain no contract data, so an unauthorized caller only receives
 * the semantic denial selected by the API.
 */
export async function resolveContractAccess<T>(
  lookupAsAdmin: () => Promise<ContractLookupResult<{ id: string }>>,
  lookupAsUser: () => Promise<ContractLookupResult<T>>,
): Promise<T> {
  const existence = await lookupAsAdmin();
  if (existence.error)
    throw new CreateDocHttpError(500, "contract_query_failed", "Falha ao consultar o contrato.");
  if (!existence.data)
    throw new CreateDocHttpError(404, "contract_not_found", "Contrato não encontrado.");

  const authorized = await lookupAsUser();
  if (authorized.error)
    throw new CreateDocHttpError(
      500,
      "contract_query_failed",
      "Falha ao consultar o contrato.",
    );
  if (!authorized.data)
    throw new CreateDocHttpError(403, "contract_access_denied", "Usuário sem acesso ao contrato.");
  return authorized.data;
}

