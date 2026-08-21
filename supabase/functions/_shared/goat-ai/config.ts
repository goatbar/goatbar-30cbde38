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
  return getEnv("GEMINI_MODEL", "gemini-2.0-flash");
}

export function getWhatsAppMessagesUrl(phoneNumberId: string): string {
  return `${META_GRAPH_API_BASE}/${phoneNumberId}/messages`;
}

export function getWhatsAppMediaUrl(mediaId: string): string {
  return `${META_GRAPH_API_BASE}/${mediaId}`;
}
