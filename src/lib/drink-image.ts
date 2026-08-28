const UNSAFE_PERSISTED_SCHEMES = /^(?:blob:|data:|idb:)/i;

/**
 * The canonical database value is either an absolute http(s) URL or a root-relative
 * public asset path. Browser-local blob/data/IndexedDB references are never portable.
 */
export function resolveDrinkImage(reference: unknown): string | null {
  if (typeof reference !== "string") return null;
  const value = reference.trim();
  if (!value || UNSAFE_PERSISTED_SCHEMES.test(value)) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  return `/${value.replace(/^\/+/, "")}`;
}

