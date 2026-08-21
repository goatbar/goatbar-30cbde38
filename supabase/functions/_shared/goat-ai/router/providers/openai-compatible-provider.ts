import { BaseAIProvider } from "./base-provider.ts";
import {
  AIProviderId,
  FreeTierType,
  NormalizedAIRequest,
  NormalizedAIResponse,
  ProviderCapabilities,
} from "../types.ts";
import {
  fromOpenAIResponse,
  sanitizeLogText,
  toOpenAIMessages,
  toOpenAITools,
} from "../canonical.ts";
import { ALLOW_PAID_PROVIDERS, PROVIDER_CONFIGS } from "../config.ts";

export interface OpenAICompatibleOptions {
  id: AIProviderId;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  freeType?: FreeTierType;
  priority?: number;
  capabilities?: Partial<ProviderCapabilities>;
  additionalHeaders?: Record<string, string>;
}

export class OpenAICompatibleProvider extends BaseAIProvider {
  public readonly id: AIProviderId;
  public readonly name: string;
  public readonly defaultModel: string;
  public readonly freeType: FreeTierType;
  public readonly capabilities: ProviderCapabilities;
  public readonly priority: number;

  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private additionalHeaders: Record<string, string>;

  constructor(options: OpenAICompatibleOptions) {
    super();
    const config = PROVIDER_CONFIGS[options.id];
    this.id = options.id;
    this.name = options.name || config?.name || options.id;
    this.apiKey = options.apiKey || "";
    this.baseUrl = options.baseUrl || config?.defaultBaseUrl || "https://api.openai.com/v1";
    this.model = options.model || config?.defaultModel || "";
    this.defaultModel = this.model;
    this.freeType = options.freeType || config?.freeType || "FREE";
    this.priority = options.priority ?? (config?.priority || 100);
    this.capabilities = {
      supportsText: true,
      supportsTools: true,
      supportsStructuredOutput: true,
      supportsVision: false,
      supportsAudio: false,
      supportsStreaming: true,
      ...(config?.capabilities || {}),
      ...(options.capabilities || {}),
    };
    this.additionalHeaders = options.additionalHeaders || {};
  }

  public getModel(): string {
    return this.model;
  }

  public isAvailable(): { available: boolean; reason?: string } {
    if (!this.apiKey) {
      return { available: false, reason: `API key not configured for provider ${this.id}` };
    }

    if (this.id === "nvidia" && !this.model) {
      return { available: false, reason: `CONFIG_INCOMPLETE: NVIDIA_MODEL não configurado no ambiente` };
    }

    if (!this.model) {
      return { available: false, reason: `No model configured for provider ${this.id}` };
    }

    // Zero-paid policy check for OpenRouter
    if (this.id === "openrouter") {
      if (!this.model.endsWith(":free")) {
        return {
          available: false,
          reason: `PAID_NOT_ALLOWED: Modelo OpenRouter '${this.model}' não possui o sufixo ':free'`,
        };
      }
    }

    if (this.freeType === "PAID_NOT_ALLOWED") {
      return { available: false, reason: `PAID_NOT_ALLOWED: Provedor ${this.id} não é gratuito` };
    }

    return { available: true };
  }

  public async generate(request: NormalizedAIRequest): Promise<NormalizedAIResponse> {
    const availability = this.isAvailable();
    if (!availability.available) {
      throw new Error(availability.reason || `Provedor ${this.id} indisponível`);
    }

    // Strict Zero-Paid Runtime Guard
    if (this.id === "openrouter" && !this.model.endsWith(":free")) {
      throw new Error(`PAID_NOT_ALLOWED: Chamada abortada pois modelo OpenRouter '${this.model}' não é gratuito.`);
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const openAIMessages = toOpenAIMessages(request.messages, request.systemInstruction);
    const openAITools = toOpenAITools(request.tools);

    const payload: Record<string, any> = {
      model: this.model,
      messages: openAIMessages,
      temperature: request.temperature ?? 0.2,
    };

    if (request.maxTokens) {
      payload.max_tokens = request.maxTokens;
    }

    if (openAITools && openAITools.length > 0 && this.capabilities.supportsTools) {
      payload.tools = openAITools;
    }

    if (request.responseFormat === "json_object" && this.capabilities.supportsStructuredOutput) {
      payload.response_format = { type: "json_object" };
    }

    const endpoint = `${this.baseUrl.replace(/\/+$/, "")}/chat/completions`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...this.additionalHeaders,
    };

    if (this.id === "openrouter") {
      headers["HTTP-Referer"] = "https://goatbar.com.br";
      headers["X-Title"] = "Goat Bar GIA";
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
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

      const resData = await response.json();
      return fromOpenAIResponse(resData, this.id, this.model, durationMs);
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
