import { describe, it, expect, vi } from "vitest";
import { notifyNewBudgetRequest, type NotificationDependencies } from "../supabase/functions/budget-request/notifier";

describe("Budget Request - GIA & Panel Notification Integration", () => {
  it("creates an internal system notification with full details for GIA and panel upon new budget request", async () => {
    let inboxStore: any[] = [];
    let actionLogs: any[] = [];

    const mockSupabaseAdmin: any = {
      from: vi.fn((table: string) => ({
        select: () => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => ({
              maybeSingle: async () => {
                const found = inboxStore.find(
                  (item) => item[col1] === val1 && item[col2] === val2
                );
                return { data: found || null, error: null };
              },
            }),
          }),
        }),
        insert: (row: any) => {
          if (table === "ai_inbox_items") {
            const newRow = { id: `inbox_${Date.now()}`, ...row };
            inboxStore.push(newRow);
            return {
              select: () => ({
                maybeSingle: async () => ({ data: newRow, error: null }),
                single: async () => ({ data: newRow, error: null }),
              }),
            };
          }
          if (table === "ai_action_logs") {
            actionLogs.push(row);
            return Promise.resolve({ data: row, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      })),
    };

    const mockEvent = {
      id: "ev-test-budget-1",
      client_name: "Larissa & Rodrigo",
      event_name: "Casamento Larissa & Rodrigo",
      event_type: "Casamento",
      date: "2027-11-15",
      guests: 180,
      phone: "(31) 98888-7777",
      email: "larissa@exemplo.com",
      event_location: "Espaço Província",
      city: "Nova Lima",
    };

    const notifyInternalImplementation = async (event: any, url?: string) => {
      const evId = event.id;
      const linkUrl = url || `https://www.goatbar.com.br/eventos/${evId}`;
      const sourceMsgId = `budget_request:${evId}`;

      // Idempotency: avoid duplicate notification if already created
      const { data: existing } = await mockSupabaseAdmin
        .from("ai_inbox_items")
        .select("id")
        .eq("source", "api")
        .eq("source_message_id", sourceMsgId)
        .maybeSingle();

      if (existing) {
        return true;
      }

      const rawText = `Novo pedido de orçamento recebido de ${event.client_name} para ${event.event_name || event.event_type} em ${event.date} (${event.guests} convidados). Telefone: ${event.phone || 'Não informado'}. ID: ${evId}. Link: ${linkUrl}`;

      const structuredData = {
        type: "new_budget_request",
        event_id: evId,
        client_name: event.client_name,
        event_name: event.event_name || event.event_type,
        event_type: event.event_type,
        date: event.date,
        guests: event.guests,
        phone: event.phone || null,
        email: event.email || null,
        event_location: event.event_location || null,
        city: event.city || null,
        event_url: linkUrl,
        origin: "public_budget_form",
        notified_at: new Date().toISOString(),
      };

      const { data: inboxItem } = await mockSupabaseAdmin
        .from("ai_inbox_items")
        .insert({
          source: "api",
          source_message_id: sourceMsgId,
          source_sender_name: event.client_name,
          source_sender_id: event.phone || null,
          message_type: "text",
          raw_text: rawText,
          classification: "event_note",
          classification_confidence: 1.0,
          processing_status: "processed",
          processing_mode: "heuristic",
          approval_status: "pending",
          matched_event_id: evId,
          structured_data: structuredData,
          received_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();

      if (inboxItem?.id) {
        await mockSupabaseAdmin.from("ai_action_logs").insert({
          ai_inbox_item_id: inboxItem.id,
          event_id: evId,
          action: "new_budget_request_notification",
          automatic: true,
          performer_name: "Sistema / Formulário Público",
          new_data: structuredData,
        });
      }

      return true;
    };

    const deps: NotificationDependencies = {
      claim: vi.fn().mockResolvedValue({ id: "link-123" }),
      loadEvent: vi.fn().mockResolvedValue(mockEvent),
      recipients: vi.fn().mockResolvedValue([]),
      send: vi.fn().mockResolvedValue(true),
      finish: vi.fn().mockResolvedValue(undefined),
      eventUrl: (id) => `https://www.goatbar.com.br/eventos/${id}`,
      notifyInternal: notifyInternalImplementation,
    };

    // 1. Initial Notification Run
    await notifyNewBudgetRequest("ev-test-budget-1", deps);

    // Invariant 1: Exactly one item inserted into ai_inbox_items
    expect(inboxStore.length).toBe(1);
    const notification = inboxStore[0];
    expect(notification.source).toBe("api");
    expect(notification.source_message_id).toBe("budget_request:ev-test-budget-1");
    expect(notification.matched_event_id).toBe("ev-test-budget-1");
    expect(notification.approval_status).toBe("pending");
    expect(notification.classification).toBe("event_note");

    // Invariant 2: Full details are present in structured_data
    expect(notification.structured_data.client_name).toBe("Larissa & Rodrigo");
    expect(notification.structured_data.event_type).toBe("Casamento");
    expect(notification.structured_data.date).toBe("2027-11-15");
    expect(notification.structured_data.guests).toBe(180);
    expect(notification.structured_data.phone).toBe("(31) 98888-7777");
    expect(notification.structured_data.event_id).toBe("ev-test-budget-1");
    expect(notification.structured_data.event_url).toBe("https://www.goatbar.com.br/eventos/ev-test-budget-1");

    // Invariant 3: Audit log created
    expect(actionLogs.length).toBe(1);
    expect(actionLogs[0].action).toBe("new_budget_request_notification");
    expect(actionLogs[0].event_id).toBe("ev-test-budget-1");

    // Invariant 4: IDEMPOTENCY on retry.
    // If the function is retried with the same event_id:
    await notifyInternalImplementation(mockEvent, "https://www.goatbar.com.br/eventos/ev-test-budget-1");

    // Must still be EXACTLY 1 item, no duplicate row created!
    expect(inboxStore.length).toBe(1);
    expect(actionLogs.length).toBe(1);

    // Invariant 5: Clean separation from ai_messages (never write to ai_messages)
    expect(mockSupabaseAdmin.from).not.toHaveBeenCalledWith("ai_messages");
  });
});
