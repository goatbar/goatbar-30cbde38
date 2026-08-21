import {
  AIProvider,
  AIProviderId,
  FreeTierType,
  NormalizedAIRequest,
  NormalizedAIResponse,
  ProviderCapabilities,
  ProviderError,
} from "../types.ts";
import { ALLOW_PAID_PROVIDERS, PROVIDER_CONFIGS } from "../config.ts";
import { sanitizeLogText } from "../canonical.ts";

export abstract class BaseAIProvider implements AIProvider {
  public abstract readonly id: AIProviderId;
  public abstract readonly name: string;
  public abstract readonly defaultModel: string;
  public abstract readonly freeType: FreeTierType;
  public abstract readonly capabilities: ProviderCapabilities;
  public abstract readonly priority: number;

  protected timeoutMs: number = 25000;

  public abstract isAvailable(): { available: boolean; reason?: string };
  public abstract getModel(): string;
  public abstract generate(request: NormalizedAIRequest): Promise<NormalizedAIResponse>;

  protected parseRetryAfter(headers?: Headers): number | undefined {
    if (!headers) return undefined;
    const retryAfter = headers.get("retry-after") || headers.get("x-ratelimit-reset-requests") || headers.get("x-ratelimit-reset-tokens");
    if (!retryAfter) return undefined;

    // Numeric seconds
    const sec = Number(retryAfter);
    if (!Number.isNaN(sec) && sec > 0) return sec;

    // HTTP Date
    const date = Date.parse(retryAfter);
    if (!Number.isNaN(date)) {
      const diffSec = Math.ceil((date - Date.now()) / 1000);
      return diffSec > 0 ? diffSec : 10;
    }

    return undefined;
  }

  public classifyError(error: unknown, status?: number, body?: string, headers?: Headers): ProviderError {
    const rawMsg = sanitizeLogText(error instanceof Error ? error.message : String(error || ""));
    const bodyText = sanitizeLogText((body || "").toLowerCase());
    const retryAfter = this.parseRetryAfter(headers);

    // Timeout detection
    if (
      (error instanceof Error && error.name === "AbortError") ||
      rawMsg.toLowerCase().includes("timeout") ||
      rawMsg.toLowerCase().includes("aborted")
    ) {
      return {
        type: "timeout",
        status: 408,
        message: "Timeout na chamada à API do provedor (limite de 25s excedido)",
        retryAfterSeconds: 30,
        raw: error,
      };
    }

    // HTTP Status classification
    if (status === 429) {
      return {
        type: "rate_limit",
        status: 429,
        message: `Rate limit / Quota excedida (HTTP 429): ${rawMsg || bodyText.slice(0, 150)}`,
        retryAfterSeconds: retryAfter || 60,
        quotaScope: "PROVIDER",
        raw: error,
      };
    }

    if (status === 401) {
      return {
        type: "auth_invalid",
        status: 401,
        message: `Chave de API inválida ou não autorizada (HTTP 401): ${rawMsg || bodyText.slice(0, 150)}`,
        isFatalForProvider: true,
        raw: error,
      };
    }

    if (status === 403) {
      return {
        type: "permission_denied",
        status: 403,
        message: `Acesso negado ou restrição de modelo/faturamento (HTTP 403): ${rawMsg || bodyText.slice(0, 150)}`,
        isFatalForProvider: true,
        raw: error,
      };
    }

    if (status === 404) {
      return {
        type: "model_not_found",
        status: 404,
        message: `Modelo não encontrado ou descontinuado (HTTP 404): ${rawMsg || bodyText.slice(0, 150)}`,
        isFatalForModel: true,
        raw: error,
      };
    }

    if (status && status >= 500) {
      return {
        type: "server_error",
        status,
        message: `Serviço temporariamente indisponível (HTTP ${status}): ${rawMsg || bodyText.slice(0, 150)}`,
        retryAfterSeconds: 30,
        raw: error,
      };
    }

    // Specific error strings (OpenRouter / Groq / Cloudflare)
    if (bodyText.includes("free_variant_ended") || bodyText.includes("free variant")) {
      return {
        type: "free_variant_ended",
        status: status || 429,
        message: "Variante gratuita do modelo expirou ou foi descontinuada",
        isFatalForModel: true,
        quotaScope: "MODEL",
        raw: error,
      };
    }

    if (bodyText.includes("capacity_exhausted") || bodyText.includes("capacity exhausted") || bodyText.includes("temporarily_unavailable")) {
      return {
        type: "capacity_exhausted",
        status: status || 503,
        message: "Capacidade gratuita temporariamente esgotada no provedor",
        retryAfterSeconds: 60,
        quotaScope: "SHARED_FREE_POOL",
        raw: error,
      };
    }

    return {
      type: "unknown",
      status,
      message: rawMsg || bodyText.slice(0, 200) || "Erro inesperado na chamada ao provedor",
      raw: error,
    };
  }
}
