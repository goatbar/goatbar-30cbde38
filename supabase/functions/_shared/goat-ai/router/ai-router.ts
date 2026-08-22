import {
  AIProvider,
  AIProviderId,
  NormalizedAIRequest,
  NormalizedAIResponse,
  ProviderError,
} from "./types.ts";
import { ALLOW_PAID_PROVIDERS, getProviderSecrets, PROVIDER_CONFIGS } from "./config.ts";
import { CircuitBreakerManager } from "./circuit-breaker.ts";
import { OpenAICompatibleProvider } from "./providers/openai-compatible-provider.ts";
import { CloudflareAIProvider } from "./providers/cloudflare-provider.ts";
import { GeminiRouterAdapter } from "./providers/gemini-adapter.ts";
import { sanitizeLogText } from "./canonical.ts";

export const FRIENDLY_EXHAUSTED_MESSAGE =
  "Não consegui processar a resposta com a IA no momento. Sua mensagem foi salva no histórico.";

export interface AIRouterOptions {
  supabaseAdmin?: any;
  customProviders?: AIProvider[];
  overrideSecrets?: Partial<Record<AIProviderId, { apiKey?: string; baseUrl?: string; model?: string; accountId?: string }>>;
}

export class AIRouter {
  private providers: AIProvider[] = [];
  private circuitBreaker: CircuitBreakerManager;
  private supabaseAdmin: any;

  constructor(options?: AIRouterOptions) {
    this.supabaseAdmin = options?.supabaseAdmin;
    this.circuitBreaker = CircuitBreakerManager.getInstance(options?.supabaseAdmin);

    if (options?.customProviders && options.customProviders.length > 0) {
      this.providers = options.customProviders;
    } else {
      this.initDefaultProviders(options?.overrideSecrets);
    }
  }

  private initDefaultProviders(
    overrideSecrets?: Partial<Record<AIProviderId, { apiKey?: string; baseUrl?: string; model?: string; accountId?: string }>>
  ) {
    // Strict priority sequence:
    // 1. Groq
    // 2. Cloudflare
    // 3. Mistral
    // 4. SambaNova
    // 5. OpenRouter
    // 6. Cerebras
    // 7. NVIDIA
    // 8. Gemini

    const groqSec = { ...getProviderSecrets("groq"), ...(overrideSecrets?.groq || {}) };
    const cfSec = { ...getProviderSecrets("cloudflare"), ...(overrideSecrets?.cloudflare || {}) };
    const mistralSec = { ...getProviderSecrets("mistral"), ...(overrideSecrets?.mistral || {}) };
    const sambanovaSec = { ...getProviderSecrets("sambanova"), ...(overrideSecrets?.sambanova || {}) };
    const openrouterSec = { ...getProviderSecrets("openrouter"), ...(overrideSecrets?.openrouter || {}) };
    const cerebrasSec = { ...getProviderSecrets("cerebras"), ...(overrideSecrets?.cerebras || {}) };
    const nvidiaSec = { ...getProviderSecrets("nvidia"), ...(overrideSecrets?.nvidia || {}) };
    const geminiSec = { ...getProviderSecrets("gemini"), ...(overrideSecrets?.gemini || {}) };

    this.providers = [
      new OpenAICompatibleProvider({
        id: "groq",
        name: "Groq",
        apiKey: groqSec.apiKey,
        baseUrl: groqSec.baseUrl || "https://api.groq.com/openai/v1",
        model: groqSec.model || "openai/gpt-oss-120b",
      }),
      new CloudflareAIProvider({
        apiKey: cfSec.apiKey,
        accountId: cfSec.accountId,
        model: cfSec.model || "@cf/meta/llama-3.1-8b-instruct",
      }),
      new OpenAICompatibleProvider({
        id: "mistral",
        name: "Mistral AI",
        apiKey: mistralSec.apiKey,
        baseUrl: mistralSec.baseUrl || "https://api.mistral.ai/v1",
        model: mistralSec.model || "mistral-small-latest",
      }),
      new OpenAICompatibleProvider({
        id: "sambanova",
        name: "SambaNova Cloud",
        apiKey: sambanovaSec.apiKey,
        baseUrl: sambanovaSec.baseUrl || "https://api.sambanova.ai/v1",
        model: sambanovaSec.model || "Meta-Llama-3.1-70B-Instruct",
      }),
      new OpenAICompatibleProvider({
        id: "openrouter",
        name: "OpenRouter Free",
        apiKey: openrouterSec.apiKey,
        baseUrl: openrouterSec.baseUrl || "https://openrouter.ai/api/v1",
        model: openrouterSec.model || "meta-llama/llama-3.1-8b-instruct:free",
      }),
      new OpenAICompatibleProvider({
        id: "cerebras",
        name: "Cerebras Trial",
        apiKey: cerebrasSec.apiKey,
        baseUrl: cerebrasSec.baseUrl || "https://api.cerebras.ai/v1",
        model: cerebrasSec.model || "llama3.1-70b",
        freeType: "TRIAL_FREE",
      }),
      new OpenAICompatibleProvider({
        id: "nvidia",
        name: "NVIDIA NIM",
        apiKey: nvidiaSec.apiKey,
        baseUrl: nvidiaSec.baseUrl || "https://integrate.api.nvidia.com/v1",
        model: nvidiaSec.model || "", // No default model - will mark CONFIG_INCOMPLETE if empty
      }),
      new GeminiRouterAdapter({
        apiKey: geminiSec.apiKey,
        model: geminiSec.model || "gemini-3.6-flash",
      }),
    ];

    // Ensure sorted by priority
    this.providers.sort((a, b) => a.priority - b.priority);
  }

