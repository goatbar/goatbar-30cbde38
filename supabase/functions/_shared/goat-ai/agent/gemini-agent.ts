import {
  AgentInput,
  AgentTurnResponse,
  ToolContext,
} from "../types.ts";
import { GOAT_AI_CONVERSATIONAL_SYSTEM_PROMPT } from "../prompts/system.ts";
import { ConversationManager } from "../conversation/manager.ts";
import { defaultToolRegistry, GoatAIToolRegistry } from "../tools/registry.ts";
import { getEnv, getGeminiModel } from "../config.ts";

const MAX_TOOL_CALLS_PER_TURN = 8;

export class GoatAIGeminiAgent {
  private apiKey: string;
  private model: string;
  private conversationManager: ConversationManager;
  private toolRegistry: GoatAIToolRegistry;
  private supabaseAdmin: any;

  constructor(
    supabaseAdmin: any,
    apiKey?: string,
    toolRegistry: GoatAIToolRegistry = defaultToolRegistry,
    model?: string
  ) {
    this.supabaseAdmin = supabaseAdmin;
    this.apiKey = apiKey || getEnv("GEMINI_API_KEY") || getEnv("GOOGLE_AI_API_KEY") || getEnv("GOOGLE_API_KEY");
    this.model = model || getGeminiModel();
    this.toolRegistry = toolRegistry;
    this.conversationManager = new ConversationManager(supabaseAdmin, toolRegistry);
  }

