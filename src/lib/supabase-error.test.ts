import { describe, expect, it, vi } from "vitest";
import { formatSupabaseError, getSupabaseErrorDetails, logSupabaseError } from "./supabase-error";

describe("Supabase error diagnostics", () => {
  it("preserves every PostgREST error field", () => {
    const error = {
      code: "23514",
      message: "new row violates check constraint",
      details: "Failing row contains a USED request without event_id",
      hint: "Inspect budget_request_used_consistency",
      status: 409,
    };

    expect(getSupabaseErrorDetails(error)).toEqual(error);
    expect(formatSupabaseError(error)).toBe(
      "[23514] — new row violates check constraint — Failing row contains a USED request without event_id — Dica: Inspect budget_request_used_consistency",
    );
  });

  it("logs structured diagnostics rather than hiding the original object", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = { code: "23503", message: "foreign key violation", details: "dependent row" };

    logSupabaseError("delete failed", error);

    expect(consoleError).toHaveBeenCalledWith("delete failed", {
      code: "23503",
      message: "foreign key violation",
      details: "dependent row",
      hint: undefined,
      status: undefined,
      error,
    });
    consoleError.mockRestore();
  });
});
