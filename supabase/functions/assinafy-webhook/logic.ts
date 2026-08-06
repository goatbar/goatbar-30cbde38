export function canonicalStringify(obj: any): string {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonicalStringify).join(",") + "]";
  const keys = Object.keys(obj).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + canonicalStringify(obj[k])).join(",") + "}";
}

export function extractProvidedToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.substring(7).trim();
  }
  const xSecret = req.headers.get("x-webhook-secret");
  if (xSecret) return xSecret.trim();

  const xToken = req.headers.get("x-webhook-token");
  if (xToken) return xToken.trim();

  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token");
  if (queryToken) return queryToken.trim();

  return null;
}

export function redactSensitive(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  const sensitiveKeys = ['cpf', 'password', 'token', 'secret', 'authorization', 'x-webhook-secret', 'x-webhook-token'];
  
  for (const key of Object.keys(clone)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      clone[key] = '[REDACTED]';
    } else if (typeof clone[key] === 'object' && clone[key] !== null) {
      clone[key] = redactSensitive(clone[key]);
    }
  }
  return clone;
}