  public async processTurn(input: AgentInput): Promise<AgentTurnResponse> {
    const correlationId = input.correlationId || `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const turnStartTime = Date.now();

    const conversation = await this.conversationManager.getOrCreateConversation(
      input.channel,
      input.userId,
      input.externalMessageId ? input.conversationId : undefined,
      input.message.slice(0, 40) || "Conversa com a GIA"
    );

    const context: ToolContext = {
      supabaseAdmin: this.supabaseAdmin,
      userId: input.userId,
      userName: input.userName || "Usuário",
      userRole: input.userRole || "socio",
      conversationId: conversation.id,
      channel: input.channel,
    };

    // 1. Record user message
    let messageType: "text" | "image" | "document" | "audio" = "text";
    if (input.attachments && input.attachments.length > 0) {
      const mime = input.attachments[0].mimeType.toLowerCase();
      if (mime.startsWith("image/")) messageType = "image";
      else if (mime.startsWith("audio/")) messageType = "audio";
      else if (mime.includes("pdf") || mime.includes("document")) messageType = "document";
    }

    const userMessage = await this.conversationManager.saveMessage(
      conversation.id,
      "user",
      input.message,
      messageType,
      input.attachments?.[0]?.url,
      input.externalMessageId,
      input.userName
    );

    console.log(`[GOAT-AI][CONVERSATION] correlationId=${correlationId} conversationId=${conversation.id} userMessageId=${userMessage.id} messageType=${messageType}`);

    // 2. Check Confirmation Intent against active pending actions
    const activePending = await this.conversationManager.getActivePendingAction(conversation.id);

    if (activePending && activePending.status === "ready_for_confirmation") {
      if (this.conversationManager.isConfirmationIntent(input.message)) {
        const execResult = await this.conversationManager.executePendingAction(activePending, context);
        let confirmationReply = "";

        if (execResult.success) {
          confirmationReply = execResult.message || `Operação '${activePending.tool_name}' confirmada e executada com sucesso no sistema.`;
        } else {
          confirmationReply = `Não foi possível concluir a operação: ${execResult.error || "Erro desconhecido"}.`;
        }

        const assistantMsg = await this.conversationManager.saveMessage(
          conversation.id,
          "assistant",
          confirmationReply,
          "action_result"
        );

        return {
          conversationId: conversation.id,
          messageId: assistantMsg.id,
          reply: confirmationReply,
          toolCallsExecuted: [
            {
              toolName: activePending.tool_name,
              arguments: activePending.arguments,
              result: execResult.data,
              status: execResult.success ? "success" : "error",
            },
          ],
          pendingAction: null,
        };
      } else if (this.conversationManager.isRejectionIntent(input.message)) {
        await this.supabaseAdmin
          .from("ai_pending_actions")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", activePending.id);

        const cancelReply = "Operação cancelada. Como posso ajudar com outra tarefa?";
        const assistantMsg = await this.conversationManager.saveMessage(
          conversation.id,
          "assistant",
          cancelReply,
          "text"
        );

        return {
          conversationId: conversation.id,
          messageId: assistantMsg.id,
          reply: cancelReply,
          toolCallsExecuted: [],
          pendingAction: null,
        };
      }
    }

    // 3. Prepare Gemini Contents with Multi-turn History
    const history = await this.conversationManager.getRecentMessages(conversation.id, 10);
    const contents: any[] = [];

    for (const h of history) {
      if (h.id === userMessage.id) continue; // add current message below
      if (h.role === "user") {
        contents.push({
          role: "user",
          parts: [{ text: h.content }],
        });
      } else if (h.role === "assistant") {
        contents.push({
          role: "model",
          parts: [{ text: h.content }],
        });
      }
    }

    // Current turn parts
    const currentParts: any[] = [];
    if (input.attachments && input.attachments.length > 0) {
      for (const att of input.attachments) {
        if (att.dataBase64) {
          currentParts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.dataBase64,
            },
          });
        }
      }
    }

    // If there was an active pending action collecting fields, supply guidance
    let promptText = input.message;
    if (activePending && activePending.status === "collecting") {
      promptText += `\n[CONTEXTO OPERACIONAL: Há uma ação em andamento '${activePending.tool_name}' com dados já preenchidos: ${JSON.stringify(activePending.arguments)}. Campos pendentes necessários: [${activePending.missing_fields.join(", ")}]. Use os novos dados da mensagem para preencher os campos e acionar a ferramenta correspondente.]`;
    }

    currentParts.push({ text: promptText || "Processar entrada" });
    contents.push({
      role: "user",
      parts: currentParts,
    });

    // 4. Gemini Agent Tool Loop
    let turnCount = 0;
    const toolsExecuted: any[] = [];
    let finalReply = "";
    let finalPendingAction: any = null;

    const effectiveApiKey = this.apiKey || getEnv("GEMINI_API_KEY") || getEnv("GOOGLE_AI_API_KEY") || getEnv("GOOGLE_API_KEY");

    if (!effectiveApiKey) {
      console.error(`[GOAT-AI][PROVIDER][ERROR] correlationId=${correlationId} provider=gemini model=${this.model} error="GEMINI_API_KEY ausente ou não configurada no runtime" geminiApiKeyConfigured=false`);
      finalReply = "Integração Gemini não configurada (chave GEMINI_API_KEY ausente).";
      const assistantMsg = await this.conversationManager.saveMessage(
        conversation.id,
        "assistant",
        finalReply,
        "text"
      );
      return {
        conversationId: conversation.id,
        messageId: assistantMsg.id,
        reply: finalReply,
        toolCallsExecuted: [],
      };
    }

    const rawModel = this.model.startsWith("models/") ? this.model.slice(7) : this.model;
    const resolvedModel = (rawModel.includes("1.5") || rawModel.includes("2.0") || rawModel.includes("2.5"))
      ? "gemini-3.6-flash"
      : (rawModel || "gemini-3.6-flash");

    const candidateModels = [resolvedModel];

    console.log(`[GOAT-AI][PROVIDER][START] correlationId=${correlationId} provider=gemini model=${resolvedModel} contextMessageCount=${contents.length} toolsAvailable=${this.toolRegistry.listTools().map((t) => t.name).join(",")}`);

    while (turnCount < MAX_TOOL_CALLS_PER_TURN) {
      turnCount++;

      // Canonical Gemini REST API Payload using camelCase properties
      const payload = {
        systemInstruction: {
          parts: [{ text: GOAT_AI_CONVERSATIONAL_SYSTEM_PROMPT }],
        },
        contents,
        tools: [
          {
            functionDeclarations: this.toolRegistry.getGeminiFunctionDeclarations(),
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1500,
        },
      };

      let resJson: any = null;
      let callError: any = null;
      let usedModel = this.model;

      for (const m of candidateModels) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${effectiveApiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            resJson = await res.json();
            usedModel = m;
            break;
          } else {
            const errText = await res.text();
            callError = {
              name: "GeminiHttpError",
              message: `HTTP ${res.status} no modelo ${m}: ${errText.slice(0, 300)}`,
              status: res.status,
              body: errText.slice(0, 300),
              model: m,
            };
            console.error(`[GOAT-AI][PROVIDER][ERROR] correlationId=${correlationId} provider=gemini model=${m} status=${res.status} error=${JSON.stringify(callError)}`);
          }
        } catch (err: any) {
          clearTimeout(timeoutId);
          const isTimeout = err?.name === "AbortError" || err?.message?.includes("aborted");
          callError = {
            name: isTimeout ? "TimeoutError" : (err?.name || "FetchError"),
            message: isTimeout ? "Timeout de 25s excedido na API Gemini" : (err?.message || String(err)),
            stack: err?.stack,
            model: m,
          };
          console.error(`[GOAT-AI][PROVIDER][ERROR] correlationId=${correlationId} provider=gemini model=${m} error=${JSON.stringify(callError)}`);
        }
      }

      if (!resJson) {
        finalReply = `Não consegui processar a resposta com a IA no momento. Sua mensagem foi salva no histórico.`;
        console.error(`[GOAT-AI][PROVIDER][ERROR] correlationId=${correlationId} final_fallback=true callError=${JSON.stringify(callError)}`);
        break;
      }

      const durationMs = Date.now() - turnStartTime;
      const finishReason = resJson.candidates?.[0]?.finishReason || "STOP";
      const usage = resJson.usageMetadata;

      console.log(`[GOAT-AI][PROVIDER][SUCCESS] correlationId=${correlationId} provider=gemini model=${usedModel} durationMs=${durationMs} finishReason=${finishReason} promptTokens=${usage?.promptTokenCount || 0} candidatesTokens=${usage?.candidatesTokenCount || 0}`);

      const candidate = resJson.candidates?.[0]?.content;
      if (!candidate || !candidate.parts) {
        finalReply = "Não consegui interpretar a resposta no momento. Pode reformular?";
        break;
      }

      // Check if candidate made function calls
      const functionCallPart = candidate.parts.find((p: any) => p.functionCall);

      if (functionCallPart && functionCallPart.functionCall) {
        const { name: toolName, args } = functionCallPart.functionCall;
        const toolDef = this.toolRegistry.getTool(toolName);

        // Check if tool requires user confirmation before mutation
        if (toolDef?.requiresConfirmation) {
          const reqFields = toolDef.parameters.required || [];
          const missing = reqFields.filter((f: string) => args[f] == null || args[f] === "");

          if (missing.length === 0) {
            const summary = `Vou registrar ${toolDef.description.toLowerCase()}: ${JSON.stringify(args)}. Confirma?`;
            const pending = await this.conversationManager.savePendingAction(
              conversation.id,
              toolName,
              args,
              [],
              summary,
              "ready_for_confirmation"
            );

            finalPendingAction = pending;
            finalReply = candidate.parts.find((p: any) => p.text)?.text || summary;
            break;
          } else {
            const pending = await this.conversationManager.savePendingAction(
              conversation.id,
              toolName,
              args,
              missing,
              `Coletando campos faltantes: ${missing.join(", ")}`,
              "collecting"
            );
            finalPendingAction = pending;
            finalReply = candidate.parts.find((p: any) => p.text)?.text || `Identifiquei os dados da operação, mas ainda preciso de: ${missing.join(", ")}. Pode informar?`;
            break;
          }
        }

        // Execute read-only tool
        const toolResult = await this.toolRegistry.executeTool(toolName, args, context);
        toolsExecuted.push({
          toolName,
          arguments: args,
          result: toolResult.data,
          status: toolResult.success ? "success" : "error",
        });

        // Append model call and tool response to history for next iteration
        contents.push({
          role: "model",
          parts: [functionCallPart],
        });

        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: toolName,
                response: {
                  name: toolName,
                  content: toolResult.success ? (toolResult.data ?? {}) : { error: toolResult.error || "Erro na ferramenta" },
                },
              },
            },
          ],
        });
      } else {
        // Model provided final natural language response
        const textPart = candidate.parts.find((p: any) => p.text);
        finalReply = textPart?.text || "Entendido.";
        break;
      }
    }

    if (!finalReply) {
      finalReply = "Processamento concluído.";
    }

    // 5. Save assistant message
    const assistantMsg = await this.conversationManager.saveMessage(
      conversation.id,
      "assistant",
      finalReply,
      "text"
    );

    return {
      conversationId: conversation.id,
      messageId: assistantMsg.id,
      reply: finalReply,
      toolCallsExecuted: toolsExecuted,
      pendingAction: finalPendingAction,
    };
  }
}
