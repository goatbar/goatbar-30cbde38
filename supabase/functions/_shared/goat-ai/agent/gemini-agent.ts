import {
  AgentInput,
  AgentTurnResponse,
  PrivacyClassification,
  ToolContext,
} from "../types.ts";
import { GOAT_AI_CONVERSATIONAL_SYSTEM_PROMPT } from "../prompts/system.ts";
import { ConversationManager } from "../conversation/manager.ts";
import { defaultToolRegistry, GoatAIToolRegistry } from "../tools/registry.ts";
import { getEnv, getGeminiModel } from "../config.ts";
import {
  validateSalesSessionData,
  validateSalesSessionDraft,
  checkDuplicateSalesSession,
  formatSalesSessionWhatsAppPreview,
} from "../validators/sales-session-validator.ts";
import { resolveBusinessUnit } from "../matchers/unit-matcher.ts";
import { AIRouter } from "../router/ai-router.ts";
import {
  NormalizedAIRequest,
  NormalizedMessage,
} from "../router/types.ts";
import { CircuitBreakerManager } from "../router/circuit-breaker.ts";

const MAX_TOOL_CALLS_PER_TURN = 8;

export function determinePrivacyClass(input: AgentInput): PrivacyClassification {
  const text = (input.message || "").toLowerCase();
  if (
    text.includes("cpf") ||
    text.includes("rg ") ||
    text.includes("telefone") ||
    text.includes("cliente") ||
    text.includes("noivos") ||
    text.includes("contrato")
  ) {
    return "CUSTOMER_DATA";
  }
  if (
    text.includes("extrato bancario") ||
    text.includes("saldo da conta") ||
    text.includes("balanco patrimonial") ||
    text.includes("dre consolidado") ||
    text.includes("dre geral")
  ) {
    return "FINANCIAL";
  }
  return "COMMERCIAL";
}

export class GoatAIGeminiAgent {
  private apiKey: string;
  private model: string;
  private conversationManager: ConversationManager;
  private toolRegistry: GoatAIToolRegistry;
  private supabaseAdmin: any;
  private router: AIRouter;

  constructor(
    supabaseAdmin: any,
    apiKey?: string,
    toolRegistry: GoatAIToolRegistry = defaultToolRegistry,
    model?: string,
    router?: AIRouter
  ) {
    this.supabaseAdmin = supabaseAdmin;
    this.apiKey = apiKey !== undefined ? apiKey : (getEnv("GEMINI_API_KEY") || getEnv("GOOGLE_AI_API_KEY") || getEnv("GOOGLE_API_KEY"));
    this.model = model || getGeminiModel();
    this.toolRegistry = toolRegistry;
    this.conversationManager = new ConversationManager(supabaseAdmin, toolRegistry);

    if (router) {
      this.router = router;
    } else {
      this.router = new AIRouter({
        supabaseAdmin,
        overrideSecrets: {
          gemini: {
            apiKey: this.apiKey,
            model: this.model,
          },
        },
      });
    }
  }

