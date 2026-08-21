import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConversationManager } from "../supabase/functions/_shared/goat-ai/conversation/manager";
import { GoatAIToolRegistry } from "../supabase/functions/_shared/goat-ai/tools/registry";

describe("Goat AI - Conversation Manager & Multi-turn Engine", () => {
  let mockSupabase: any;
  let toolRegistry: GoatAIToolRegistry;
  let manager: ConversationManager;

  beforeEach(() => {
    vi.restoreAllMocks();
    toolRegistry = new GoatAIToolRegistry();
    mockSupabase = {
      from: vi.fn(),
    };
    manager = new ConversationManager(mockSupabase, toolRegistry);
  });

  it("accurately detects confirmation and rejection intents", () => {
    expect(manager.isConfirmationIntent("sim")).toBe(true);
    expect(manager.isConfirmationIntent("SIM")).toBe(true);
    expect(manager.isConfirmationIntent("Sim, pode lançar")).toBe(true);
    expect(manager.isConfirmationIntent("confirmo")).toBe(true);
    expect(manager.isConfirmationIntent("autorizado")).toBe(true);

    expect(manager.isConfirmationIntent("Olá, tudo bem?")).toBe(false);
    expect(manager.isConfirmationIntent("Quanto custou?")).toBe(false);

    expect(manager.isRejectionIntent("não")).toBe(true);
    expect(manager.isRejectionIntent("cancelar")).toBe(true);
    expect(manager.isRejectionIntent("descarta")).toBe(true);
    expect(manager.isRejectionIntent("sim")).toBe(false);
  });

  it("resolves user from WhatsApp phone number if verified", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "user_messaging_accounts") {
        return {
          select: () => ({
            or: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { user_id: "user-123", display_name: "Jhansen Sócio", verified: true },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { display_name: "Jhansen Sócio", email: "jhansen@goatbar.com.br" },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const user = await manager.resolveUserByPhoneNumber("+5531999998888");
    expect(user).not.toBeNull();
    expect(user?.userId).toBe("user-123");
    expect(user?.name).toBe("Jhansen Sócio");
    expect(user?.authorized).toBe(true);
  });

  it("returns null if WhatsApp phone number is not found or not verified", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "user_messaging_accounts") {
        return {
          select: () => ({
            or: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const user = await manager.resolveUserByPhoneNumber("+5531000000000");
    expect(user).toBeNull();
  });

  it("creates and retrieves active pending actions", async () => {
    const mockPending = {
      id: "pending-1",
      conversation_id: "conv-1",
      tool_name: "create_sales_session",
      arguments: { unit_name: "7 Steak House", total_amount: 1539.5 },
      missing_fields: ["responsible"],
      status: "collecting",
      expires_at: new Date(Date.now() + 1000000).toISOString(),
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "ai_pending_actions") {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                gt: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: mockPending, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const active = await manager.getActivePendingAction("conv-1");
    expect(active).not.toBeNull();
    expect(active?.tool_name).toBe("create_sales_session");
    expect(active?.status).toBe("collecting");
    expect(active?.missing_fields).toContain("responsible");
  });
});
