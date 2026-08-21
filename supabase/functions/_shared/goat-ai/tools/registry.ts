import { GoatAIToolDefinition, ToolContext, ToolExecutionResult } from "../types.ts";
import {
  searchEventsTool,
  getEventDetailsTool,
  searchEventsByGuestCountTool,
  aggregateEventConsumptionTool,
} from "./definitions/events.ts";
import {
  createSalesSessionTool,
  getSalesSessionsTool,
  createControllerEntryTool,
  searchControllerEntriesTool,
  createEventPurchaseTool,
  getFinancialSummaryTool,
} from "./definitions/financial.ts";

export class GoatAIToolRegistry {
  private tools: Map<string, GoatAIToolDefinition> = new Map();

  constructor() {
    this.register(searchEventsTool);
    this.register(getEventDetailsTool);
    this.register(searchEventsByGuestCountTool);
    this.register(aggregateEventConsumptionTool);
    this.register(createSalesSessionTool);
    this.register(getSalesSessionsTool);
    this.register(createControllerEntryTool);
    this.register(searchControllerEntriesTool);
    this.register(createEventPurchaseTool);
    this.register(getFinancialSummaryTool);
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
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    const tool = this.getTool(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Ferramenta '${toolName}' não existe ou não está registrada.`,
      };
    }

    const startTime = Date.now();
    try {
      const result = await tool.execute(context, args || {});
      const duration = Date.now() - startTime;

      // Audit log in ai_tool_calls
      if (context.supabaseAdmin?.from && context.conversationId) {
        await context.supabaseAdmin.from("ai_tool_calls").insert({
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

      return result;
    } catch (err: any) {
      const duration = Date.now() - startTime;
      if (context.supabaseAdmin?.from && context.conversationId) {
        await context.supabaseAdmin.from("ai_tool_calls").insert({
          conversation_id: context.conversationId,
          tool_name: toolName,
          arguments: args || {},
          status: "error",
          error: err?.message || String(err),
          duration_ms: duration,
          performed_by: context.userId || null,
          started_at: new Date(startTime).toISOString(),
          finished_at: new Date().toISOString(),
        });
      }
      return {
        success: false,
        error: `Erro na execução da ferramenta ${toolName}: ${err?.message || String(err)}`,
      };
    }
  }
}

export const defaultToolRegistry = new GoatAIToolRegistry();