  public getProviders(): AIProvider[] {
    return this.providers;
  }

  public async generate(request: NormalizedAIRequest): Promise<NormalizedAIResponse> {
    const correlationId = request.correlationId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const requiresTools = Boolean(request.tools && request.tools.length > 0);
    const privacyClass = request.privacyClassification || "PUBLIC_OR_SANITIZED";

    console.log(
      `[GOAT-AI][ROUTER][START] correlationId=${correlationId} messageCount=${request.messages.length} requiresTools=${requiresTools} privacyClass=${privacyClass}`
    );

    const candidateProviders: AIProvider[] = [];
    const skippedProviders: Array<{ id: string; reason: string }> = [];

    const hasVisionAttachments = request.messages.some((m) =>
      m.attachments?.some((att) =>
        att.mimeType.toLowerCase().startsWith("image/") ||
        att.mimeType.toLowerCase().includes("pdf") ||
        att.mimeType.toLowerCase().includes("document")
      )
    );
    const hasAudioAttachments = request.messages.some((m) =>
      m.attachments?.some((att) =>
        att.mimeType.toLowerCase().startsWith("audio/")
      )
    );
    const requiresVision = Boolean(request.requiredCapabilities?.supportsVision || hasVisionAttachments);
    const requiresAudio = Boolean(request.requiredCapabilities?.supportsAudio || hasAudioAttachments);

    // Filter Eligible Providers
    for (const p of this.providers) {
      // 1. Zero-Paid Policy check
      if (p.freeType === "PAID_NOT_ALLOWED" || ALLOW_PAID_PROVIDERS) {
        skippedProviders.push({ id: p.id, reason: "PAID_NOT_ALLOWED" });
        continue;
      }

      // 2. Capabilities check
      if (requiresTools && !p.capabilities.supportsTools) {
        skippedProviders.push({ id: p.id, reason: "UNSUPPORTED_CAPABILITY_TOOLS" });
        continue;
      }

      if (requiresVision && !p.capabilities.supportsVision) {
        skippedProviders.push({ id: p.id, reason: "CAPABILITY_MISMATCH" });
        console.log(
          `[GOAT-AI][ROUTER][SKIP] provider=${p.id} reason=CAPABILITY_MISMATCH requiredCapability=vision correlationId=${correlationId}`
        );
        continue;
      }

      if (requiresAudio && !p.capabilities.supportsAudio) {
        skippedProviders.push({ id: p.id, reason: "CAPABILITY_MISMATCH" });
        console.log(
          `[GOAT-AI][ROUTER][SKIP] provider=${p.id} reason=CAPABILITY_MISMATCH requiredCapability=audio correlationId=${correlationId}`
        );
        continue;
      }

      // 3. Privacy Policy check
      const config = PROVIDER_CONFIGS[p.id];
      if (config && !config.allowedPrivacyClasses.includes(privacyClass)) {
        skippedProviders.push({ id: p.id, reason: `PRIVACY_RESTRICTED_FOR_${privacyClass}` });
        continue;
      }

      // 4. Configuration Availability check
      const availability = p.isAvailable();
      if (!availability.available) {
        skippedProviders.push({ id: p.id, reason: availability.reason || "CONFIG_INCOMPLETE" });
        continue;
      }

      // 5. Circuit Breaker check
      const circuit = this.circuitBreaker.isAvailable(p.id);
      if (!circuit.available) {
        skippedProviders.push({ id: p.id, reason: circuit.reason || "CIRCUIT_OPEN" });
        continue;
      }

      if (requiresVision && p.capabilities.supportsVision) {
        console.log(
          `[GOAT-AI][MEDIA][ROUTED] provider=${p.id} supportsVision=true correlationId=${correlationId}`
        );
      }

      candidateProviders.push(p);
    }

    if (candidateProviders.length === 0) {
      console.error(
        `[GOAT-AI][ROUTER][EXHAUSTED] correlationId=${correlationId} reason="No eligible providers available" skipped=${JSON.stringify(skippedProviders)}`
      );
      this.recordTelemetry({
        correlationId,
        providerId: "none",
        modelId: "none",
        attempt: 0,
        status: "exhausted",
        durationMs: 0,
        errorType: "all_providers_unavailable",
        errorMessage: "No eligible providers available",
      });

      return {
        text: FRIENDLY_EXHAUSTED_MESSAGE,
        providerId: "groq", // fallback default
        modelId: "exhausted",
        durationMs: 0,
      };
    }

    let attempt = 0;
    let lastError: any = null;

    for (let i = 0; i < candidateProviders.length; i++) {
      const provider = candidateProviders[i];
      attempt++;
      const nextProvider = candidateProviders[i + 1];

      console.log(
        `[GOAT-AI][ROUTER][ATTEMPT] correlationId=${correlationId} attempt=${attempt} provider=${provider.id} model=${provider.getModel()}`
      );

      try {
        const response = await provider.generate(request);

        this.circuitBreaker.recordSuccess(provider.id);

        console.log(
          `[GOAT-AI][ROUTER][SUCCESS] correlationId=${correlationId} provider=${provider.id} model=${response.modelId} durationMs=${response.durationMs} hasToolCalls=${Boolean(response.toolCalls && response.toolCalls.length > 0)} inputTokens=${response.usage?.inputTokens || 0} outputTokens=${response.usage?.outputTokens || 0}`
        );

        this.recordTelemetry({
          correlationId,
          providerId: provider.id,
          modelId: response.modelId,
          attempt,
          status: "success",
          durationMs: response.durationMs,
          inputTokens: response.usage?.inputTokens || 0,
          outputTokens: response.usage?.outputTokens || 0,
          toolsExecuted: response.toolCalls?.map((tc) => tc.name) || [],
        });

        return response;
      } catch (err: any) {
        lastError = err;
        const providerError: ProviderError = err?.providerError || provider.classifyError(err);
        this.circuitBreaker.recordFailure(provider.id, providerError);

        const safeErrMsg = sanitizeLogText(providerError.message);
        console.error(
          `[GOAT-AI][PROVIDER][ERROR] correlationId=${correlationId} provider=${provider.id} model=${provider.getModel()} status=${providerError.status || 0} error=${JSON.stringify({ name: providerError.type, message: safeErrMsg, status: providerError.status })}`
        );

        console.warn(
          `[GOAT-AI][ROUTER][FALLBACK] correlationId=${correlationId} fromProvider=${provider.id} toProvider=${nextProvider ? nextProvider.id : "NONE"} errorType=${providerError.type} status=${providerError.status || 0} reason="${safeErrMsg}"`
        );

        this.recordTelemetry({
          correlationId,
          providerId: provider.id,
          modelId: provider.getModel(),
          attempt,
          status: "fallback",
          durationMs: 0,
          errorType: providerError.type,
          errorMessage: safeErrMsg,
        });

        // Continue loop to try next provider
      }
    }

    // If reached here, all candidate providers failed
    console.error(
      `[GOAT-AI][ROUTER][EXHAUSTED] correlationId=${correlationId} totalAttempts=${attempt} allCandidateProvidersFailed=true lastError="${sanitizeLogText(lastError?.message || String(lastError))}"`
    );

    this.recordTelemetry({
      correlationId,
      providerId: "all_failed",
      modelId: "none",
      attempt,
      status: "exhausted",
      durationMs: 0,
      errorType: "all_providers_failed",
      errorMessage: sanitizeLogText(lastError?.message || "All providers failed"),
    });

    return {
      text: FRIENDLY_EXHAUSTED_MESSAGE,
      providerId: "gemini",
      modelId: "exhausted",
      durationMs: 0,
    };
  }

