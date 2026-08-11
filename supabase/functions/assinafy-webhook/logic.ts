export function canonicalStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalStringify(record[key])}`).join(",")}}`;
}

export function extractProvidedToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) return authHeader.substring(7).trim();
  return (
    req.headers.get("x-webhook-secret")?.trim() ||
    req.headers.get("x-webhook-token")?.trim() ||
    new URL(req.url).searchParams.get("token")?.trim() ||
    null
  );
}

export function redactSensitive(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const clone: Record<string, unknown> | unknown[] = Array.isArray(value)
    ? [...value]
    : { ...(value as Record<string, unknown>) };
  const sensitiveKeys = [
    "cpf",
    "password",
    "token",
    "secret",
    "authorization",
    "x-webhook-secret",
    "x-webhook-token",
    "email",
    "phone",
  ];
  for (const key of Object.keys(clone)) {
    const record = clone as Record<string, unknown>;
    record[key] = sensitiveKeys.includes(key.toLowerCase())
      ? "[REDACTED]"
      : redactSensitive(record[key]);
  }
  return clone;
}

export async function secureTokenMatches(
  provided: string | null,
  expected: string,
): Promise<boolean> {
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const a = new Uint8Array(providedHash);
  const b = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}
