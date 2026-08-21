import { BaseAIProvider } from "./base-provider.ts";
import {
  AIProviderId,
  FreeTierType,
  NormalizedAIRequest,
  NormalizedAIResponse,
  ProviderCapabilities,
} from "../types.ts";
import { fromGeminiResponse, toGeminiContents } from "../canonical.ts";
import { PROVIDER_CONFIGS } from "../config.ts";

export interface GeminiAdapterOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
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
    const rawModel = options?.model || PROVIDER_CONFIGS.gemini.defaultModel || "gemini-3.6-flash";
    this.model = (rawModel.includes("1.5") || rawModel.includes("2.0") || rawModel.includes("2.5"))
      ? "gemini-3.6-flash"
      : rawModel;
    this.defaultModel = this.model;
    this.baseUrl = options?.baseUrl || PROVIDER_CONFIGS.gemini.defaultBaseUrl || "https://generativelanguage.googleapis.com";
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
        `PRIVACY_VIOLATION: Provedor Gemini Free não está autorizado para dados classificados como ${request.privacyClassification}`
      );
      (err as any).providerError = {
        type: "privacy_violation",
        status: 403,
        message: err.message,
      };
      throw err;
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

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

    const url = `${this.baseUrl}/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

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
          response.headers
        );
        const err = new Error(classified.message);
        (err as any).providerError = classified;
        throw err;
      }

      const resJson = await response.json();
      return fromGeminiResponse(resJson, this.model, durationMs);
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
