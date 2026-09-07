import { describe, expect, it, vi } from "vitest";
import { notifyNewBudgetRequest, type NotificationDependencies } from "./notifier";

const makeDeps = (recipients = [{ phone_number: "(31) 99999-9999" }], sent = true) => {
  const deps: NotificationDependencies = {
    claim: vi.fn().mockResolvedValue({ id: "link-1" }),
    loadEvent: vi
      .fn()
      .mockResolvedValue({
        client_name: "Mariana",
        phone: "31999999999",
        date: "2027-05-20",
        event_type: "Casamento",
        guests: 100,
      }),
    recipients: vi.fn().mockResolvedValue(recipients),
    send: vi.fn().mockResolvedValue(sent),
    finish: vi.fn().mockResolvedValue(undefined),
    eventUrl: (id) => `https://goatbar.com.br/eventos/${id}`,
    notifyInternal: vi.fn().mockResolvedValue(true),
  };
  return deps;
};

describe("notifyNewBudgetRequest", () => {
  it("envia e persiste SENT, incluindo notificação interna para GIA e painel", async () => {
    const deps = makeDeps();
    expect(await notifyNewBudgetRequest("event-1", deps)).toBe("SENT");
    expect(deps.notifyInternal).toHaveBeenCalledOnce();
    expect(deps.notifyInternal).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "event-1",
        client_name: "Mariana",
        phone: "31999999999",
        date: "2027-05-20",
        event_type: "Casamento",
        guests: 100,
      }),
      "https://goatbar.com.br/eventos/event-1",
    );
    expect(deps.send).toHaveBeenCalledOnce();
    expect(deps.send).toHaveBeenCalledWith("5531999999999", expect.arrayContaining(["Mariana", "Casamento", "2027-05-20", "100", "31999999999"]), "budget_event-1");
    expect(deps.finish).toHaveBeenCalledWith("link-1", true);
  });

  it("não envia nem carrega o evento quando o claim idempotente recusa", async () => {
    const deps = makeDeps();
    (deps.claim as any).mockResolvedValue(null);
    await notifyNewBudgetRequest("event-1", deps);
    expect(deps.loadEvent).not.toHaveBeenCalled();
    expect(deps.notifyInternal).not.toHaveBeenCalled();
    expect(deps.send).not.toHaveBeenCalled();
  });

  it("garante notificação interna mesmo quando não há destinatários de WhatsApp", async () => {
    const deps = makeDeps([]);
    expect(await notifyNewBudgetRequest("event-1", deps)).toBe("FAILED");
    expect(deps.notifyInternal).toHaveBeenCalledOnce();
    expect(deps.finish).toHaveBeenCalledWith("link-1", false, expect.stringContaining("Nenhum"));
  });

  it("preserva erro do envio e permite retry de FAILED sem duplicar se idempotente", async () => {
    const deps = makeDeps(undefined, false);
    expect(await notifyNewBudgetRequest("event-1", deps)).toBe("FAILED");
    expect(deps.notifyInternal).toHaveBeenCalledOnce();

    (deps.send as any).mockResolvedValue(true);
    expect(await notifyNewBudgetRequest("event-1", deps, true)).toBe("SENT");
    expect(deps.claim).toHaveBeenLastCalledWith("event-1", true);
  });

  it("não envia quando o claim recusa USED/SENT", async () => {
    const deps = makeDeps();
    (deps.claim as any).mockResolvedValue(null);
    expect(await notifyNewBudgetRequest("event-1", deps)).toBe("SKIPPED");
    expect(deps.notifyInternal).not.toHaveBeenCalled();
    expect(deps.send).not.toHaveBeenCalled();
  });
});
