import {
  NormalizedAIRequest,
  NormalizedAIResponse,
  NormalizedMessage,
  NormalizedToolCall,
  NormalizedToolDefinition,
} from "./types.ts";

export function sanitizeLogText(text: string): string {
  if (!text) return "";
  // Strip Bearer tokens, API keys and sensitive auth headers
  return text
    .replace(/Bearer\s+[A-Za-z0-9_\-\.]{8,}/gi, "Bearer [REDACTED]")
    .replace(/\b(?:gsk|sk|nvapi)_[A-Za-z0-9_\-]{8,}\b/gi, "[REDACTED]")
    .replace(/(key|token|secret|authorization|api_key|password)=([^\s&"']+)/gi, "$1=[REDACTED]")
    .replace(/(x-api-key|authorization):\s*["']?[A-Za-z0-9_\-\.]{8,}["']?/gi, "$1: [REDACTED]");
}

// Convert Canonical Tools to OpenAI Tools Format
export function toOpenAITools(tools?: NormalizedToolDefinition[]): Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}> | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

// Convert Canonical Messages to OpenAI Chat Messages Format
export function toOpenAIMessages(
  messages: NormalizedMessage[],
  systemInstruction?: string
): Array<Record<string, any>> {
  const result: Array<Record<string, any>> = [];

  if (systemInstruction) {
    result.push({
      role: "system",
      content: systemInstruction,
    });
  }

  for (const m of messages) {
    if (m.role === "system") {
      result.push({
        role: "system",
        content: m.content || "",
      });
    } else if (m.role === "user") {
      let content = m.content || "";
      if (m.senderName) {
        content = `[De: ${m.senderName}]\n${content}`;
      }
      result.push({
        role: "user",
        content,
      });
    } else if (m.role === "assistant") {
      const msg: Record<string, any> = {
        role: "assistant",
        content: m.content || null,
      };

      if (m.toolCalls && m.toolCalls.length > 0) {
        msg.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: typeof tc.arguments === "string" ? tc.arguments : JSON.stringify(tc.arguments || {}),
          },
        }));
      }

      result.push(msg);
    } else if (m.role === "tool") {
      result.push({
        role: "tool",
        tool_call_id: m.toolCallId || "call_unknown",
        name: m.toolName,
        content: typeof m.toolResult === "string" ? m.toolResult : JSON.stringify(m.toolResult ?? {}),
      });
    }
  }

  return result;
}

// Parse OpenAI-compatible Response to Canonical NormalizedAIResponse
export function fromOpenAIResponse(
  data: any,
  providerId: any,
  modelId: string,
  durationMs: number
): NormalizedAIResponse {
  const choice = data?.choices?.[0];
  const message = choice?.message;

  let text: string | undefined = message?.content || undefined;
  const toolCalls: NormalizedToolCall[] = [];

  if (message?.tool_calls && Array.isArray(message.tool_calls)) {
    for (const tc of message.tool_calls) {
      let args: Record<string, any> = {};
      try {
        args = typeof tc.function?.arguments === "string" ? JSON.parse(tc.function.arguments) : (tc.function?.arguments || {});
      } catch {
        args = { raw: tc.function?.arguments };
      }
      toolCalls.push({
        id: tc.id || `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: tc.function?.name || "",
        arguments: args,
      });
    }
  }

  const usage = data?.usage
    ? {
        inputTokens: data.usage.prompt_tokens || 0,
        outputTokens: data.usage.completion_tokens || 0,
        totalTokens: data.usage.total_tokens || (data.usage.prompt_tokens || 0) + (data.usage.completion_tokens || 0),
      }
    : undefined;

  return {
    text,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    usage,
    finishReason: choice?.finish_reason || "stop",
    providerId,
    modelId,
    durationMs,
    raw: data,
  };
}

// Convert Canonical Messages to Gemini Contents Format
export function toGeminiContents(
  messages: NormalizedMessage[]
): Array<{ role: "user" | "model"; parts: any[] }> {
  const contents: Array<{ role: "user" | "model"; parts: any[] }> = [];

  for (const m of messages) {
    if (m.role === "system") {
      // Gemini handles system instruction via systemInstruction parameter
      continue;
    }

    if (m.role === "user") {
      const parts: any[] = [];
      if (m.attachments && m.attachments.length > 0) {
        for (const att of m.attachments) {
          if (att.dataBase64) {
            parts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: att.dataBase64,
              },
            });
          }
        }
      }
      let text = m.content || "";
      if (m.senderName) {
        text = `[De: ${m.senderName}]\n${text}`;
      }
      parts.push({ text: text || "Processar" });

      contents.push({ role: "user", parts });
    } else if (m.role === "assistant") {
      const parts: any[] = [];
      if (m.content) {
        parts.push({ text: m.content });
      }
      if (m.toolCalls && m.toolCalls.length > 0) {
        for (const tc of m.toolCalls) {
          parts.push({
            functionCall: {
              name: tc.name,
              args: tc.arguments || {},
            },
          });
        }
      }
      if (parts.length > 0) {
        contents.push({ role: "model", parts });
      }
    } else if (m.role === "tool") {
      // Gemini expects tool responses as role "user" with functionResponse
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: m.toolName || "tool_result",
              response: {
                name: m.toolName || "tool_result",
                content: m.toolResult ?? {},
              },
            },
          },
        ],
      });
    }
  }

  return contents;
}

// Parse Gemini Response to Canonical NormalizedAIResponse
export function fromGeminiResponse(
  data: any,
  modelId: string,
  durationMs: number
): NormalizedAIResponse {
  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  let text: string | undefined = undefined;
  const toolCalls: NormalizedToolCall[] = [];

  for (const part of parts) {
    if (part.text) {
      text = (text ? `${text}\n` : "") + part.text;
    }
    if (part.functionCall) {
      toolCalls.push({
        id: `gemini_call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: part.functionCall.name,
        arguments: part.functionCall.args || {},
      });
    }
  }

  const usage = data?.usageMetadata
    ? {
        inputTokens: data.usageMetadata.promptTokenCount || 0,
        outputTokens: data.usageMetadata.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata.totalTokenCount || (data.usageMetadata.promptTokenCount || 0) + (data.usageMetadata.candidatesTokenCount || 0),
      }
    : undefined;

  return {
    text,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    usage,
    finishReason: candidate?.finishReason || "STOP",
    providerId: "gemini",
    modelId,
    durationMs,
    raw: data,
  };
}
