// supabase/functions/_shared/canva-crypto.ts
// PKCE (RFC 7636) and State cryptography utilities using standard Web Crypto APIs

const UNRESERVED_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

/**
 * Generates a cryptographically random code_verifier for PKCE.
 * Must be between 43 and 128 characters, containing only [A-Za-z0-9-._~].
 */
export function generateCodeVerifier(length = 96): string {
  if (length < 43 || length > 128) {
    throw new Error("PKCE code_verifier length must be between 43 and 128 characters.");
  }
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);

  let result = "";
  const charsLength = UNRESERVED_CHARS.length;
  for (let i = 0; i < length; i++) {
    result += UNRESERVED_CHARS[randomBytes[i] % charsLength];
  }
  return result;
}

/**
 * Computes BASE64URL(SHA256(code_verifier)) without padding '=' according to RFC 7636.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  if (!verifier || verifier.length < 43 || verifier.length > 128) {
    throw new Error("Invalid PKCE code_verifier for challenge generation.");
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashBytes = new Uint8Array(hashBuffer);

  // Convert binary buffer to binary string
  let binary = "";
  for (let i = 0; i < hashBytes.byteLength; i++) {
    binary += String.fromCharCode(hashBytes[i]);
  }

  // Base64 encode and convert to Base64URL without padding
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Generates a cryptographically random, unique state parameter for CSRF protection.
 */
export function generateState(length = 32): string {
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
