import { getEnv } from "../config.ts";
import { AIProviderId, FreeTierType, PrivacyClassification, ProviderCapabilities } from "./types.ts";

export const ALLOW_PAID_PROVIDERS = false;

export interface ProviderStaticConfig {
  id: AIProviderId;
  name: string;
  priority: number;
  freeType: FreeTierType;
  defaultBaseUrl?: string;
  defaultModel?: string;
  capabilities: ProviderCapabilities;
  allowedPrivacyClasses: PrivacyClassification[];
}

export const CLOUDFLARE_FREE_MODELS_ALLOWLIST = new Set([
  "@cf/meta/llama-3.1-8b-instruct",
  "@cf/meta/llama-3-8b-instruct",
  "@cf/mistral/mistral-7b-instruct-v0.1",
  "@cf/meta/llama-2-7b-chat-int8",
]);

export const PROVIDER_CONFIGS: Record<AIProviderId, ProviderStaticConfig> = {
  groq: {
    id: "groq",
    name: "Groq",
    priority: 10,
    freeType: "FREE",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "openai/gpt-oss-120b",
    capabilities: {
      supportsText: true,
      supportsTools: true,
      supportsStructuredOutput: true,
      supportsVision: false,
      supportsAudio: false,
      supportsStreaming: true,
    },
    allowedPrivacyClasses: ["PUBLIC_OR_SANITIZED", "COMMERCIAL", "CUSTOMER_DATA", "FINANCIAL"],
  },
  cloudflare: {
    id: "cloudflare",
    name: "Cloudflare Workers AI",
    priority: 20,
    freeType: "FREE",
    defaultBaseUrl: "https://api.cloudflare.com/client/v4/accounts",
    defaultModel: "@cf/meta/llama-3.1-8b-instruct",
    capabilities: {
      supportsText: true,
      supportsTools: false, // Cloudflare Workers AI free direct REST endpoint doesn't support structured tool execution reliably
      supportsStructuredOutput: true,
      supportsVision: false,
      supportsAudio: false,
      supportsStreaming: true,
    },
    allowedPrivacyClasses: ["PUBLIC_OR_SANITIZED", "COMMERCIAL", "CUSTOMER_DATA", "FINANCIAL"],
  },
  mistral: {
    id: "mistral",
    name: "Mistral AI",
    priority: 30,
    freeType: "FREE",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-small-latest",
    capabilities: {
      supportsText: true,
      supportsTools: true,
      supportsStructuredOutput: true,
      supportsVision: false,
      supportsAudio: false,
      supportsStreaming: true,
    },
    allowedPrivacyClasses: ["PUBLIC_OR_SANITIZED", "COMMERCIAL", "CUSTOMER_DATA", "FINANCIAL"],
  },
  sambanova: {
    id: "sambanova",
    name: "SambaNova Cloud",
    priority: 40,
    freeType: "FREE",
    defaultBaseUrl: "https://api.sambanova.ai/v1",
    defaultModel: "Meta-Llama-3.1-70B-Instruct",
    capabilities: {
      supportsText: true,
      supportsTools: true,
      supportsStructuredOutput: true,
      supportsVision: false,
      supportsAudio: false,
      supportsStreaming: true,
    },
    allowedPrivacyClasses: ["PUBLIC_OR_SANITIZED", "COMMERCIAL", "CUSTOMER_DATA", "FINANCIAL"],
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter Free",
    priority: 50,
    freeType: "FREE",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "meta-llama/llama-3.1-8b-instruct:free",
    capabilities: {
      supportsText: true,
      supportsTools: true,
      supportsStructuredOutput: true,
      supportsVision: false,
      supportsAudio: false,
      supportsStreaming: true,
    },
    allowedPrivacyClasses: ["PUBLIC_OR_SANITIZED", "COMMERCIAL", "CUSTOMER_DATA", "FINANCIAL"],
  },
  cerebras: {
    id: "cerebras",
    name: "Cerebras Trial",
    priority: 60,
    freeType: "TRIAL_FREE",
    defaultBaseUrl: "https://api.cerebras.ai/v1",
    defaultModel: "llama3.1-70b",
    capabilities: {
      supportsText: true,
      supportsTools: true,
      supportsStructuredOutput: true,
      supportsVision: false,
      supportsAudio: false,
      supportsStreaming: true,
    },
    allowedPrivacyClasses: ["PUBLIC_OR_SANITIZED", "COMMERCIAL", "CUSTOMER_DATA", "FINANCIAL"],
  },
  nvidia: {
    id: "nvidia",
    name: "NVIDIA NIM",
    priority: 70,
    freeType: "FREE",
    defaultBaseUrl: "https://integrate.api.nvidia.com/v1",
    defaultModel: "", // NO default model assumed - must be configured via env or marked CONFIG_INCOMPLETE
    capabilities: {
      supportsText: true,
      supportsTools: true,
      supportsStructuredOutput: true,
      supportsVision: false,
      supportsAudio: false,
      supportsStreaming: true,
    },
    allowedPrivacyClasses: ["PUBLIC_OR_SANITIZED", "COMMERCIAL", "CUSTOMER_DATA", "FINANCIAL"],
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini Free",
    priority: 80,
    freeType: "FREE",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    defaultModel: "gemini-3.6-flash",
    capabilities: {
      supportsText: true,
      supportsTools: true,
      supportsStructuredOutput: true,
      supportsVision: true,
      supportsAudio: true,
      supportsStreaming: true,
    },
    // Conservative privacy rule: Gemini Free does not receive raw CUSTOMER_DATA or FINANCIAL
    allowedPrivacyClasses: ["PUBLIC_OR_SANITIZED", "COMMERCIAL"],
  },
};

