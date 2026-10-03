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

export const CURRENT_GEMINI_MODEL = "gemini-3.8-flash";

export function normalizeGeminiModel(model?: string | null): string {
  const raw = String(model || "").trim().replace(/^models\//, "");
  if (
    !raw ||
    raw === "gemini-2.5-flash" ||
    raw === "gemini-3.6-flash"
  ) {
    return CURRENT_GEMINI_MODEL;
  }
  return raw;
}

export function getGeminiModel(): string {
  return normalizeGeminiModel(getEnv("GEMINI_MODEL"));
}

export function getWhatsAppMessagesUrl(phoneNumberId: string): string {
  return `${META_GRAPH_API_BASE}/${phoneNumberId}/messages`;
}

export function getWhatsAppMediaUrl(mediaId: string): string {
  return `${META_GRAPH_API_BASE}/${mediaId}`;
}
