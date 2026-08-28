import { GoatAIToolDefinition, ToolContext, ToolExecutionResult } from "../types.ts";
import { resolveBusinessUnit } from "../matchers/unit-matcher.ts";
import {
  searchEventsTool,
  getEventDetailsTool,
  searchEventsByGuestCountTool,
  aggregateEventConsumptionTool,
} from "./definitions/events.ts";
import {
  createSalesSessionTool,
  getSalesSessionsTool,
  createControladoriaExpenseTool,
  createControllerEntryTool,
  searchControllerEntriesTool,
  createEventPurchaseTool,
  getFinancialSummaryTool,
} from "./definitions/financial.ts";
import { upsertDrinkAliasTool } from "./definitions/drink-aliases.ts";
import { getDrinksCatalogTool } from "./definitions/drinks.ts";
import { createBudgetRequestLinkTool } from "./definitions/budget-request.ts";

function sanitizeToolArguments(args: any): string {
  if (!args || typeof args !== "object") return String(args ?? "");
  const copy = { ...args };
  for (const k of Object.keys(copy)) {
    if (/token|secret|password|key|auth|credential/i.test(k)) {
      copy[k] = "[REDACTED]";
    }
  }
  return JSON.stringify(copy);
}

function extractResultCount(resultData: any): number {
  if (!resultData) return 0;
  if (typeof resultData.count === "number") return resultData.count;
  if (Array.isArray(resultData.sessions)) return resultData.sessions.length;
  if (Array.isArray(resultData.events)) return resultData.events.length;
  if (Array.isArray(resultData.entries)) return resultData.entries.length;
  if (Array.isArray(resultData)) return resultData.length;
  return 1;
}

export class GoatAIToolRegistry {
  private tools: Map<string, GoatAIToolDefinition> = new Map();

  constructor() {
    this.register(searchEventsTool);
    this.register(getEventDetailsTool);
    this.register(searchEventsByGuestCountTool);
    this.register(aggregateEventConsumptionTool);
    this.register(createSalesSessionTool);
    this.register(getSalesSessionsTool);
    this.register(createControladoriaExpenseTool);
    this.register(createControllerEntryTool);
    this.register(searchControllerEntriesTool);
    this.register(createEventPurchaseTool);
    this.register(getFinancialSummaryTool);
    this.register(upsertDrinkAliasTool);
    this.register(getDrinksCatalogTool);
    this.register(createBudgetRequestLinkTool);
  }

  public register(tool: GoatAIToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  public getTool(name: string): GoatAIToolDefinition | undefined {
    return this.tools.get(name);
  }

  public listTools(): GoatAIToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public getGeminiFunctionDeclarations(): Array<{
    name: string;
    description: string;
    parameters: any;
  }> {
    return this.listTools().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  public async executeTool(
    toolName: string,
    args: any,
    context: ToolContext,
  ): Promise<ToolExecutionResult> {
    const tool = this.getTool(toolName);
    const correlationId = context.correlationId || "none";
    const toolCallId = context.toolCallId || "none";

    if (!tool) {
      console.error(
        `[GOAT-AI][TOOL][ERROR] correlationId=${correlationId} toolName=${toolName} toolCallId=${toolCallId} errorType="ToolNotFound" message="Ferramenta '${toolName}' não existe ou não está registrada."`,
      );
      return {
        success: false,
        error: `Ferramenta '${toolName}' não existe ou não está registrada.`,
      };
    }

    const rawUnit = args?.unit_name || args?.modality || args?.unit;
    const unitRes = rawUnit ? resolveBusinessUnit(rawUnit) : null;
    const businessUnit = rawUnit ? String(rawUnit) : "all";
    const canonicalBusinessUnit = unitRes ? unitRes.canonicalName : "all";
    const sanitizedArgs = sanitizeToolArguments(args || {});

    console.log(
      `[GOAT-AI][TOOL][CALL] correlationId=${correlationId} toolName=${toolName} toolCallId=${toolCallId} businessUnit="${businessUnit}" canonicalBusinessUnit="${canonicalBusinessUnit}" argumentsSanitized=${sanitizedArgs}`,
    );

    const startTime = Date.now();
    try {
      const result = await tool.execute(context, args || {});
      const duration = Date.now() - startTime;
      const resultCount = extractResultCount(result.data);
      const resultSummary = (
        result.message || (result.success ? "Execução com sucesso" : result.error || "Erro")
      ).slice(0, 150);

      console.log(
        `[GOAT-AI][TOOL][RESULT] correlationId=${correlationId} toolName=${toolName} toolCallId=${toolCallId} source="${tool.sourceTable || "supabase"}" success=${result.success} resultCount=${resultCount} durationMs=${duration} resultSummary="${resultSummary}"`,
      );

      // Audit log in ai_tool_calls
      if (context.supabaseAdmin?.from && context.conversationId) {
        try {
          const auditBuilder = context.supabaseAdmin.from("ai_tool_calls");
          if (typeof auditBuilder?.insert === "function") {
            await auditBuilder.insert({
              conversation_id: context.conversationId,
              tool_name: toolName,
              arguments: args || {},
              result: result.data || null,
              status: result.success ? "success" : "error",
              error: result.error || null,
              duration_ms: duration,
              performed_by: context.userId || null,
              started_at: new Date(startTime).toISOString(),
              finished_at: new Date().toISOString(),
            });
          }
        } catch {
          // tool execution result preserved even if audit logging fails
        }
      }

      return result;
    } catch (err: any) {
      const duration = Date.now() - startTime;
      const errMsg = err?.message || String(err);
      const errType = err?.name || "ExecutionError";

      console.error(
        `[GOAT-AI][TOOL][ERROR] correlationId=${correlationId} toolName=${toolName} toolCallId=${toolCallId} errorType="${errType}" message="${errMsg}"`,
      );

      if (context.supabaseAdmin?.from && context.conversationId) {
        await context.supabaseAdmin.from("ai_tool_calls").insert({
          conversation_id: context.conversationId,
          tool_name: toolName,
          arguments: args || {},
          status: "error",
          error: errMsg,
          duration_ms: duration,
          performed_by: context.userId || null,
          started_at: new Date(startTime).toISOString(),
          finished_at: new Date().toISOString(),
        });
      }
      return {
        success: false,
        error: `Erro na execução da ferramenta ${toolName}: ${errMsg}`,
      };
    }
  }
}

export const defaultToolRegistry = new GoatAIToolRegistry();
