export type AIProviderId =
  | "groq"
  | "cloudflare"
  | "mistral"
  | "sambanova"
  | "openrouter"
  | "cerebras"
  | "nvidia"
  | "gemini";

export type FreeTierType = "FREE" | "TRIAL_FREE" | "PAID_NOT_ALLOWED";

export type CircuitState = "closed" | "open" | "half_open";

export type PrivacyClassification =
  | "PUBLIC_OR_SANITIZED"
  | "COMMERCIAL"
  | "CUSTOMER_DATA"
  | "FINANCIAL";

export type QuotaScope =
  | "MODEL"
  | "PROVIDER"
  | "PROJECT"
  | "ORGANIZATION"
  | "ACCOUNT"
  | "SHARED_FREE_POOL";

export type ProviderErrorType =
  | "rate_limit"
  | "quota_exhausted"
  | "capacity_exhausted"
  | "free_variant_ended"
  | "temporarily_unavailable"
  | "auth_invalid"
  | "permission_denied"
  | "model_not_found"
  | "server_error"
  | "timeout"
  | "unsupported_capability"
  | "config_incomplete"
  | "paid_not_allowed"
  | "privacy_violation"
  | "unknown";

export interface ProviderCapabilities {
  supportsText: boolean;
  supportsTools: boolean;
  supportsStructuredOutput: boolean;
  supportsVision: boolean;
  supportsAudio: boolean;
  supportsStreaming: boolean;
}

export interface ProviderError {
  type: ProviderErrorType;
  status?: number;
  message: string;
  retryAfterSeconds?: number;
  isFatalForProvider?: boolean;
  isFatalForModel?: boolean;
  quotaScope?: QuotaScope;
  raw?: unknown;
}

export interface NormalizedToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface NormalizedToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface NormalizedMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  toolCalls?: NormalizedToolCall[];
  toolCallId?: string;
  toolName?: string;
  toolResult?: any;
  senderName?: string;
  attachments?: Array<{
    mimeType: string;
    dataBase64?: string;
    url?: string;
    fileName?: string;
  }>;
}

export interface NormalizedAIRequest {
  correlationId?: string;
  messages: NormalizedMessage[];
  systemInstruction?: string;
  tools?: NormalizedToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json_object";
  responseSchema?: Record<string, any>;
  privacyClassification?: PrivacyClassification;
  requiredCapabilities?: Partial<ProviderCapabilities>;
  allowPaidProviders?: false;
}

export interface NormalizedAIResponse {
  text?: string;
  toolCalls?: NormalizedToolCall[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
  providerId: AIProviderId;
  modelId: string;
  durationMs: number;
  raw?: unknown;
}

export interface AIProvider {
  readonly id: AIProviderId;
  readonly name: string;
  readonly defaultModel: string;
  readonly freeType: FreeTierType;
  readonly capabilities: ProviderCapabilities;
  readonly priority: number;

  isAvailable(): { available: boolean; reason?: string };
  getModel(): string;
  generate(request: NormalizedAIRequest): Promise<NormalizedAIResponse>;
  classifyError(error: unknown, status?: number, body?: string, headers?: Headers): ProviderError;
}