  public getRouter(): AIRouter {
    return this.router;
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

    // Check for missing API Key if no providers are available
    const availableProviders = this.router.getProviders().filter((p) => p.isAvailable().available);
    if (availableProviders.length === 0 && !this.apiKey) {
      console.error(`[GOAT-AI][PROVIDER][ERROR] correlationId=${correlationId} provider=gemini model=${this.model} error="GEMINI_API_KEY ausente ou não configurada no runtime" geminiApiKeyConfigured=false`);
      const unavailReply = "Integração Gemini não configurada (chave GEMINI_API_KEY ausente).";
      const assistantMsg = await this.conversationManager.saveMessage(
        conversation.id,
        "assistant",
        unavailReply,
        "text"
      );
      return {
        conversationId: conversation.id,
        messageId: assistantMsg.id,
        reply: unavailReply,
        toolCallsExecuted: [],
      };
    }

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

    // 3. Prepare Canonical Multi-turn Messages
    const history = await this.conversationManager.getRecentMessages(conversation.id, 10);
    const normalizedMessages: NormalizedMessage[] = [];

    for (const h of history) {
      if (h.id === userMessage.id) continue;
      if (h.role === "user") {
        normalizedMessages.push({
          role: "user",
          content: h.content,
          senderName: h.sender_name || undefined,
        });
      } else if (h.role === "assistant") {
        normalizedMessages.push({
          role: "assistant",
          content: h.content,
        });
      }
    }

    // Helper to extract recent unit from conversation history
    const getRecentUnitFromHistory = (): string | undefined => {
      if (activePending?.arguments?.unit_name) {
        return activePending.arguments.unit_name;
      }
      for (const h of history) {
        const res = resolveBusinessUnit(h.content);
        if (res.matched) {
          return res.canonicalName;
        }
      }
      return undefined;
    };

    const inheritedUnit = getRecentUnitFromHistory();

    // Contextual instruction if pending action was collecting missing fields or if unit was previously resolved
    let userPromptText = input.message;
    if (activePending && activePending.status === "collecting") {
      userPromptText += `\n[CONTEXTO OPERACIONAL: Há uma ação em andamento '${activePending.tool_name}' com dados já preenchidos: ${JSON.stringify(activePending.arguments)}. Campos pendentes necessários: [${activePending.missing_fields.join(", ")}]. Use os novos dados da mensagem para preencher os campos e acionar a ferramenta correspondente.]`;
    } else if (inheritedUnit && !input.message.toLowerCase().includes("steak") && !input.message.toLowerCase().includes("botequim")) {
      userPromptText += `\n[CONTEXTO OPERACIONAL: A unidade já identificada na conversa é '${inheritedUnit}'. Utilize esta unidade ao registrar a sessão de vendas.]`;
    }

    normalizedMessages.push({
      role: "user",
      content: userPromptText || "Processar entrada",
      senderName: input.userName || undefined,
      attachments: input.attachments,
    });

    // 4. Multi-Provider Router Tool Loop
    let turnCount = 0;
    const toolsExecuted: any[] = [];
    const executedToolNamesSet = new Set<string>();
    let finalReply = "";
    let finalPendingAction: any = null;
    let lastActiveProvider: string | null = null;

    const privacyClassification = determinePrivacyClass(input);

    while (turnCount < MAX_TOOL_CALLS_PER_TURN) {
      turnCount++;

      const routerRequest: NormalizedAIRequest = {
        correlationId,
        messages: normalizedMessages,
        systemInstruction: GOAT_AI_CONVERSATIONAL_SYSTEM_PROMPT,
        tools: this.toolRegistry.listTools().map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
        temperature: 0.2,
        maxTokens: 1500,
        privacyClassification,
      };

      const response = await this.router.generate(routerRequest);

      // Detect empty response without tools
      if (!response.text && (!response.toolCalls || response.toolCalls.length === 0)) {
        finalReply = "Não consegui interpretar a resposta no momento. Pode reformular?";
        break;
      }

      // Detect mid-turn provider switch
      if (lastActiveProvider && lastActiveProvider !== response.providerId) {
        console.log(
          `[GOAT-AI][ROUTER][PROVIDER_SWITCH] correlationId=${correlationId} fromProvider=${lastActiveProvider} toProvider=${response.providerId} reason="mid_turn_switch" toolsAlreadyExecuted=${Array.from(executedToolNamesSet).join(",")} turnStep=${turnCount}`
        );
      }
      lastActiveProvider = response.providerId;

      // Check if response contains tool calls
      if (response.toolCalls && response.toolCalls.length > 0) {
        let hasPendingOrBreak = false;

        for (const toolCall of response.toolCalls) {
          const toolName = toolCall.name;
          const args = toolCall.arguments || {};
          const toolDef = this.toolRegistry.getTool(toolName);

          // Prevent duplicate execution of the same tool in the same turn
          const toolExecKey = `${toolName}:${JSON.stringify(args)}`;
          if (executedToolNamesSet.has(toolExecKey)) {
            console.warn(`[GOAT-AI][ROUTER] Duplicate tool execution blocked: ${toolExecKey}`);
            continue;
          }

          // Check if tool requires user confirmation / validation before mutation
          if (toolDef?.requiresConfirmation) {
            if (toolName === "create_sales_session") {
              const priorArgs = (activePending && activePending.status === "collecting") ? (activePending.arguments || {}) : {};
              const mergedArgs = { ...priorArgs, ...args };

              if (!mergedArgs.unit_name && inheritedUnit) {
                mergedArgs.unit_name = inheritedUnit;
              }

              // Fetch drinks catalog for validation & price resolution
              let catalog: any[] = [];
              try {
                const { data: dbDrinks } = await this.supabaseAdmin
                  .from("drinks")
                  .select("id, nome, custo_unitario, modality_config");
                if (dbDrinks) catalog = dbDrinks;
              } catch {
                // catalog optional
              }

              const validation = validateSalesSessionDraft(mergedArgs, catalog);

              console.log(
                `[GOAT-AI][SALES_DRAFT][EXTRACTED] correlationId=${correlationId} unit="${validation.normalized?.unit_name || mergedArgs.unit_name || "none"}" date="${validation.normalized?.start_date || mergedArgs.start_date || "none"}" itemsCount=${validation.normalized?.items?.length || mergedArgs.items?.length || 0} unknownDrinksCount=${validation.normalized?.unknown_drinks?.length || 0} isValid=${validation.isValid}`
              );

              if (validation.isValid && validation.normalized) {
                const duplicateCheck = await checkDuplicateSalesSession(
                  this.supabaseAdmin,
                  validation.normalized.modality,
                  validation.normalized.start_date
                );

                const preview = formatSalesSessionWhatsAppPreview(
                  validation.normalized,
                  validation.warnings,
                  duplicateCheck.isDuplicate
                );

                const pending = await this.conversationManager.savePendingAction(
                  conversation.id,
                  toolName,
                  validation.normalized,
                  [],
                  preview,
                  "ready_for_confirmation"
                );

                finalPendingAction = pending;
                finalReply = preview;
                hasPendingOrBreak = true;
                break;
              } else if (validation.missingFields.length > 0) {
                const pending = await this.conversationManager.savePendingAction(
                  conversation.id,
                  toolName,
                  mergedArgs,
                  validation.missingFields,
                  `Coletando campos faltantes: ${validation.missingFields.join(", ")}`,
                  "collecting"
                );
                finalPendingAction = pending;

                const missingDescriptions: string[] = [];
                if (validation.missingFields.includes("unit_name")) missingDescriptions.push("a unidade ('7 Steak House' ou 'Goat Botequim')");
                if (validation.missingFields.includes("start_date")) missingDescriptions.push("a data da operação");
                if (validation.missingFields.includes("items")) missingDescriptions.push("a lista ou foto dos drinks vendidos");

                finalReply = `Identifiquei os dados da sessão, mas ainda preciso de: ${missingDescriptions.join(" e ")}. Pode informar?`;
                hasPendingOrBreak = true;
                break;
              } else {
                finalReply = validation.errors.join("\n") || "Dados da sessão inconsistentes. Por favor, revise as informações.";
                hasPendingOrBreak = true;
                break;
              }
            }

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
              finalReply = response.text || summary;
              hasPendingOrBreak = true;
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
              finalReply = response.text || `Identifiquei os dados da operação, mas ainda preciso de: ${missing.join(", ")}. Pode informar?`;
              hasPendingOrBreak = true;
              break;
            }
          }

          // Execute read tool
          const toolResult = await this.toolRegistry.executeTool(toolName, args, {
            ...context,
            correlationId,
            toolCallId: toolCall.id,
          });
          executedToolNamesSet.add(toolExecKey);
          toolsExecuted.push({
            toolName,
            arguments: args,
            result: toolResult.data,
            status: toolResult.success ? "success" : "error",
          });

          // Append assistant toolCall and user toolResult to canonical messages
          normalizedMessages.push({
            role: "assistant",
            content: response.text,
            toolCalls: [toolCall],
          });

          normalizedMessages.push({
            role: "tool",
            toolCallId: toolCall.id,
            toolName,
            toolResult: toolResult.success ? (toolResult.data ?? {}) : { error: toolResult.error || "Erro na ferramenta" },
          });
        }

        if (hasPendingOrBreak) {
          break;
        }
      } else {
        // Model provided final text response
        finalReply = response.text || "Entendido.";
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
      pendingAction: finalPendingAction
        ? {
            id: finalPendingAction.id,
            toolName: finalPendingAction.tool_name || (finalPendingAction as any).toolName,
            status: finalPendingAction.status,
            missingFields: finalPendingAction.missing_fields || (finalPendingAction as any).missingFields || [],
            summary: finalPendingAction.summary,
          }
        : null,
    };
  }
}

export { GoatAIGeminiAgent as GoatAIAgent };
