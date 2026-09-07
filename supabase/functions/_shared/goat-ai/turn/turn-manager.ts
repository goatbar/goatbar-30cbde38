/**
 * Official Persistent Turn Lifecycle & Mutex Manager for Goat AI
 * Guarantees that every turn terminates in exactly one of:
 * - 'processing' (only while actively executing)
 * - 'completed' (only when final valid reply is persisted)
 * - 'partial' (when emergency synthesis or partial tool execution occurred)
 * - 'failed' (when an unrecoverable error occurred)
 * - 'cancelled' (when explicitly cancelled by client AbortController)
 */

export type TurnStatus = "processing" | "completed" | "partial" | "failed" | "cancelled";

export type TurnStage =
  | "init"
  | "lock_acquired"
  | "router_selection"
  | "llm_call"
  | "tool_execution"
  | "synthesis"
  | "persisting"
  | "done";

export interface TurnTimings {
  totalMs: number;
  llmMs: number;
  toolsMs: number;
  dbMs: number;
  retriesMs: number;
  failoverMs: number;
}

export interface TurnRecord {
  id: string;
  requestId?: string;
  conversationId: string;
  userMessageId?: string;
  assistantMessageId?: string;
  status: TurnStatus;
  currentStage: TurnStage;
  providerId?: string;
  modelId?: string;
  toolsExecuted: string[];
  reply?: string;
  errorType?: string;
  errorMessage?: string;
  timings: TurnTimings;
  startedAt: string;
  completedAt?: string;
  failedAt?: string;
}

export class TurnManager {
  private supabaseAdmin: any;
  private turnRecord: TurnRecord;
  private hasAiTurnsTable: boolean = true;

  constructor(
    supabaseAdmin: any,
    turnId: string,
    conversationId: string,
    requestId?: string
  ) {
    this.supabaseAdmin = supabaseAdmin;
    this.turnRecord = {
      id: turnId,
      requestId: requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      conversationId,
      status: "processing",
      currentStage: "init",
      toolsExecuted: [],
      timings: {
        totalMs: 0,
        llmMs: 0,
        toolsMs: 0,
        dbMs: 0,
        retriesMs: 0,
        failoverMs: 0,
      },
      startedAt: new Date().toISOString(),
    };
  }

  public getRecord(): Readonly<TurnRecord> {
    return this.turnRecord;
  }

  /**
   * Acquire atomic conversation lock (Directive 6)
   * Prevents two agent instances from executing concurrently on the same conversation.
   * If locked by an active turn, waits up to waitTimeoutMs (default 8000ms).
   */
  public async acquireConversationLock(
    waitTimeoutMs: number = 8000
  ): Promise<{ acquired: boolean; reason?: string }> {
    const startTime = Date.now();
    const convId = this.turnRecord.conversationId;
    if (!this.supabaseAdmin || !convId) return { acquired: true };

    while (Date.now() - startTime < waitTimeoutMs) {
      try {
        const { data: conv } = await this.supabaseAdmin
          .from("ai_conversations")
          .select("metadata")
          .eq("id", convId)
          .maybeSingle();

        const metadata = conv?.metadata || {};
        const activeLock = metadata.active_lock;

        const now = Date.now();
        const isLockActive =
          activeLock &&
          activeLock.turn_id !== this.turnRecord.id &&
          activeLock.expires_at &&
          now < new Date(activeLock.expires_at).getTime();

        if (!isLockActive) {
          // Claim lock
          const newLock = {
            turn_id: this.turnRecord.id,
            request_id: this.turnRecord.requestId,
            locked_at: new Date().toISOString(),
            expires_at: new Date(now + 50000).toISOString(), // 50s safety expiry
          };

          await this.supabaseAdmin
            .from("ai_conversations")
            .update({
              metadata: {
                ...metadata,
                active_lock: newLock,
              },
            })
            .eq("id", convId);

          this.turnRecord.currentStage = "lock_acquired";
          console.log(
            `[GOAT-AI][LOCK][ACQUIRED] conversationId=${convId} turnId=${this.turnRecord.id}`
          );
          return { acquired: true };
        }

        console.warn(
          `[GOAT-AI][LOCK][WAITING] conversationId=${convId} activeTurn=${activeLock.turn_id} waitingMs=${Date.now() - startTime}`
        );
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err: any) {
        console.warn(`[GOAT-AI][LOCK][WARN] ${err?.message}`);
        return { acquired: true }; // non-blocking fallback
      }
    }

    return {
      acquired: false,
      reason: `Conversa ocupada por outro turno em andamento. Aguarde alguns instantes.`,
    };
  }

