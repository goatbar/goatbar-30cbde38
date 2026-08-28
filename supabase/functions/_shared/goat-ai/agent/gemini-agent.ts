import {
  AgentInput,
  AgentTurnResponse,
  ContextualEvent,
  PrivacyClassification,
  ToolContext,
} from "../types.ts";
import { matchContextualEventReference } from "../matchers/event-matcher.ts";
import { GOAT_AI_CONVERSATIONAL_SYSTEM_PROMPT } from "../prompts/system.ts";
import { ConversationManager } from "../conversation/manager.ts";
import { defaultToolRegistry, GoatAIToolRegistry } from "../tools/registry.ts";
import { getEnv, getGeminiModel } from "../config.ts";
import {
  validateSalesSessionData,
  validateSalesSessionDraft,
  checkDuplicateSalesSession,
  formatSalesSessionWhatsAppPreview,
  extractLaborIntent,
  normalizeDayKey,
  normalizeDate,
  SalesSessionDraft,
} from "../validators/sales-session-validator.ts";
import {
  validateControladoriaExpenseDraft,
  formatControladoriaExpenseWhatsAppPreview,
  ControladoriaExpenseDraft,
  normalizeControladoriaModality,
  normalizeCurrencyBRL,
} from "../validators/controladoria-expense-validator.ts";
import { resolveBusinessUnit } from "../matchers/unit-matcher.ts";
import {
  loadDrinkCatalogAndAliases,
  parseDrinkMatchInstructions,
  learnDrinkAlias,
  resolveDrinkMatch,
  resolveDrinkCommercialData,
  toCanonicalBusinessUnitId,
} from "../matchers/drink-matcher.ts";
import { AIRouter } from "../router/ai-router.ts";
import { NormalizedAIRequest, NormalizedMessage } from "../router/types.ts";
import { CircuitBreakerManager } from "../router/circuit-breaker.ts";
import {
  formatConfirmedEventsReply,
  resolveExplicitConfirmedEventsIntent,
  toContextualEvent,
} from "../events/confirmed-events.ts";
import { resolveBudgetRequestLinkIntent } from "../events/budget-request-intent.ts";

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