export function getProviderSecrets(providerId: AIProviderId): {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  accountId?: string;
} {
  switch (providerId) {
    case "groq":
      return {
        apiKey: getEnv("GROQ_API_KEY"),
        baseUrl: getEnv("GROQ_BASE_URL") || PROVIDER_CONFIGS.groq.defaultBaseUrl,
        model: getEnv("GROQ_MODEL") || PROVIDER_CONFIGS.groq.defaultModel,
      };
    case "cloudflare":
      return {
        apiKey: getEnv("CLOUDFLARE_API_TOKEN"),
        accountId: getEnv("CLOUDFLARE_ACCOUNT_ID"),
        baseUrl: PROVIDER_CONFIGS.cloudflare.defaultBaseUrl,
        model: getEnv("CLOUDFLARE_MODEL") || PROVIDER_CONFIGS.cloudflare.defaultModel,
      };
    case "mistral":
      return {
        apiKey: getEnv("MISTRAL_API_KEY"),
        baseUrl: getEnv("MISTRAL_BASE_URL") || PROVIDER_CONFIGS.mistral.defaultBaseUrl,
        model: getEnv("MISTRAL_MODEL") || PROVIDER_CONFIGS.mistral.defaultModel,
      };
    case "sambanova":
      return {
        apiKey: getEnv("SAMBANOVA_API_KEY"),
        baseUrl: getEnv("SAMBANOVA_BASE_URL") || PROVIDER_CONFIGS.sambanova.defaultBaseUrl,
        model: getEnv("SAMBANOVA_MODEL") || PROVIDER_CONFIGS.sambanova.defaultModel,
      };
    case "openrouter":
      return {
        apiKey: getEnv("OPENROUTER_API_KEY"),
        baseUrl: getEnv("OPENROUTER_BASE_URL") || PROVIDER_CONFIGS.openrouter.defaultBaseUrl,
        model: getEnv("OPENROUTER_FREE_ROUTER") || getEnv("OPENROUTER_MODEL") || PROVIDER_CONFIGS.openrouter.defaultModel,
      };
    case "cerebras":
      return {
        apiKey: getEnv("CEREBRAS_API_KEY"),
        baseUrl: getEnv("CEREBRAS_BASE_URL") || PROVIDER_CONFIGS.cerebras.defaultBaseUrl,
        model: getEnv("CEREBRAS_MODEL") || PROVIDER_CONFIGS.cerebras.defaultModel,
      };
    case "nvidia":
      return {
        apiKey: getEnv("NVIDIA_API_KEY"),
        baseUrl: getEnv("NVIDIA_BASE_URL") || PROVIDER_CONFIGS.nvidia.defaultBaseUrl,
        model: getEnv("NVIDIA_MODEL") || "", // Do not assume or invent model
      };
    case "gemini":
      return {
        apiKey: getEnv("GEMINI_API_KEY") || getEnv("GOOGLE_AI_API_KEY") || getEnv("GOOGLE_API_KEY"),
        baseUrl: PROVIDER_CONFIGS.gemini.defaultBaseUrl,
        model: getEnv("GEMINI_MODEL") || PROVIDER_CONFIGS.gemini.defaultModel,
      };
    default:
      return { apiKey: "" };
  }
}
