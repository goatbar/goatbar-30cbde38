import {
  AgentInput,
  AgentTurnResponse,
  ToolContext,
} from "../types.ts";
import { GOAT_AI_CONVERSATIONAL_SYSTEM_PROMPT } from "../prompts/system.ts";
import { ConversationManager } from "../conversation/manager.ts";
import { defaultToolRegistry, GoatAIToolRegistry } from "../tools/registry.ts";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const MAX_TOOL_CALLS_PER_TURN = 8;

export class GoatAIGeminiAgent {
  private apiKey: string;
  private conversationManager: ConversationManager;
  private toolRegistry: GoatAIToolRegistry;
  private supabaseAdmin: any;

  constructor(
    supabaseAdmin: any,
    apiKey?: string,
    toolRegistry: GoatAIToolRegistry = defaultToolRegistry
  ) {
    this.supabaseAdmin = supabaseAdmin;
    this.apiKey = apiKey || Deno.env.get("GEMINI_API_KEY") || "";
    this.toolRegistry = toolRegistry;
    this.conversationManager = new ConversationManager(supabaseAdmin, toolRegistry);
  }

  public async processTurn(input: AgentInput): Promise<AgentTurnResponse> {
    const conversation = await this.conversationManager.getOrCreateConversation(
      input.channel,
      input.userId,
      input.externalMessageId ? input.conversationId : undefined,
      input.message.slice(0, 40) || "Atendimento Goat AI"
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
    const userMessage = await this.conversationManager.saveMessage(
      conversation.id,
      "user",
      input.message,
      input.attachments && input.attachments.length > 0 ? "image" : "text",
      input.attachments?.[0]?.url,
      input.externalMessageId,
      input.userName
    );

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
            inline_data: {
              mime_type: att.mimeType,
              data: att.dataBase64,
            },
          });
        }
      }
    }

    // If there was an active pending action collecting fields, supply guidance
    let promptText = input.message;
    if (activePending && activePending.status === "collecting") {
      promptText += `\n[CONTEXTO: Há uma ação em andamento '${activePending.tool_name}' com dados parciais ${JSON.stringify(activePending.arguments)}. Campos pendentes: [${activePending.missing_fields.join(", ")}]. Use a resposta para completar os campos e chamar novamente a ferramenta.]`;
    }

    currentParts.push({ text: promptText });
    contents.push({
      role: "user",
      parts: currentParts,
    });

    // 4. Gemini Agent Tool Loop
    let turnCount = 0;
    const toolsExecuted: any[] = [];
    let finalReply = "";
    let finalPendingAction: any = null;

    if (!this.apiKey) {
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

    while (turnCount < MAX_TOOL_CALLS_PER_TURN) {
      turnCount++;

      const payload = {
        system_instruction: {
          parts: [{ text: GOAT_AI_CONVERSATIONAL_SYSTEM_PROMPT }],
        },
        contents,
        tools: [
          {
            function_declarations: this.toolRegistry.getGeminiFunctionDeclarations(),
          },
        ],
        generation_config: {
          temperature: 0.2,
          max_output_tokens: 1500,
        },
      };

      const res = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        finalReply = `Erro na comunicação com a IA: ${res.statusText}. Sua mensagem foi salva no histórico.`;
        console.error("Gemini Agent API error:", errText);
        break;
      }

      const geminiData = await res.json();
      const candidate = geminiData.candidates?.[0]?.content;
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
          // If arguments have all required fields, stage as ready_for_confirmation
          const reqFields = toolDef.parameters.required || [];
          const missing = reqFields.filter((f) => args[f] == null || args[f] === "");

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
            // Let Gemini or system present summary asking for confirmation
            finalReply = candidate.parts.find((p: any) => p.text)?.text || summary;
            break;
          } else {
            // Stage as collecting
            const pending = await this.conversationManager.savePendingAction(
              conversation.id,
              toolName,
              args,
              missing,
              `Coletando campos faltantes: ${missing.join(", ")}`,
              "collecting"
            );
            finalPendingAction = pending;
            finalReply = candidate.parts.find((p: any) => p.text)?.text || `Identifiquei os dados, mas ainda preciso de: ${missing.join(", ")}. Pode informar?`;
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
          role: "function",
          parts: [
            {
              functionResponse: {
                name: toolName,
                response: {
                  name: toolName,
                  content: toolResult.success ? toolResult.data : { error: toolResult.error },
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
