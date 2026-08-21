import { CircuitState, ProviderError } from "./types.ts";

export interface CircuitRecord {
  providerId: string;
  state: CircuitState;
  consecutiveFailures: number;
  openedAt?: number;
  cooldownUntil?: number;
  lastFailureReason?: string;
  lastStatusCode?: number;
}

export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager;
  private l1Cache: Map<string, CircuitRecord> = new Map();
  private supabaseAdmin: any = null;

  constructor(supabaseAdmin?: any) {
    this.supabaseAdmin = supabaseAdmin;
  }

  public static getInstance(supabaseAdmin?: any): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager(supabaseAdmin);
    } else if (supabaseAdmin && !CircuitBreakerManager.instance.supabaseAdmin) {
      CircuitBreakerManager.instance.supabaseAdmin = supabaseAdmin;
    }
    return CircuitBreakerManager.instance;
  }

  public setSupabaseAdmin(admin: any) {
    this.supabaseAdmin = admin;
  }

  public getRecord(providerId: string): CircuitRecord {
    let rec = this.l1Cache.get(providerId);
    if (!rec) {
      rec = {
        providerId,
        state: "closed",
        consecutiveFailures: 0,
      };
      this.l1Cache.set(providerId, rec);
    }
    return rec;
  }

  public isAvailable(providerId: string): { available: boolean; state: CircuitState; reason?: string } {
    const rec = this.getRecord(providerId);
    const now = Date.now();

    if (rec.state === "open") {
      if (rec.cooldownUntil && now >= rec.cooldownUntil) {
        // Transition to half_open
        rec.state = "half_open";
        console.log(`[GOAT-AI][CIRCUIT][HALF_OPEN] provider=${providerId} cooldownExpiredAt=${new Date(now).toISOString()}`);
        this.persistRecord(rec).catch(() => {});
        return { available: true, state: "half_open" };
      }
      const remainingSec = Math.ceil(((rec.cooldownUntil || now) - now) / 1000);
      return {
        available: false,
        state: "open",
        reason: `Circuit open (cooldown: ${remainingSec}s remaining, reason: ${rec.lastFailureReason || "errors"})`,
      };
    }

    return { available: true, state: rec.state };
  }

  public recordSuccess(providerId: string) {
    const rec = this.getRecord(providerId);
    const prevState = rec.state;
    rec.state = "closed";
    rec.consecutiveFailures = 0;
    rec.cooldownUntil = undefined;
    rec.lastFailureReason = undefined;
    rec.lastStatusCode = undefined;

    if (prevState !== "closed") {
      console.log(`[GOAT-AI][CIRCUIT][CLOSED] provider=${providerId} prevState=${prevState}`);
    }

    this.persistRecord(rec).catch(() => {});
  }

  public recordFailure(providerId: string, error: ProviderError) {
    const rec = this.getRecord(providerId);
    rec.consecutiveFailures += 1;
    rec.lastFailureReason = error.message;
    rec.lastStatusCode = error.status;
    const now = Date.now();

    let cooldownDurationMs = 60_000; // default 60s

    if (error.retryAfterSeconds && error.retryAfterSeconds > 0) {
      cooldownDurationMs = error.retryAfterSeconds * 1000;
    } else if (error.type === "auth_invalid" || error.status === 401) {
      // Invalid API Key - open circuit indefinitely / 24h
      cooldownDurationMs = 24 * 60 * 60 * 1000;
    } else if (error.type === "quota_exhausted" || error.type === "capacity_exhausted" || error.type === "free_variant_ended") {
      // Free quota exhausted
      cooldownDurationMs = 5 * 60 * 1000; // 5 min cooldown
    } else if (error.type === "timeout") {
      cooldownDurationMs = 30_000; // 30s cooldown
    } else if (rec.consecutiveFailures >= 3) {
      cooldownDurationMs = Math.min(300_000, 30_000 * Math.pow(2, rec.consecutiveFailures - 3));
    }

    rec.state = "open";
    rec.openedAt = now;
    rec.cooldownUntil = now + cooldownDurationMs;

    console.warn(
      `[GOAT-AI][CIRCUIT][OPEN] provider=${providerId} status=${error.status || 0} errorType=${error.type} cooldownSec=${Math.ceil(cooldownDurationMs / 1000)} consecutiveFailures=${rec.consecutiveFailures} reason="${error.message.slice(0, 100)}"`
    );

    this.persistRecord(rec).catch(() => {});
  }

  public reset(providerId?: string) {
    if (providerId) {
      this.l1Cache.delete(providerId);
    } else {
      this.l1Cache.clear();
    }
  }

  private async persistRecord(rec: CircuitRecord) {
    if (!this.supabaseAdmin || typeof this.supabaseAdmin.from !== "function") {
      return;
    }

    try {
      const table = this.supabaseAdmin.from("ai_circuit_breakers");
      if (table && typeof table.upsert === "function") {
        await table.upsert(
          {
            provider_id: rec.providerId,
            state: rec.state,
            consecutive_failures: rec.consecutiveFailures,
            opened_at: rec.openedAt ? new Date(rec.openedAt).toISOString() : null,
            cooldown_until: rec.cooldownUntil ? new Date(rec.cooldownUntil).toISOString() : null,
            last_failure_reason: rec.lastFailureReason ? rec.lastFailureReason.slice(0, 500) : null,
            last_status_code: rec.lastStatusCode || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "provider_id" }
        );
      }
    } catch (err: any) {
      // Non-blocking failure for telemetry/L2 persist
      console.warn(`[GOAT-AI][CIRCUIT] Failed to persist circuit breaker state to DB: ${err?.message}`);
    }
  }
}
