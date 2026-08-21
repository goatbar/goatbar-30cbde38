import {
  AIClassificationResult,
  AIExtractionResult,
  AIInput,
  AIProcessedOutput,
  AIProvider,
  GoatAIClassification,
} from "./types.ts";
import { GOAT_AI_SYSTEM_INSTRUCTION } from "./prompts/system.ts";
import { CLASSIFIER_PROMPT } from "./prompts/classifier.ts";
import { EXTRACTOR_PROMPT } from "./prompts/extractor.ts";
import {
  AIStructuredResponseSchema,
  GEMINI_RESPONSE_SCHEMA,
  validateStructuredData,
} from "./schemas.ts";
import { normalizeStr } from "./event-matcher.ts";

export const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";
export const GOOGLE_PROJECT_NUMBER = "321790958376";

function getEnv(key: string): string | undefined {
  if (typeof Deno !== "undefined" && Deno.env) {
    return Deno.env.get(key);
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env[key];
  }
  return undefined;
}

function extractAmount(text: string): number {
  const rMatch = text.match(/r\$\s*([0-9]+(?:\.[0-9]{3})*(?:,[0-9]{1,2})?|[0-9]+(?:,[0-9]{1,2})?)/i);
  if (rMatch) {
    const cleaned = rMatch[1].replace(/\./g, "").replace(",", ".");
    const val = Number(cleaned);
    if (!Number.isNaN(val) && val > 0) return val;
  }

  const keywordMatch = text.match(
    /(?:deu|total|faturamento|faturou|valor|gasto|gastamos)\s*(?:de|em torno de|aproximado|aproximadamente)?\s*(?:r\$)?\s*([0-9]+(?:\.[0-9]{3})*(?:,[0-9]{1,2})?|[0-9]+)/i
  );
  if (keywordMatch) {
    const cleaned = keywordMatch[1].replace(/\./g, "").replace(",", ".");
    const val = Number(cleaned);
    if (!Number.isNaN(val) && val > 0) return val;
  }

  return 0;
}

export class GeminiProvider implements AIProvider {
  private apiKey: string | null;
  private model: string;
  private allowHeuristicFallback: boolean;
  private timeoutMs: number;

  constructor(options?: {
    apiKey?: string;
    model?: string;
    allowHeuristicFallback?: boolean;
    timeoutMs?: number;
  }) {
    this.apiKey = options?.apiKey || getEnv("GEMINI_API_KEY") || null;
    this.model = options?.model || getEnv("GEMINI_MODEL") || DEFAULT_GEMINI_MODEL;
    this.allowHeuristicFallback =
      options?.allowHeuristicFallback ??
      (getEnv("GOAT_AI_ALLOW_HEURISTIC_FALLBACK") === "true");
    this.timeoutMs = options?.timeoutMs || 20000; // 20s default timeout
  }

  async classify(input: AIInput): Promise<AIClassificationResult> {
    const result = await this.process(input);
    return {
      classification: result.classification,
      confidence: result.classification_confidence,
      reason: result.warnings.join("; ") || undefined,
    };
  }

  async extract(input: AIInput, classification?: GoatAIClassification): Promise<AIExtractionResult> {
    const result = await this.process(input);
    return {
      event_reference: result.event_reference,
      data: result.data,
      warnings: result.warnings,
      missing_fields: result.missing_fields,
      extraction_confidence: result.extraction_confidence,
    };
  }

