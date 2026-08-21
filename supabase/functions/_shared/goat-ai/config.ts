export const META_GRAPH_API_VERSION = "v21.0";
export const META_GRAPH_API_BASE = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

export function getEnv(key: string, defaultValue = ""): string {
  if (typeof Deno !== "undefined" && Deno.env) {
    return Deno.env.get(key) || defaultValue;
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env[key] || defaultValue;
  }
  return defaultValue;
}

export function getGeminiModel(): string {
  const configured = getEnv("GEMINI_MODEL");
  // If an obsolete model is set in env (1.5, 2.0, 2.5), auto-upgrade to gemini-3.6-flash
  if (configured && (configured.includes("1.5") || configured.includes("2.0") || configured.includes("2.5"))) {
    return "gemini-3.6-flash";
  }
  return configured || "gemini-3.6-flash";
}

export function getWhatsAppMessagesUrl(phoneNumberId: string): string {
  return `${META_GRAPH_API_BASE}/${phoneNumberId}/messages`;
}

export function getWhatsAppMediaUrl(mediaId: string): string {
  return `${META_GRAPH_API_BASE}/${mediaId}`;
}
