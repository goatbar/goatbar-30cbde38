import { BaseAIProvider } from "./base-provider.ts";
import {
  AIProviderId,
  FreeTierType,
  NormalizedAIRequest,
  NormalizedAIResponse,
  ProviderCapabilities,
} from "../types.ts";
import { CLOUDFLARE_FREE_MODELS_ALLOWLIST, PROVIDER_CONFIGS } from "../config.ts";

export interface CloudflareProviderOptions {
  apiKey?: string;
  accountId?: string;
  model?: string;
}

export class CloudflareAIProvider extends BaseAIProvider {
  public readonly id: AIProviderId = "cloudflare";
  public readonly name: string = "Cloudflare Workers AI";
  public readonly defaultModel: string;
  public readonly freeType: FreeTierType = "FREE";
  public readonly priority: number = 20;
  public readonly capabilities: ProviderCapabilities = {
    supportsText: true,
    supportsTools: false, // Cloudflare free endpoint is text-first
    supportsStructuredOutput: true,
    supportsVision: false,
    supportsAudio: false,
    supportsStreaming: true,
  };

  private apiKey: string;
  private accountId: string;
  private model: string;

  constructor(options?: CloudflareProviderOptions) {
    super();
    this.apiKey = options?.apiKey || "";
    this.accountId = options?.accountId || "";
    this.model = options?.model || PROVIDER_CONFIGS.cloudflare.defaultModel || "@cf/meta/llama-3.1-8b-instruct";
    this.defaultModel = this.model;
  }

  public getModel(): string {
    return this.model;
  }

  public isAvailable(): { available: boolean; reason?: string } {
    if (!this.apiKey || !this.accountId) {
      return {
        available: false,
        reason: "CLOUDFLARE_ACCOUNT_ID ou CLOUDFLARE_API_TOKEN não configurados",
      };
    }

    if (!this.model) {
      return { available: false, reason: "NO_FREE_MODEL_CONFIGURED: Nenhum modelo Cloudflare configurado" };
    }

    // Free tier allowlist verification
    if (!CLOUDFLARE_FREE_MODELS_ALLOWLIST.has(this.model)) {
      return {
        available: false,
        reason: `NO_FREE_MODEL_CONFIGURED: Modelo Cloudflare '${this.model}' não está na lista de modelos gratuitos certificados`,
      };
    }

    return { available: true };
  }

  public async generate(request: NormalizedAIRequest): Promise<NormalizedAIResponse> {
    const availability = this.isAvailable();
    if (!availability.available) {
      throw new Error(availability.reason || "Cloudflare Workers AI indisponível");
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemInstruction) {
      messages.push({ role: "system", content: request.systemInstruction });
    }

    for (const m of request.messages) {
      if (m.role === "system") {
        messages.push({ role: "system", content: m.content || "" });
      } else if (m.role === "user") {
        messages.push({ role: "user", content: m.content || "" });
      } else if (m.role === "assistant") {
        messages.push({ role: "assistant", content: m.content || "" });
      }
    }

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.model}`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages,
          max_tokens: request.maxTokens || 1000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        const classified = this.classifyError(
          new Error(`HTTP ${response.status}: ${errorText.slice(0, 300)}`),
          response.status,
          errorText,
          response.headers
        );
        const err = new Error(classified.message);
        (err as any).providerError = classified;
        throw err;
      }

      const resJson = await response.json();
      const rawText = resJson?.result?.response || resJson?.result || "";

      return {
        text: typeof rawText === "string" ? rawText : JSON.stringify(rawText),
        toolCalls: undefined,
        finishReason: "stop",
        providerId: "cloudflare",
        modelId: this.model,
        durationMs,
        raw: resJson,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;

      if (err.providerError) {
        throw err;
      }

      const classified = this.classifyError(err);
      const wrapped = new Error(classified.message);
      (wrapped as any).providerError = classified;
      throw wrapped;
    }
  }
}