  async process(input: AIInput): Promise<AIProcessedOutput> {
    const startTime = Date.now();
    const rawText = input.text || "";

    // 1. Missing Key Check
    if (!this.apiKey) {
      if (this.allowHeuristicFallback) {
        console.info("[goat-ai] stage=fallback_heuristic reason=api_key_missing");
        const fallback = this.heuristicProcess(input);
        fallback.provider_metadata.duration_ms = Date.now() - startTime;
        return fallback;
      }

      console.warn("[goat-ai] stage=gemini_process status=failed error_code=gemini_not_configured");
      return {
        classification: "unknown",
        classification_confidence: 0,
        extraction_confidence: 0,
        event_reference: {},
        data: {},
        warnings: ["Chave GEMINI_API_KEY não configurada e fallback heurístico desabilitado."],
        missing_fields: ["GEMINI_API_KEY"],
        provider_metadata: {
          provider: "none",
          model: this.model,
          processing_mode: "unavailable",
          prompt_version: "goat-ai-v1",
          processed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
        },
      };
    }

    // 2. Call Google Gemini API (Structured Output with OpenAPI responseSchema)
    try {
      // First check available models for this key
      try {
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`);
        const listData = await listRes.json();
        console.info(`[goat-ai] google_models_list_status=${listRes.status} data=${JSON.stringify(listData).slice(0, 200)}`);
      } catch (err: any) {
        console.warn(`[goat-ai] could not list models: ${err?.message}`);
      }

      const normalizedModel = this.model.startsWith("models/") ? this.model.slice(7) : this.model;
      const candidateModels = [
        normalizedModel,
        "gemini-2.0-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-pro",
      ];

      // Remove duplicates
      const uniqueModels = Array.from(new Set(candidateModels));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const userPrompt = `Mensagem operacional recebida:\n"""\n${rawText}\n"""\n\nRemetente: ${input.senderName || "Sócio"}\nTipo: ${input.messageType || "text"}`;

      const requestBodyWithSchema = {
        systemInstruction: {
          parts: [{ text: `${GOAT_AI_SYSTEM_INSTRUCTION}\n\n${CLASSIFIER_PROMPT}\n\n${EXTRACTOR_PROMPT}` }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: GEMINI_RESPONSE_SCHEMA,
          temperature: 0.1,
        },
      };

      const requestBodySimpleJson = {
        systemInstruction: {
          parts: [{ text: `${GOAT_AI_SYSTEM_INSTRUCTION}\n\n${CLASSIFIER_PROMPT}\n\n${EXTRACTOR_PROMPT}` }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      };

      let lastError: any = null;
      let resJson: any = null;
      let usedModel = normalizedModel;

      const endpoints = ["v1beta", "v1"];
      const payloads = [requestBodyWithSchema, requestBodySimpleJson];

      outerLoop: for (const m of uniqueModels) {
        for (const apiVer of endpoints) {
          for (const body of payloads) {
            try {
              const url = `https://generativelanguage.googleapis.com/${apiVer}/models/${m}:generateContent?key=${this.apiKey}`;
              const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal: controller.signal,
              });

              if (response.ok) {
                resJson = await response.json();
                usedModel = m;
                break outerLoop;
              }

              const errorText = await response.text();
              const status = response.status;
              console.warn(`[goat-ai] model=${m} apiVer=${apiVer} http_status=${status} error=${errorText.slice(0, 100)}`);

              if (status === 404) {
                lastError = new Error(`Modelo ${m} (${apiVer}) não encontrado (HTTP 404)`);
                continue;
              }

              if (status === 429) {
                throw new Error("Quota ou limite de requisições excedido no Gemini (HTTP 429).");
              }
              if (status >= 500) {
                throw new Error(`Serviço Gemini temporariamente indisponível (HTTP ${status}).`);
              }
              lastError = new Error(`Erro na API Gemini (HTTP ${status}): ${errorText.slice(0, 100)}`);
            } catch (err: any) {
              lastError = err;
              if (err.message.includes("429") || err.message.includes("500") || err.name === "AbortError") {
                throw err;
              }
            }
          }
        }
      }

      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;

      if (!resJson) {
        throw lastError || new Error("Nenhum modelo Gemini respondeu com sucesso");
      }
      const rawOutputText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawOutputText) throw new Error("Resposta vazia retornada pelo modelo Gemini");

      // Parse JSON
      let parsedRaw: unknown;
      try {
        parsedRaw = JSON.parse(rawOutputText);
      } catch {
        throw new Error("Falha ao fazer parse do JSON retornado pelo Gemini");
      }

      // Validate with Zod
      const validated = AIStructuredResponseSchema.safeParse(parsedRaw);
      if (!validated.success) {
        console.warn(`[goat-ai] stage=zod_validation_warning errors=${validated.error.message}`);
      }

      const outputData = validated.success ? validated.data : (parsedRaw as any);
      const classification = outputData.classification || "unknown";

      // Secondary schema validation for domain
      const domainVal = validateStructuredData(classification, outputData.data);
      const finalData = domainVal.isValid ? domainVal.data : outputData.data;

      // Extract Token Usage Metrics
      const usage = resJson.usageMetadata;
      const inputTokens = usage?.promptTokenCount;
      const outputTokens = usage?.candidatesTokenCount;

      console.info(
        `[goat-ai] stage=gemini_process model=${this.model} classification=${classification} durationMs=${durationMs} inputTokens=${inputTokens || 0} outputTokens=${outputTokens || 0} success=true`
      );

      return {
        classification,
        classification_confidence: Number(outputData.classification_confidence ?? 0.95),
        extraction_confidence: Number(outputData.extraction_confidence ?? 0.90),
        event_reference: outputData.event_reference || {},
        data: finalData,
        warnings: Array.isArray(outputData.warnings) ? outputData.warnings : [],
        missing_fields: Array.isArray(outputData.missing_fields) ? outputData.missing_fields : [],
        provider_metadata: {
          provider: "gemini",
          model: usedModel,
          processing_mode: "gemini",
          prompt_version: "goat-ai-v1",
          processed_at: new Date().toISOString(),
          duration_ms: durationMs,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
        },
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const isTimeout = err?.name === "AbortError" || err?.message?.includes("aborted");
      const errorMessage = isTimeout
        ? "Timeout na chamada à API Gemini (limite de 20s excedido)"
        : err?.message || "Erro inesperado na chamada ao Gemini";

      console.error(`[goat-ai] stage=gemini_process model=${this.model} durationMs=${durationMs} error=${errorMessage}`);

      if (this.allowHeuristicFallback) {
        console.info("[goat-ai] stage=fallback_heuristic reason=gemini_error");
        const fallback = this.heuristicProcess(input);
        fallback.warnings.push(`Falha no Gemini (${errorMessage}). Executado via fallback heurístico.`);
        fallback.provider_metadata.duration_ms = durationMs;
        return fallback;
      }

      return {
        classification: "unknown",
        classification_confidence: 0,
        extraction_confidence: 0,
        event_reference: {},
        data: {},
        warnings: [errorMessage],
        missing_fields: [],
        provider_metadata: {
          provider: "gemini",
          model: this.model,
          processing_mode: "unavailable",
          prompt_version: "goat-ai-v1",
          processed_at: new Date().toISOString(),
          duration_ms: durationMs,
        },
      };
    }
  }

  // Resilient heuristic extractor for test/dev
  private heuristicProcess(input: AIInput): AIProcessedOutput {
    const raw = input.text || "";
    const lower = normalizeStr(raw);

    let classification: GoatAIClassification = "unknown";
    let classificationConfidence = 0.92;
    let extractionConfidence = 0.85;
    const warnings: string[] = ["Processado via classificador heurístico Goat AI (modo dev/fallback)."];
    const eventRef: Record<string, string | null> = {
      name: null,
      client_name: null,
      groom_name: null,
      bride_name: null,
      event_name: null,
      date: null,
      event_date: null,
      location: null,
    };
    let data: Record<string, unknown> = {};

    // 1. Event Purchase
    if (
      lower.includes("comprei") ||
      lower.includes("compra") ||
      lower.includes("nota") ||
      lower.includes("assai") ||
      lower.includes("atacadao") ||
      lower.includes("comprovante")
    ) {
      classification = "event_purchase";
      classificationConfidence = 0.95;
      extractionConfidence = 0.90;

      const total = extractAmount(raw);

      let supplier = "Fornecedor";
      if (lower.includes("assai")) supplier = "Assaí";
      else if (lower.includes("atacadao")) supplier = "Atacadão";
      else if (lower.includes("epa")) supplier = "EPA Supermercados";
      else if (lower.includes("bh")) supplier = "Supermercados BH";

      const casMatch = raw.match(/casamento\s+(?:de\s+|da\s+|do\s+)?([A-Za-zÀ-ÿ]+(?:\s+e\s+[A-Za-zÀ-ÿ]+)?)/i);
      if (casMatch) {
        eventRef.name = `Casamento da ${casMatch[1]}`;
        eventRef.event_name = `Casamento da ${casMatch[1]}`;
        const parts = casMatch[1].split(/\s+e\s+/i);
        if (parts.length === 2) {
          eventRef.bride_name = parts[0].trim();
          eventRef.groom_name = parts[1].trim();
        } else {
          eventRef.client_name = casMatch[1].trim();
        }
      }

      const items: Array<{ description: string; name: string; quantity: number; unit: string; unit_price: null; total_price: null }> = [];
      const itemRegex = /([0-9]+)\s+(?:garrafas?|caixas?|fardos?|unidades?|un)?\s*(?:de\s+)?([A-Za-zÀ-ÿ0-9\s]+?)(?=(?:,|e\s+[0-9]|\.|\n|$))/gi;
      let match;
      while ((match = itemRegex.exec(raw)) !== null) {
        const qty = Number(match[1]) || 1;
        const name = match[2].trim();
        if (name && !["deu", "no", "na", "para", "casamento"].includes(normalizeStr(name))) {
          items.push({
            description: name,
            name,
            quantity: qty,
            unit: "un",
            unit_price: null,
            total_price: null,
          });
        }
      }

      data = {
        supplier,
        purchase_date: new Date().toISOString().split("T")[0],
        total,
        payment_method: "PIX",
        category: "Insumos",
        items,
        notes: raw,
      };
    }
    // 2. Sales Session
    else if (
      lower.includes("vendemos") ||
      lower.includes("faturamento") ||
      lower.includes("7 steak") ||
      lower.includes("botequim")
    ) {
      classification = "sales_session";
      classificationConfidence = 0.92;
      extractionConfidence = 0.88;

      const location = lower.includes("7 steak") ? "7Steakhouse" : "Goat Botequim";
      const revenue = extractAmount(raw);

      const sales: Array<{ product: string; quantity: number }> = [];
      const saleRegex = /([0-9]+)\s+([A-Za-zÀ-ÿ\s]+?)(?=(?:,|e\s+[0-9]|\.|\n|$))/gi;
      let match;
      while ((match = saleRegex.exec(raw)) !== null) {
        const qty = Number(match[1]) || 1;
        const prod = match[2].trim();
        if (prod && !["old", "horas", "h", "minutos", "pessoas", "reais"].includes(normalizeStr(prod))) {
          sales.push({ product: prod, quantity: qty });
        }
      }

      // Extract Peak Hours (e.g. "entre 20h e 22h")
      let peakPeriod: { start: string; end: string } | null = null;
      const peakMatch = raw.match(/(?:entre|das)\s*([0-9]{1,2})h?\s*(?:e|as|às)\s*([0-9]{1,2})h?/i);
      if (peakMatch) {
        const startH = peakMatch[1].padStart(2, "0");
        const endH = peakMatch[2].padStart(2, "0");
        peakPeriod = { start: `${startH}:00`, end: `${endH}:00` };
      }

      const issues: string[] = [];
      if (lower.includes("demora no primeiro atendimento")) {
        issues.push("Demora no primeiro atendimento");
      } else if (lower.includes("demora")) {
        issues.push("Demora no atendimento");
      }

      data = {
        location,
        date: new Date().toISOString().split("T")[0],
        revenue,
        sales,
        peak_period: peakPeriod,
        issues,
        notes: raw,
      };
    }
    // 3. Operation Report
    else if (
      lower.includes("relatorio") ||
      lower.includes("ocorrencia") ||
      lower.includes("equipe") ||
      lower.includes("problema")
    ) {
      classification = "operation_report";
      data = {
        location: "Geral",
        date: new Date().toISOString().split("T")[0],
        summary: raw,
        issues: [],
        highlights: [],
        notes: raw,
      };
    }
    // 4. General Note
    else {
      classification = "general_note";
      classificationConfidence = 0.70;
      extractionConfidence = 0.70;
      data = {
        title: "Nota Operacional",
        content: raw,
        tags: [],
      };
    }

    return {
      classification,
      classification_confidence: classificationConfidence,
      extraction_confidence: extractionConfidence,
      event_reference: eventRef,
      data,
      warnings,
      provider_metadata: {
        provider: "heuristic",
        model: "rule-based-v1",
        processing_mode: "heuristic",
        prompt_version: "goat-ai-v1",
        processed_at: new Date().toISOString(),
      },
    };
  }
}