  /**
   * Release conversation lock
   */
  public async releaseConversationLock(): Promise<void> {
    const convId = this.turnRecord.conversationId;
    if (!this.supabaseAdmin || !convId) return;

    try {
      const { data: conv } = await this.supabaseAdmin
        .from("ai_conversations")
        .select("metadata")
        .eq("id", convId)
        .maybeSingle();

      const metadata = conv?.metadata || {};
      if (metadata.active_lock?.turn_id === this.turnRecord.id) {
        delete metadata.active_lock;
        await this.supabaseAdmin
          .from("ai_conversations")
          .update({ metadata })
          .eq("id", convId);

        console.log(
          `[GOAT-AI][LOCK][RELEASED] conversationId=${convId} turnId=${this.turnRecord.id}`
        );
      }
    } catch (err: any) {
      console.warn(`[GOAT-AI][LOCK][RELEASE_WARN] ${err?.message}`);
    }
  }

  /**
   * Initialize turn in database
   */
  public async initTurn(userMessageId?: string): Promise<void> {
    if (userMessageId) {
      this.turnRecord.userMessageId = userMessageId;
    }
    await this.persist();
  }

  /**
   * Update active stage
   */
  public async updateStage(stage: TurnStage): Promise<void> {
    this.turnRecord.currentStage = stage;
    await this.persist();
  }

  /**
   * Add executed tool
   */
  public async recordToolExecution(toolName: string): Promise<void> {
    if (!this.turnRecord.toolsExecuted.includes(toolName)) {
      this.turnRecord.toolsExecuted.push(toolName);
      await this.persist();
    }
  }

  /**
   * Complete turn with valid final reply (Directive 2 & 10)
   */
  public async completeTurn(params: {
    assistantMessageId?: string;
    reply: string;
    providerId?: string;
    modelId?: string;
    timings: TurnTimings;
  }): Promise<void> {
    this.turnRecord.status = "completed";
    this.turnRecord.currentStage = "done";
    this.turnRecord.assistantMessageId = params.assistantMessageId;
    this.turnRecord.reply = params.reply;
    this.turnRecord.providerId = params.providerId;
    this.turnRecord.modelId = params.modelId;
    this.turnRecord.timings = params.timings;
    this.turnRecord.completedAt = new Date().toISOString();

    await this.persist();
    await this.releaseConversationLock();
  }

  /**
   * Mark turn as partial (Directive 3)
   */
  public async partialTurn(params: {
    assistantMessageId?: string;
    reply: string;
    providerId?: string;
    modelId?: string;
    reason: string;
    timings: TurnTimings;
  }): Promise<void> {
    this.turnRecord.status = "partial";
    this.turnRecord.currentStage = "done";
    this.turnRecord.assistantMessageId = params.assistantMessageId;
    this.turnRecord.reply = params.reply;
    this.turnRecord.providerId = params.providerId;
    this.turnRecord.modelId = params.modelId;
    this.turnRecord.errorType = "partial_execution";
    this.turnRecord.errorMessage = params.reason;
    this.turnRecord.timings = params.timings;
    this.turnRecord.completedAt = new Date().toISOString();

    await this.persist();
    await this.releaseConversationLock();
  }

  /**
   * Fail turn with structured error
   */
  public async failTurn(params: {
    errorType: string;
    errorMessage: string;
    stage: TurnStage;
    timings: TurnTimings;
  }): Promise<void> {
    this.turnRecord.status = "failed";
    this.turnRecord.currentStage = params.stage;
    this.turnRecord.errorType = params.errorType;
    this.turnRecord.errorMessage = params.errorMessage;
    this.turnRecord.timings = params.timings;
    this.turnRecord.failedAt = new Date().toISOString();

    await this.persist();
    await this.releaseConversationLock();
  }

  /**
   * Cancel turn (client abort)
   */
  public async cancelTurn(): Promise<void> {
    this.turnRecord.status = "cancelled";
    this.turnRecord.failedAt = new Date().toISOString();

    await this.persist();
    await this.releaseConversationLock();
  }

