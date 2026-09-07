import { describe, expect, it, vi } from "vitest";
import {
  NEW_BUDGET_NOTIFICATION_RECIPIENTS,
  notifyNewBudgetRequest,
  type NotificationDependencies,
} from "./notifier";

const makeDeps = (sent = true) => {
  const deps: NotificationDependencies = {
    claim: vi.fn().mockResolvedValue({ id: "notification-1" }),
    loadEvent: vi
      .fn()
      .mockResolvedValue({
        client_name: "Mariana",
        phone: "31999999999",
        date: "2027-05-20",
        event_type: "Casamento",
        guests: 100,
      }),
    recipients: vi.fn().mockResolvedValue([
      { phone_number: "+5511999999999" },
    ]),
    send: vi.fn().mockResolvedValue(sent),
    finish: vi.fn().mockResolvedValue(undefined),
    eventUrl: (id) => `https://goatbar.com.br/eventos/${id}`,
  };
  return deps;
};

describe("notifyNewBudgetRequest", () => {
  it("envia somente para a allowlist fixa aprovada", async () => {
    const deps = makeDeps();

    expect(NEW_BUDGET_NOTIFICATION_RECIPIENTS).toEqual([
      "+5531996970935",
      "+5537999985192",
    ]);
    expect(await notifyNewBudgetRequest("event-1", deps)).toBe("SENT");

    expect(deps.recipients).not.toHaveBeenCalled();
    expect(deps.send).toHaveBeenCalledTimes(2);
    expect(deps.send).toHaveBeenNthCalledWith(
      1,
      "5531996970935",
      expect.arrayContaining([
        "Mariana",
        "Casamento",
        "2027-05-20",
        "100",
        "31999999999",
      ]),
      "budget_event-1",
    );
    expect(deps.send).toHaveBeenNthCalledWith(
      2,
      "5537999985192",
      expect.any(Array),
      "budget_event-1",
    );
    expect(deps.finish).toHaveBeenCalledWith("notification-1", true);
  });

  it("não envia nem carrega o evento quando o claim idempotente recusa", async () => {
    const deps = makeDeps();
    (deps.claim as any).mockResolvedValue(null);

    expect(await notifyNewBudgetRequest("event-1", deps)).toBe("SKIPPED");
    expect(deps.loadEvent).not.toHaveBeenCalled();
    expect(deps.send).not.toHaveBeenCalled();
  });

  it("finaliza FAILED quando a Meta rejeita o envio", async () => {
    const deps = makeDeps(false);

    expect(await notifyNewBudgetRequest("event-1", deps)).toBe("FAILED");
    expect(deps.finish).toHaveBeenCalledWith(
      "notification-1",
      false,
      expect.stringContaining("Meta WhatsApp API"),
    );
  });

  it("preserva retry de FAILED", async () => {
    const deps = makeDeps(false);

    expect(await notifyNewBudgetRequest("event-1", deps)).toBe("FAILED");
    (deps.send as any).mockResolvedValue(true);
    expect(await notifyNewBudgetRequest("event-1", deps, true)).toBe("SENT");
    expect(deps.claim).toHaveBeenLastCalledWith("event-1", true);
  });
});