function maskPhone(phone?: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 6) return phone;
  return digits.slice(0, 4) + "*".repeat(Math.max(2, digits.length - 8)) + digits.slice(-4);
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
    router?: AIRouter,
  ) {
    this.supabaseAdmin = supabaseAdmin;
    this.apiKey =
      apiKey !== undefined
        ? apiKey
        : getEnv("GEMINI_API_KEY") || getEnv("GOOGLE_AI_API_KEY") || getEnv("GOOGLE_API_KEY");
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
    const correlationId =
      input.correlationId || `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const turnStartTime = Date.now();

    const externalConvIdentifier =
      input.conversationId ||
      input.externalSenderId ||
      (input.channel === "whatsapp" && input.userId ? `wa_user_${input.userId}` : undefined);

    const conversation = await this.conversationManager.getOrCreateConversation(
      input.channel,
      input.userId,
      externalConvIdentifier,
      input.message.slice(0, 40) || "Conversa com a GIA",
    );

    console.log(`[GOAT-AI][CONVERSATION][CONVERSATION_LOADED] correlationId=${correlationId} conversationId=${conversation.id} channel=${input.channel} userId=${input.userId || "anonymous"}`);

    const context: ToolContext = {
      supabaseAdmin: this.supabaseAdmin,
      userId: input.userId,
      userName: input.userName || "Usuário",
      userRole: input.userRole || "socio",
      conversationId: conversation.id,
      channel: input.channel,
      correlationId,
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
      input.userName,
    );

    console.log(
      `[GOAT-AI][CONVERSATION] correlationId=${correlationId} conversationId=${conversation.id} userMessageId=${userMessage.id} messageType=${messageType}`,
    );

    // A URL real nunca é inventada pelo provider: frases explícitas passam
    // diretamente pela tool determinística e auditável.
    const budgetLinkIntent = resolveBudgetRequestLinkIntent(input.message);
    if (budgetLinkIntent.matched) {
      const args = budgetLinkIntent.customerNameHint
        ? { customer_name_hint: budgetLinkIntent.customerNameHint }
        : {};
      const result = await this.toolRegistry.executeTool("create_budget_request_link", args, {
        ...context,
        toolCallId: `${correlationId}_budget_request_link`,
      });
      const reply = result.success
        ? result.message!
        : `Não foi possível criar o link: ${result.error || "erro desconhecido"}.`;
      const assistantMsg = await this.conversationManager.saveMessage(
        conversation.id,
        "assistant",
        reply,
        result.success ? "action_result" : "text",
      );
      return {
        conversationId: conversation.id,
        messageId: assistantMsg.id,
        reply,
        toolCallsExecuted: [
          {
            toolName: "create_budget_request_link",
            arguments: args,
            result: result.data,
            status: result.success ? "success" : "error",
          },
        ],
        pendingAction: null,
      };
    }

    // Current-turn deterministic read intent. This deliberately runs before
    // provider/history processing so Gemini cannot inherit a previous query,
    // reinterpret "confirmados", or inject a silent result limit.
    const confirmedIntent = resolveExplicitConfirmedEventsIntent(input.message);
    if (confirmedIntent.matched) {
      const args = {
        status: "confirmed",
        query: "confirmados",
        ...(confirmedIntent.limit ? { limit: confirmedIntent.limit } : {}),
      };
      const result = await this.toolRegistry.executeTool("search_events", args, {
        ...context,
        toolCallId: `${correlationId}_confirmed_events`,
      });
      const events = result.success && Array.isArray(result.data?.events) ? result.data.events : [];
      if (events.length > 0) {
        await this.conversationManager.saveRecentEvents(
          conversation.id,
          events.map(toContextualEvent),
          events.map((event: any) => event.id),
        );
      }
      const reply = result.success
        ? formatConfirmedEventsReply(events)
        : `Não foi possível consultar os eventos confirmados: ${result.error || "erro desconhecido"}.`;
      const assistantMsg = await this.conversationManager.saveMessage(
        conversation.id,
        "assistant",
        reply,
        "text",
      );
      return {
        conversationId: conversation.id,
        messageId: assistantMsg.id,
        reply,
        toolCallsExecuted: [
          {
            toolName: "search_events",
            arguments: args,
            result: result.data,
            status: result.success ? "success" : "error",
          },
        ],
        pendingAction: null,
      };
    }

    // Check for missing API Key if no providers are available
    const availableProviders = this.router.getProviders().filter((p) => p.isAvailable().available);
    if (availableProviders.length === 0 && !this.apiKey) {
      console.error(
        `[GOAT-AI][PROVIDER][ERROR] correlationId=${correlationId} provider=gemini model=${this.model} error="GEMINI_API_KEY ausente ou não configurada no runtime" geminiApiKeyConfigured=false`,
      );
      const unavailReply = "Integração Gemini não configurada (chave GEMINI_API_KEY ausente).";
      const assistantMsg = await this.conversationManager.saveMessage(
        conversation.id,
        "assistant",
        unavailReply,
        "text",
      );
      return {
        conversationId: conversation.id,
        messageId: assistantMsg.id,
        reply: unavailReply,
        toolCallsExecuted: [],
      };
    }

    // 2. Deterministic State Machine / Confirmation Resolver against active pending actions
    const activePending = await this.conversationManager.getActivePendingAction(conversation.id);
    const maskedSender = maskPhone(input.externalSenderId || conversation.external_conversation_id);

    if (activePending && activePending.status === "ready_for_confirmation") {
      if (this.conversationManager.isConfirmationIntent(input.message)) {
        console.log(
          `[GOAT-AI][CONFIRMATION_RESOLVER] correlationId=${correlationId} conversationId=${conversation.id} phone=${maskedSender} pendingAction=${activePending.tool_name} pendingStatus=${activePending.status} decision=CONFIRM`,
        );

        // Execute deterministic tool using EXCLUSIVELY the approved structured arguments
        const execResult = await this.conversationManager.executePendingAction(
          activePending,
          context,
        );
        let confirmationReply = "";

        if (execResult.success) {
          console.log(
            `[GOAT-AI][CONFIRMATION_EXECUTION] correlationId=${correlationId} conversationId=${conversation.id} phone=${maskedSender} toolName=${activePending.tool_name} success=true`,
          );
          confirmationReply =
            execResult.message ||
            `Operação '${activePending.tool_name}' confirmada e executada com sucesso no sistema.`;
        } else {
          console.error(
            `[GOAT-AI][CONFIRMATION_EXECUTION] correlationId=${correlationId} conversationId=${conversation.id} phone=${maskedSender} toolName=${activePending.tool_name} success=false error="${execResult.error || "unknown"}"`,
          );
          confirmationReply = `Não foi possível concluir a operação: ${execResult.error || "Erro desconhecido"}. Os dados continuam salvos para nova tentativa.`;
        }

        const assistantMsg = await this.conversationManager.saveMessage(
          conversation.id,
          "assistant",
          confirmationReply,
          "action_result",
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
          pendingAction: execResult.success
            ? null
            : {
                id: activePending.id,
                toolName: activePending.tool_name,
                status: "ready_for_confirmation",
                missingFields: [],
                summary: activePending.summary,
              },
        };
      } else if (this.conversationManager.isRejectionIntent(input.message)) {
        console.log(
          `[GOAT-AI][CONFIRMATION_RESOLVER] correlationId=${correlationId} conversationId=${conversation.id} phone=${maskedSender} pendingAction=${activePending.tool_name} pendingStatus=${activePending.status} decision=REJECT`,
        );

        await this.supabaseAdmin
          .from("ai_pending_actions")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", activePending.id);

        const cancelReply = "Operação cancelada. Como posso ajudar com outra tarefa?";
        const assistantMsg = await this.conversationManager.saveMessage(
          conversation.id,
          "assistant",
          cancelReply,
          "text",
        );

        return {
          conversationId: conversation.id,
          messageId: assistantMsg.id,
          reply: cancelReply,
          toolCallsExecuted: [],
          pendingAction: null,
        };
      } else {
        console.log(
          `[GOAT-AI][CONFIRMATION_RESOLVER] correlationId=${correlationId} conversationId=${conversation.id} phone=${maskedSender} pendingAction=${activePending.tool_name} pendingStatus=${activePending.status} decision=INTERMEDIATE_OR_MODIFICATION`,
        );
      }
    }

    // 2.1 Check for Sales Session Direct Modifications (e.g. updating labor_value / Mão de Obra Semanal / Por Dia)
    if (activePending && activePending.tool_name === "create_sales_session") {
      const draftArgs = { ...(activePending.arguments || {}) };
      const laborIntent = extractLaborIntent(
        input.message,
        draftArgs.unit_name || draftArgs.modality,
      );
      if (laborIntent.isLabor && laborIntent.amount) {
        if (laborIntent.isDaily) {
          const existingDetails = Array.isArray(draftArgs.labor_details)
            ? [...draftArgs.labor_details]
            : [];

          for (const newDay of laborIntent.dailyDetails) {
            const normNewDay = normalizeDayKey(newDay.dia) || newDay.dia;
            const idx = existingDetails.findIndex(
              (d: any) => (normalizeDayKey(d.dia) || d.dia) === normNewDay,
            );
            if (idx >= 0) {
              existingDetails[idx] = {
                ...existingDetails[idx],
                dia: normNewDay,
                valor: newDay.valor,
              };
            } else {
              existingDetails.push({ dia: normNewDay, valor: newDay.valor });
            }
          }

          draftArgs.labor_details = existingDetails;
          draftArgs.labor_value = existingDetails.reduce(
            (acc: number, d: any) => acc + (Number(d.valor) || 0),
            0,
          );
        } else {
          draftArgs.labor_value = laborIntent.amount;
          draftArgs.labor_details = [];
        }

        if (laborIntent.isSteakhouse) {
          draftArgs.unit_name = "7 Steak House";
          draftArgs.modality = "7Steakhouse";
        }
        let catalog: any[] = [];
        let aliases: any[] = [];
        try {
          const loaded = await loadDrinkCatalogAndAliases(this.supabaseAdmin, draftArgs.unit_name);
          catalog = loaded.catalog;
          aliases = loaded.aliases;
        } catch {}

        const validation = validateSalesSessionDraft(draftArgs, catalog, aliases);
        if (validation.isValid && validation.normalized) {
          const duplicateCheck = await checkDuplicateSalesSession(
            this.supabaseAdmin,
            validation.normalized.modality,
            validation.normalized.start_date,
          );

          const preview = formatSalesSessionWhatsAppPreview(
            validation.normalized,
            validation.warnings,
            duplicateCheck.isDuplicate,
          );

          const finalPending = await this.conversationManager.savePendingAction(
            conversation.id,
            activePending.tool_name,
            validation.normalized,
            [],
            preview,
            "ready_for_confirmation",
          );

          const assistantMsg = await this.conversationManager.saveMessage(
            conversation.id,
            "assistant",
            preview,
            "text",
          );

          return {
            conversationId: conversation.id,
            messageId: assistantMsg.id,
            reply: preview,
            toolCallsExecuted: [],
            pendingAction: {
              id: finalPending.id,
              toolName: finalPending.tool_name,
              status: finalPending.status,
              missingFields: [],
              summary: finalPending.summary,
            },
          };
        }
      }
    }

    // 2.2 Check for Controladoria Direct Modifications (unit selection or amount correction on active pending action)
    if (
      activePending &&
      (activePending.tool_name === "create_controladoria_expense" ||
        activePending.tool_name === "create_controller_entry")
    ) {
      const draftArgs = { ...(activePending.arguments || {}) };
      let draftModified = false;

      const normalizedInput = input.message
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

      // Check if user is supplying modality
      const modRes = normalizeControladoriaModality(input.message);
      if (modRes.matched) {
        draftArgs.modality = modRes.displayName;
        draftModified = true;
      }

      // Check if user is supplying labor
      const laborIntent = extractLaborIntent(input.message, draftArgs.modality);
      if (laborIntent.isLabor && laborIntent.amount) {
        draftArgs.amount = laborIntent.amount;
        draftArgs.category = "Equipe";
        if (
          laborIntent.isSteakhouse ||
          draftArgs.modality === "Steakhouse" ||
          draftArgs.modality === "7 Steakhouse"
        ) {
          draftArgs.description = "Mão de Obra Semanal";
        }
        draftModified = true;
      }

      // Check if user is supplying/correcting amount
      const amountMatch = normalizedInput.match(
        /(?:o\s+)?valor(?:\s+correto)?(?:\s+e|\s+foi|\s*=\s*)?\s*(?:r\$)?\s*(\d+[\.,]\d{2})/i,
      );
      if (amountMatch) {
        draftArgs.amount = normalizeCurrencyBRL(amountMatch[1]);
        draftModified = true;
      } else if (activePending.missing_fields?.includes("amount")) {
        const rawNum = normalizeCurrencyBRL(input.message);
        if (rawNum > 0) {
          draftArgs.amount = rawNum;
          draftModified = true;
        }
      }

      if (draftModified) {
        const validation = validateControladoriaExpenseDraft(draftArgs, {
          fallbackResponsible: input.userName || "Sócio Goat Bar",
        });

        if (validation.isValid && validation.normalized) {
          const preview = formatControladoriaExpenseWhatsAppPreview(
            validation.normalized,
            validation.warnings,
          );

          const finalPending = await this.conversationManager.savePendingAction(
            conversation.id,
            activePending.tool_name,
            validation.normalized,
            [],
            preview,
            "ready_for_confirmation",
          );

          const assistantMsg = await this.conversationManager.saveMessage(
            conversation.id,
            "assistant",
            preview,
            "text",
          );

          return {
            conversationId: conversation.id,
            messageId: assistantMsg.id,
            reply: preview,
            toolCallsExecuted: [],
            pendingAction: {
              id: finalPending.id,
              toolName: finalPending.tool_name,
              status: finalPending.status,
              missingFields: [],
              summary: finalPending.summary,
            },
          };
        } else if (validation.missingFields.length > 0) {
          const finalPending = await this.conversationManager.savePendingAction(
            conversation.id,
            activePending.tool_name,
            draftArgs,
            validation.missingFields,
            `Coletando campos faltantes: ${validation.missingFields.join(", ")}`,
            "collecting",
          );

          let reply = "";
          if (validation.missingFields.includes("modality")) {
            reply = `Em qual unidade devo lançar esse gasto? ('7 Steakhouse', 'Goat Botequim', 'Evento' ou 'Geral')`;
          } else if (validation.missingFields.includes("amount")) {
            reply = `Qual o valor total da nota/gasto?`;
          } else {
            reply = `Ainda preciso de: ${validation.missingFields.join(" e ")}. Pode informar?`;
          }

          const assistantMsg = await this.conversationManager.saveMessage(
            conversation.id,
            "assistant",
            reply,
            "text",
          );

          return {
            conversationId: conversation.id,
            messageId: assistantMsg.id,
            reply,
            toolCallsExecuted: [],
            pendingAction: {
              id: finalPending.id,
              toolName: finalPending.tool_name,
              status: finalPending.status,
              missingFields: finalPending.missing_fields,
              summary: finalPending.summary,
            },
          };
        }
      }
    }

    // 3. Check for Explicit Drink Match Instructions ("Spritz Veneziano = Aperol", etc.)
    const parsedMatches = parseDrinkMatchInstructions(input.message);
    if (parsedMatches.length > 0) {
      const pendingUnit = activePending?.arguments?.unit_name || activePending?.arguments?.modality;
      const targetUnitId = toCanonicalBusinessUnitId(pendingUnit);

      const applied: any[] = [];
      const conflicts: any[] = [];
      const failed: any[] = [];
      const ambiguous: any[] = [];
      const toolCallsExecuted: any[] = [];

      for (const m of parsedMatches) {
        const learnResult = await learnDrinkAlias({
          supabaseAdmin: this.supabaseAdmin,
          alias: m.alias,
          targetDrinkName: m.targetDrinkName,
          businessUnit: targetUnitId,
          userId: input.userId,
          performerName: input.userName || "Usuário",
          userRole: input.userRole,
          source: "chat",
        });

        if (
          learnResult.status === "CREATED" ||
          learnResult.status === "UPDATED" ||
          learnResult.status === "IDEMPOTENT"
        ) {
          applied.push(learnResult);
          toolCallsExecuted.push({
            toolName: "upsert_drink_alias",
            arguments: {
              alias: m.alias,
              target_drink: m.targetDrinkName,
              business_unit: targetUnitId,
            },
            result: learnResult,
            status: "success",
          });
        } else if (learnResult.status === "ALIAS_CONFLICT") {
          conflicts.push(learnResult);
        } else if (learnResult.status === "AMBIGUOUS") {
          ambiguous.push(learnResult);
        } else {
          failed.push(learnResult);
        }
      }

      // If we have an active pending draft for create_sales_session, reprocess it immediately
      if (activePending && activePending.tool_name === "create_sales_session") {
        const { catalog, aliases } = await loadDrinkCatalogAndAliases(
          this.supabaseAdmin,
          targetUnitId,
        );
        const draftArgs = { ...(activePending.arguments || {}) };
        const rawItems = draftArgs.items || [];

        const updatedItems = rawItems.map((it: any) => {
          const rawName = it.rawName || it.name;
          const match = resolveDrinkMatch({
            inputName: rawName,
            businessUnit: draftArgs.modality || draftArgs.unit_name || targetUnitId,
            catalog,
            aliases,
            source: "reprocess_draft",
          });

          if (match.matched && match.drink) {
            const comm = resolveDrinkCommercialData(
              match.drink,
              draftArgs.modality || draftArgs.unit_name || targetUnitId,
            );
            const unitPrice =
              it.unit_price != null && it.unit_price > 0 && !it.isUnknown
                ? it.unit_price
                : comm.unitPrice;
            const unitCost =
              it.unit_cost != null && it.unit_cost > 0 && !it.isUnknown
                ? it.unit_cost
                : comm.unitCost;
            const ingredientCost =
              it.ingredient_cost != null && it.ingredient_cost > 0 && !it.isUnknown
                ? it.ingredient_cost
                : comm.ingredientCost;
            return {
              rawName,
              name: match.canonicalDrinkName || it.name,
              quantity: it.quantity,
              unit_price: unitPrice,
              unit_cost: unitCost,
              ingredient_cost: ingredientCost,
              total_price: Math.round(it.quantity * unitPrice * 100) / 100,
              drink_id: match.drinkId,
              isUnknown: false,
              matchType: match.matchType,
            };
          }

          return it;
        });

        draftArgs.items = updatedItems;
        const validation = validateSalesSessionDraft(draftArgs, catalog, aliases);

        let finalPendingAction: any = activePending;
        let preview = "";

        if (validation.isValid && validation.normalized) {
          const duplicateCheck = await checkDuplicateSalesSession(
            this.supabaseAdmin,
            validation.normalized.modality,
            validation.normalized.start_date,
          );

          preview = formatSalesSessionWhatsAppPreview(
            validation.normalized,
            validation.warnings,
            duplicateCheck.isDuplicate,
          );

          finalPendingAction = await this.conversationManager.updatePendingActionArgs(
            activePending.id,
            validation.normalized,
            [],
            preview,
          );
        }

        const replyLines: string[] = [];
        if (applied.length > 0) {
          replyLines.push(`✅ *Vínculos aprendidos:*`);
          applied.forEach((a) => replyLines.push(`• *${a.alias}* → ${a.targetDrinkName}`));
        }
        if (conflicts.length > 0) {
          replyLines.push(``);
          replyLines.push(`⚠️ *Conflito de mapeamento:*`);
          conflicts.forEach((c) =>
            replyLines.push(
              `• *${c.alias}* já aponta para '${c.currentTarget}'. Para alterar para '${c.requestedTarget}', confirme a substituição.`,
            ),
          );
        }
        if (failed.length > 0) {
          replyLines.push(``);
          replyLines.push(`⚠️ *Drinks não localizados no catálogo:*`);
          failed.forEach((f) =>
            replyLines.push(
              `• *${f.alias}*: drink '${f.targetDrinkName}' não existe no catálogo oficial.`,
            ),
          );
        }
        if (ambiguous.length > 0) {
          replyLines.push(``);
          replyLines.push(`⚠️ *Múltiplos drinks compatíveis:*`);
          ambiguous.forEach((amb) =>
            replyLines.push(`• *${amb.alias}*: compatível com [${amb.candidates?.join(", ")}].`),
          );
        }

        if (preview) {
          replyLines.push(``);
          replyLines.push(preview);
        }

        const finalReply = replyLines.join("\n");
        const assistantMsg = await this.conversationManager.saveMessage(
          conversation.id,
          "assistant",
          finalReply,
          "text",
        );

        return {
          conversationId: conversation.id,
          messageId: assistantMsg.id,
          reply: finalReply,
          toolCallsExecuted,
          pendingAction: finalPendingAction
            ? {
                id: finalPendingAction.id,
                toolName: finalPendingAction.tool_name || (finalPendingAction as any).toolName,
                status: finalPendingAction.status,
                missingFields:
                  finalPendingAction.missing_fields ||
                  (finalPendingAction as any).missingFields ||
                  [],
                summary: finalPendingAction.summary,
              }
            : null,
        };
      } else {
        // No pending sales session action: simply confirm learned aliases
        const replyLines: string[] = [];
        if (applied.length > 0) {
          replyLines.push(`✅ *Vínculos aprendidos com sucesso:*`);
          applied.forEach((a) => replyLines.push(`• *${a.alias}* → ${a.targetDrinkName}`));
        }
        if (conflicts.length > 0) {
          replyLines.push(``);
          replyLines.push(`⚠️ *Conflito de mapeamento:*`);
          conflicts.forEach((c) =>
            replyLines.push(
              `• *${c.alias}* já aponta para '${c.currentTarget}'. Para alterar para '${c.requestedTarget}', confirme a substituição.`,
            ),
          );
        }
        if (failed.length > 0) {
          replyLines.push(``);
          replyLines.push(`⚠️ *Drinks não localizados no catálogo:*`);
          failed.forEach((f) =>
            replyLines.push(
              `• *${f.alias}*: drink '${f.targetDrinkName}' não existe no catálogo oficial.`,
            ),
          );
        }
        if (ambiguous.length > 0) {
          replyLines.push(``);
          replyLines.push(`⚠️ *Múltiplos drinks compatíveis:*`);
          ambiguous.forEach((amb) =>
            replyLines.push(`• *${amb.alias}*: compatível com [${amb.candidates?.join(", ")}].`),
          );
        }

        const finalReply = replyLines.join("\n") || "Nenhum vínculo pôde ser processado.";
        const assistantMsg = await this.conversationManager.saveMessage(
          conversation.id,
          "assistant",
          finalReply,
          "text",
        );

        return {
          conversationId: conversation.id,
          messageId: assistantMsg.id,
          reply: finalReply,
          toolCallsExecuted,
          pendingAction: null,
        };
      }
    }

    // 4. Prepare Canonical Multi-turn Messages
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

    // 3.1 Contextual Event Reference Resolution against Recent Entities
    const recentEntities = await this.conversationManager.getRecentEntities(conversation.id);
    const contextualEventMatch = matchContextualEventReference(input.message, recentEntities);

    if (contextualEventMatch.matched && contextualEventMatch.eventId) {
      await this.conversationManager.setLastFocusedEvent(
        conversation.id,
        contextualEventMatch.eventId,
      );
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

    // 3.2 Check for Direct Labor Launch in 7 Steak House session (Deterministic Resolution)
    const laborIntent = extractLaborIntent(input.message, inheritedUnit);
    const isExplicitControladoria = input.message.toLowerCase().includes("controladoria");

    if (
      laborIntent.isLabor &&
      laborIntent.isSteakhouse &&
      laborIntent.amount &&
      !isExplicitControladoria
    ) {
      const today = new Date().toISOString().split("T")[0];
      // Try to extract a date from the message; fall back to today
      const dateFromMsg = (input.message.match(/\b(\d{1,2}[\\/\-]\d{1,2}(?:[\\/\-]\d{2,4})?)\b/) ||
        [])[1];
      const startDate = (dateFromMsg ? normalizeDate(dateFromMsg) : null) || today;
      const draftArgs: SalesSessionDraft = {
        unit_name: "7 Steak House",
        canonical_unit: "7Steakhouse",
        start_date: startDate,
        labor_value: laborIntent.amount,
        labor_details: laborIntent.isDaily ? laborIntent.dailyDetails : [],
        items: [],
      };

      const validation = validateSalesSessionDraft(draftArgs);
      if (validation.isValid && validation.normalized) {
        const duplicateCheck = await checkDuplicateSalesSession(
          this.supabaseAdmin,
          validation.normalized.modality,
          validation.normalized.start_date,
        );

        const preview = formatSalesSessionWhatsAppPreview(
          validation.normalized,
          validation.warnings,
          duplicateCheck.isDuplicate,
        );

        const pending = await this.conversationManager.savePendingAction(
          conversation.id,
          "create_sales_session",
          validation.normalized,
          [],
          preview,
          "ready_for_confirmation",
        );

        const assistantMsg = await this.conversationManager.saveMessage(
          conversation.id,
          "assistant",
          preview,
          "text",
        );

        return {
          conversationId: conversation.id,
          messageId: assistantMsg.id,
          reply: preview,
          toolCallsExecuted: [],
          pendingAction: {
            id: pending.id,
            toolName: pending.tool_name,
            status: pending.status,
            missingFields: [],
            summary: pending.summary,
          },
        };
      }
    }

    // Contextual instruction if pending action was collecting missing fields, unit was resolved, or entities are present
    let userPromptText = input.message;

    if (recentEntities.events && recentEntities.events.length > 0) {
      const formattedRecent = recentEntities.events
        .slice(0, 8)
        .map(
          (ev, i) =>
            `${i + 1}. ID: '${ev.eventId}' | Cliente: '${ev.clientName || "N/A"}' | Evento: '${ev.eventName || ev.clientName || "N/A"}' | Data: '${ev.date || "N/A"}' | Local/Cidade: '${ev.city || ev.location || "N/A"}' | Status: '${ev.status || "N/A"}'`,
        )
        .join("\n");

      userPromptText += `\n\n[CONTEXTO OPERACIONAL - EVENTOS RECENTEMENTE APRESENTADOS NA CONVERSA:\n${formattedRecent}\n]`;
    }

    if (contextualEventMatch.matched && contextualEventMatch.event) {
      const fEv = contextualEventMatch.event;
      userPromptText += `\n\n[CONTEXTO OPERACIONAL - EVENTO EM FOCO RESOLVIDO]:
• ID: '${contextualEventMatch.eventId}'
• Cliente: '${fEv.clientName || ""}'
• Evento: '${fEv.eventName || fEv.clientName || ""}'
• Data: '${fEv.date || ""}'
• Local: '${fEv.city || fEv.location || ""}'
• Status: '${fEv.status || ""}'
INSTRUÇÃO OBRIGATÓRIA: Para consultar drinks/cardápio, orçamento, dados gerais, local ou convidados deste evento, chame a ferramenta 'get_event_details' passando event_id: '${contextualEventMatch.eventId}'. NUNCA faça nova busca textual genérica por nome no banco de dados.`;
    } else if (
      contextualEventMatch.ambiguous &&
      contextualEventMatch.candidates &&
      contextualEventMatch.candidates.length > 1
    ) {
      userPromptText += `\n\n[CONTEXTO OPERACIONAL - AMBIGUIDADE DE EVENTOS]:\n${contextualEventMatch.disambiguationMessage}\nPeça a confirmação do usuário apresentando educadamente as opções identificadas.`;
    }

    if (activePending && activePending.status === "collecting") {
      userPromptText += `\n[CONTEXTO OPERACIONAL: Há uma ação em andamento '${activePending.tool_name}' com dados já preenchidos: ${JSON.stringify(activePending.arguments)}. Campos pendentes necessários: [${activePending.missing_fields.join(", ")}]. Use os novos dados da mensagem para preencher os campos e acionar a ferramenta correspondente.]`;
    } else if (activePending && activePending.status === "ready_for_confirmation") {
      userPromptText += `\n[CONTEXTO OPERACIONAL: Há uma ação '${activePending.tool_name}' aguardando confirmação do usuário com os dados: ${JSON.stringify(activePending.arguments)}. Se o usuário estiver fazendo uma pergunta ou pedindo um detalhe, responda mantendo a confirmação pendente. Se o usuário estiver corrigindo, alterando ou adicionando dados (ex: quantidade de drinks, datas, valores), chame a ferramenta '${activePending.tool_name}' com os dados completos atualizados/mesclados para gerar um novo preview atualizado.]`;
    } else if (
      inheritedUnit &&
      !input.message.toLowerCase().includes("steak") &&
      !input.message.toLowerCase().includes("botequim")
    ) {
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
          `[GOAT-AI][ROUTER][PROVIDER_SWITCH] correlationId=${correlationId} fromProvider=${lastActiveProvider} toProvider=${response.providerId} reason="mid_turn_switch" toolsAlreadyExecuted=${Array.from(executedToolNamesSet).join(",")} turnStep=${turnCount}`,
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
              const priorArgs =
                activePending &&
                (activePending.status === "collecting" ||
                  activePending.status === "ready_for_confirmation")
                  ? activePending.arguments || {}
                  : {};
              const mergedArgs = { ...priorArgs, ...args };

              if (!mergedArgs.unit_name && inheritedUnit) {
                mergedArgs.unit_name = inheritedUnit;
              }

              // Fetch drinks catalog & aliases for validation & price resolution
              let catalog: any[] = [];
              let aliases: any[] = [];
              try {
                const loaded = await loadDrinkCatalogAndAliases(
                  this.supabaseAdmin,
                  mergedArgs.unit_name,
                );
                catalog = loaded.catalog;
                aliases = loaded.aliases;
              } catch {
                // catalog optional
              }

              const validation = validateSalesSessionDraft(mergedArgs, catalog, aliases);

              console.log(
                `[GOAT-AI][SALES_DRAFT][EXTRACTED] correlationId=${correlationId} unit="${validation.normalized?.unit_name || mergedArgs.unit_name || "none"}" date="${validation.normalized?.start_date || mergedArgs.start_date || "none"}" itemsCount=${validation.normalized?.items?.length || mergedArgs.items?.length || 0} unknownDrinksCount=${validation.normalized?.unknown_drinks?.length || 0} isValid=${validation.isValid}`,
              );

              if (validation.isValid && validation.normalized) {
                const duplicateCheck = await checkDuplicateSalesSession(
                  this.supabaseAdmin,
                  validation.normalized.modality,
                  validation.normalized.start_date,
                );

                const preview = formatSalesSessionWhatsAppPreview(
                  validation.normalized,
                  validation.warnings,
                  duplicateCheck.isDuplicate,
                );

                const pending = await this.conversationManager.savePendingAction(
                  conversation.id,
                  toolName,
                  validation.normalized,
                  [],
                  preview,
                  "ready_for_confirmation",
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
                  "collecting",
                );
                finalPendingAction = pending;

                const missingDescriptions: string[] = [];
                if (validation.missingFields.includes("unit_name"))
                  missingDescriptions.push("a unidade ('7 Steak House' ou 'Goat Botequim')");
                if (validation.missingFields.includes("start_date"))
                  missingDescriptions.push("a data da operação");
                if (validation.missingFields.includes("items"))
                  missingDescriptions.push("a lista ou foto dos drinks vendidos");

                finalReply = `Identifiquei os dados da sessão, mas ainda preciso de: ${missingDescriptions.join(" e ")}. Pode informar?`;
                hasPendingOrBreak = true;
                break;
              } else {
                finalReply =
                  validation.errors.join("\n") ||
                  "Dados da sessão inconsistentes. Por favor, revise as informações.";
                hasPendingOrBreak = true;
                break;
              }
            }

            if (
              toolName === "create_controladoria_expense" ||
              toolName === "create_controller_entry"
            ) {
              const priorArgs =
                activePending &&
                (activePending.status === "collecting" ||
                  activePending.status === "ready_for_confirmation" ||
                  activePending.status === "awaiting_confirmation")
                  ? activePending.arguments || {}
                  : {};
              const mergedArgs: ControladoriaExpenseDraft = { ...priorArgs, ...args };

              if (!mergedArgs.modality && inheritedUnit) {
                mergedArgs.modality = inheritedUnit;
              }

              if (input.externalMessageId && !mergedArgs.source_message_id) {
                mergedArgs.source_message_id = input.externalMessageId;
              }

              const validation = validateControladoriaExpenseDraft(mergedArgs, {
                fallbackResponsible: input.userName || "Sócio Goat Bar",
              });

              console.log(
                `[GOAT-AI][CONTROLADORIA_DRAFT][EXTRACTED] correlationId=${correlationId} supplier="${validation.normalized?.supplier_name || mergedArgs.supplier_name || "none"}" amount=${validation.normalized?.amount || mergedArgs.amount || 0} date="${validation.normalized?.date || mergedArgs.date || "none"}" modality="${validation.normalized?.modality || mergedArgs.modality || "none"}" isValid=${validation.isValid} missing=[${validation.missingFields.join(",")}]`,
              );

              if (validation.isValid && validation.normalized) {
                const preview = formatControladoriaExpenseWhatsAppPreview(
                  validation.normalized,
                  validation.warnings,
                );

                const pending = await this.conversationManager.savePendingAction(
                  conversation.id,
                  toolName,
                  validation.normalized,
                  [],
                  preview,
                  "ready_for_confirmation",
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
                  "collecting",
                );
                finalPendingAction = pending;

                const supplierName = mergedArgs.supplier_name
                  ? `🏪 *Fornecedor:* ${mergedArgs.supplier_name}\n`
                  : "";
                const dateStr = mergedArgs.date ? `📅 *Data:* ${mergedArgs.date}\n` : "";
                const amountStr = mergedArgs.amount
                  ? `💰 *Valor:* R$ ${normalizeCurrencyBRL(mergedArgs.amount).toFixed(2).replace(".", ",")}\n`
                  : "";

                let missingQuestion = "";
                if (
                  validation.missingFields.includes("modality") &&
                  !validation.missingFields.includes("amount")
                ) {
                  missingQuestion = `Li a nota:\n${supplierName}${dateStr}${amountStr}\nEm qual unidade devo lançar esse gasto? ('7 Steakhouse', 'Goat Botequim', 'Evento' ou 'Geral')`;
                } else if (validation.missingFields.includes("amount")) {
                  missingQuestion = `Consegui receber a foto${mergedArgs.supplier_name ? ` de ${mergedArgs.supplier_name}` : ""}, mas não consegui identificar o valor da nota com segurança. Pode enviar uma foto mais próxima ou me informar o valor?`;
                } else {
                  missingQuestion = `Identifiquei os dados da nota, mas ainda preciso de: ${validation.missingFields.join(" e ")}. Pode informar?`;
                }

                finalReply = missingQuestion;
                hasPendingOrBreak = true;
                break;
              } else {
                finalReply =
                  validation.errors.join("\n") ||
                  "Não consegui extrair os dados da nota com clareza. Pode me informar o valor e a unidade?";
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
                "ready_for_confirmation",
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
                "collecting",
              );
              finalPendingAction = pending;
              finalReply =
                response.text ||
                `Identifiquei os dados da operação, mas ainda preciso de: ${missing.join(", ")}. Pode informar?`;
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

          // Persist contextual events when events tools execute
          if (toolResult.success && toolResult.data) {
            try {
              if (toolName === "search_events" || toolName === "search_events_by_guest_count") {
                const events = toolResult.data.events;
                if (Array.isArray(events) && events.length > 0) {
                  const contextualList: ContextualEvent[] = events.map((ev: any) => ({
                    eventId: ev.id || ev.eventId,
                    clientName: ev.client_name || ev.clientName,
                    eventName: ev.event_name || ev.eventName,
                    groomName: ev.groom_name || ev.groomName,
                    brideName: ev.bride_name || ev.brideName,
                    date: ev.date,
                    location: ev.event_location || ev.location,
                    city: ev.city,
                    guests: ev.guests,
                    status: ev.status,
                    currentBudgetValue: ev.current_budget_value || ev.currentBudgetValue,
                  }));
                  const presentedIds = contextualList.map((e) => e.eventId);
                  await this.conversationManager.saveRecentEvents(
                    conversation.id,
                    contextualList,
                    presentedIds,
                  );
                }
              } else if (toolName === "get_event_details") {
                const ev = toolResult.data.event;
                if (ev) {
                  const contextualEvent: ContextualEvent = {
                    eventId: ev.id || ev.eventId || args.event_id,
                    clientName: ev.client_name || ev.clientName,
                    eventName: ev.event_name || ev.eventName,
                    groomName: ev.groom_name || ev.groomName,
                    brideName: ev.bride_name || ev.brideName,
                    date: ev.date,
                    location: ev.event_location || ev.location,
                    city: ev.city,
                    guests: ev.guests,
                    status: ev.status,
                    currentBudgetValue: ev.current_budget_value || ev.currentBudgetValue,
                  };
                  await this.conversationManager.saveRecentEvents(conversation.id, [
                    contextualEvent,
                  ]);
                  await this.conversationManager.setLastFocusedEvent(
                    conversation.id,
                    contextualEvent.eventId,
                  );
                }
              }
            } catch (saveErr) {
              console.warn("[GOAT-AI][CONTEXTUAL_EVENTS_SAVE_WARN]", saveErr);
            }
          }

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
            toolResult: toolResult.success
              ? (toolResult.data ?? {})
              : { error: toolResult.error || "Erro na ferramenta" },
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
      "text",
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
            missingFields:
              finalPendingAction.missing_fields || (finalPendingAction as any).missingFields || [],
            summary: finalPendingAction.summary,
          }
        : activePending &&
            (activePending.status === "ready_for_confirmation" ||
              activePending.status === "collecting")
          ? {
              id: activePending.id,
              toolName: activePending.tool_name,
              status: activePending.status,
              missingFields: activePending.missing_fields || [],
              summary: activePending.summary,
            }
          : null,
    };
  }
}

export { GoatAIGeminiAgent as GoatAIAgent };