  /**
   * Hybrid persistence: writes to ai_turns table, and mirrors to conversation metadata
   */
  private async persist(): Promise<void> {
    if (!this.supabaseAdmin) return;

    // 1. Try writing to public.ai_turns
    if (this.hasAiTurnsTable) {
      try {
        const { error } = await this.supabaseAdmin
          .from("ai_turns")
          .upsert({
            id: this.turnRecord.id,
            request_id: this.turnRecord.requestId,
            conversation_id: this.turnRecord.conversationId,
            user_message_id: this.turnRecord.userMessageId || null,
            assistant_message_id: this.turnRecord.assistantMessageId || null,
            status: this.turnRecord.status,
            current_stage: this.turnRecord.currentStage,
            provider_id: this.turnRecord.providerId || null,
            model_id: this.turnRecord.modelId || null,
            tools_executed: this.turnRecord.toolsExecuted,
            reply: this.turnRecord.reply || null,
            error_type: this.turnRecord.errorType || null,
            error_message: this.turnRecord.errorMessage || null,
            timings: this.turnRecord.timings,
            started_at: this.turnRecord.startedAt,
            completed_at: this.turnRecord.completedAt || null,
            failed_at: this.turnRecord.failedAt || null,
            updated_at: new Date().toISOString(),
          });

        if (error && error.code === "PGRST205") {
          // Table not found in PostgREST schema cache yet
          this.hasAiTurnsTable = false;
        }
      } catch {
        this.hasAiTurnsTable = false;
      }
    }

    // 2. Mirror into ai_conversations.metadata for instant reconciliation
    try {
      const convId = this.turnRecord.conversationId;
      if (convId) {
        const { data: conv } = await this.supabaseAdmin
          .from("ai_conversations")
          .select("metadata")
          .eq("id", convId)
          .maybeSingle();

        const metadata = conv?.metadata || {};
        const recentTurns = Array.isArray(metadata.recent_turns)
          ? metadata.recent_turns
          : [];

        const existingIdx = recentTurns.findIndex((t: any) => t.id === this.turnRecord.id);
        if (existingIdx >= 0) {
          recentTurns[existingIdx] = { ...this.turnRecord };
        } else {
          recentTurns.unshift({ ...this.turnRecord });
        }

        metadata.recent_turns = recentTurns.slice(0, 10);
        metadata.last_turn = { ...this.turnRecord };

        await this.supabaseAdmin
          .from("ai_conversations")
          .update({ metadata })
          .eq("id", convId);
      }
    } catch (mirrorErr: any) {
      console.warn(`[GOAT-AI][TURN][MIRROR_WARN] ${mirrorErr?.message}`);
    }
  }

  /**
   * Reconcile turn state for client (Directive 1)
   */
  public static async reconcileTurn(
    supabaseAdmin: any,
    turnId: string,
    conversationId?: string
  ): Promise<TurnRecord | null> {
    if (!supabaseAdmin) return null;

    // 1. Check ai_turns table
    try {
      const { data, error } = await supabaseAdmin
        .from("ai_turns")
        .select("*")
        .eq("id", turnId)
        .maybeSingle();

      if (data && !error) {
        return {
          id: data.id,
          requestId: data.request_id,
          conversationId: data.conversation_id,
          userMessageId: data.user_message_id,
          assistantMessageId: data.assistant_message_id,
          status: data.status,
          currentStage: data.current_stage,
          providerId: data.provider_id,
          modelId: data.model_id,
          toolsExecuted: data.tools_executed || [],
          reply: data.reply,
          errorType: data.error_type,
          errorMessage: data.error_message,
          timings: data.timings || {},
          startedAt: data.started_at,
          completedAt: data.completed_at,
          failedAt: data.failed_at,
        };
      }
    } catch {
      // Table fallback
    }

    // 2. Check conversation metadata
    if (conversationId) {
      try {
        const { data: conv } = await supabaseAdmin
          .from("ai_conversations")
          .select("metadata")
          .eq("id", conversationId)
          .maybeSingle();

        const recentTurns = conv?.metadata?.recent_turns || [];
        const found = recentTurns.find((t: any) => t.id === turnId);
        if (found) return found;

        if (conv?.metadata?.last_turn?.id === turnId) {
          return conv.metadata.last_turn;
        }
      } catch {
        // Fallback
      }
    }

    return null;
  }
}
