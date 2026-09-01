export type SupabaseErrorDetails = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
};

export function getSupabaseErrorDetails(error: unknown): SupabaseErrorDetails {
  if (!error || typeof error !== "object") {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  const value = error as Record<string, unknown>;
  return {
    code: typeof value.code === "string" ? value.code : undefined,
    message: typeof value.message === "string" ? value.message : undefined,
    details: typeof value.details === "string" ? value.details : undefined,
    hint: typeof value.hint === "string" ? value.hint : undefined,
    status: typeof value.status === "number" ? value.status : undefined,
  };
}

export function formatSupabaseError(error: unknown): string {
  const { code, message, details, hint } = getSupabaseErrorDetails(error);
  return [code && `[${code}]`, message, details, hint && `Dica: ${hint}`]
    .filter(Boolean)
    .join(" — ");
}

export function logSupabaseError(context: string, error: unknown): void {
  console.error(context, { ...getSupabaseErrorDetails(error), error });
}
