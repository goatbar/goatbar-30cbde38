import { BaseAIProvider } from "./base-provider.ts";
import {
  AIProviderId,
  FreeTierType,
  NormalizedAIRequest,
  NormalizedAIResponse,
  ProviderCapabilities,
  ProviderError,
} from "../types.ts";
import { fromGeminiResponse, toGeminiContents } from "../canonical.ts";
import { PROVIDER_CONFIGS } from "../config.ts";
import { CURRENT_GEMINI_MODEL, normalizeGeminiModel } from "../../config.ts";

export interface GeminiAdapterOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

const GEMINI_RESILIENCE_FALLBACKS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
] as const;

function uniqueModels(models: string[]): string[] {
  return models.filter((model, index) => Boolean(model) && models.indexOf(model) === index);
}

export class GeminiRouterAdapter extends BaseAIProvider {
  public readonly id: AIProviderId = "gemini";
  public readonly name: string = "Google Gemini Free";
  public readonly defaultModel: string;
  public readonly freeType: FreeTierType = "FREE";
  public readonly priority: number = 80;
  public readonly capabilities: ProviderCapabilities = {
    supportsText: true,
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    supportsAudio: true,
    supportsStreaming: true,
  };

  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(options?: GeminiAdapterOptions) {
    super();
    this.apiKey = options?.apiKey || "";
    this.model = normalizeGeminiModel(
      options?.model || PROVIDER_CONFIGS.gemini.defaultModel || CURRENT_GEMINI_MODEL,
    );
    this.defaultModel = this.model;
    this.baseUrl =
      options?.baseUrl ||
      PROVIDER_CONFIGS.gemini.defaultBaseUrl ||
      "https://generativelanguage.googleapis.com";
  }

  public getModel(): string {
    return this.model;
  }

  public isAvailable(): { available: boolean; reason?: string } {
    if (!this.apiKey) {
      return { available: false, reason: "GEMINI_API_KEY não configurada no ambiente" };
    }
    return { available: true };
  }

  private shouldFallbackToAnotherModel(error: ProviderError): boolean {
    return (
      error.type === "timeout" ||
      error.type === "rate_limit" ||
      error.type === "capacity_exhausted" ||
      error.type === "model_not_found" ||
      Boolean(error.status && [429, 502, 503, 504].includes(error.status))
    );
  }

  private async generateWithModel(
    model: string,
    payload: Record<string, any>,
  ): Promise<NormalizedAIResponse> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const url = `${this.baseUrl}/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
          response.headers,
        );
        const err = new Error(classified.message);
        (err as any).providerError = classified;
        throw err;
      }

      const resJson = await response.json();
      return fromGeminiResponse(resJson, model, durationMs);
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.providerError) {
        throw err;
      }

      const classified = this.classifyError(err);
      const wrapped = new Error(classified.message);
      (wrapped as any).providerError = classified;
      throw wrapped;
    }
  }

  public async generate(request: NormalizedAIRequest): Promise<NormalizedAIResponse> {
    const availability = this.isAvailable();
    if (!availability.available) {
      throw new Error(availability.reason || "Gemini indisponível");
    }

    // Conservative Privacy Guard: do not send raw CUSTOMER_DATA or FINANCIAL to Gemini Free
    if (
      request.privacyClassification === "CUSTOMER_DATA" ||
      request.privacyClassification === "FINANCIAL"
    ) {
      const err = new Error(
        `PRIVACY_VIOLATION: Provedor Gemini Free não está autorizado para dados classificados como ${request.privacyClassification}`,
      );
      (err as any).providerError = {
        type: "privacy_violation",
        status: 403,
        message: err.message,
      };
      throw err;
    }

    const contents = toGeminiContents(request.messages);

    const payload: Record<string, any> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.2,
        maxOutputTokens: request.maxTokens || 1500,
      },
    };

    if (request.systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: request.systemInstruction }],
      };
    }

    if (request.tools && request.tools.length > 0 && this.capabilities.supportsTools) {
      payload.tools = [
        {
          functionDeclarations: request.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
    }

    if (request.responseFormat === "json_object" && this.capabilities.supportsStructuredOutput) {
      payload.generationConfig.responseMimeType = "application/json";
      if (request.responseSchema) {
        payload.generationConfig.responseSchema = request.responseSchema;
      }
    }

    const candidates = uniqueModels([
      this.model,
      ...GEMINI_RESILIENCE_FALLBACKS,
    ]);

    let lastError: any = null;

    for (let index = 0; index < candidates.length; index += 1) {
      const candidateModel = candidates[index];

      try {
        const response = await this.generateWithModel(candidateModel, payload);

        if (candidateModel !== this.model) {
          console.log(
            `[GOAT-AI][GEMINI_MODEL_FALLBACK][SUCCESS] primary=${this.model} selected=${candidateModel} attempt=${index + 1}`,
          );
        }

        return response;
      } catch (err: any) {
        lastError = err;
        const providerError: ProviderError =
          err?.providerError || this.classifyError(err);
        const nextModel = candidates[index + 1];

        if (!nextModel || !this.shouldFallbackToAnotherModel(providerError)) {
          throw err;
        }

        console.warn(
          `[GOAT-AI][GEMINI_MODEL_FALLBACK] from=${candidateModel} to=${nextModel} status=${providerError.status || 0} errorType=${providerError.type}`,
        );

        // Small jitter-free pause to avoid hammering the same shared capacity pool.
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }

    throw lastError || new Error("Gemini indisponível após fallback de modelos");
  }
}