  private async recordTelemetry(event: {
    correlationId: string;
    conversationId?: string;
    providerId: string;
    modelId: string;
    attempt: number;
    status: "success" | "fallback" | "rate_limit" | "error" | "exhausted" | "provider_switch";
    durationMs: number;
    inputTokens?: number;
    outputTokens?: number;
    errorType?: string;
    errorMessage?: string;
    toolsExecuted?: string[];
  }) {
    if (!this.supabaseAdmin || typeof this.supabaseAdmin.from !== "function") {
      return;
    }

    try {
      const table = this.supabaseAdmin.from("ai_usage_events");
      if (table && typeof table.insert === "function") {
        await table.insert({
          correlation_id: event.correlationId,
          conversation_id: event.conversationId || null,
          provider_id: event.providerId,
          model_id: event.modelId,
          attempt: event.attempt,
          status: event.status,
          duration_ms: event.durationMs,
          input_tokens: event.inputTokens || 0,
          output_tokens: event.outputTokens || 0,
          error_type: event.errorType || null,
          error_message: event.errorMessage ? sanitizeLogText(event.errorMessage).slice(0, 500) : null,
          tools_executed: event.toolsExecuted || [],
        });
      }
    } catch (err: any) {
      // Non-blocking telemetry failure
      console.warn(`[GOAT-AI][ROUTER] Telemetry insert failed: ${err?.message}`);
    }
  }
}
