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
  };
  return deps;
};

describe("notifyNewBudgetRequest", () => {
  it("envia e persiste SENT", async () => {
    const deps = makeDeps();
    expect(await notifyNewBudgetRequest("event-1", deps)).toBe("SENT");
    expect(deps.send).toHaveBeenCalledOnce();
    expect(deps.finish).toHaveBeenCalledWith("link-1", true);
  });
  it("finaliza FAILED quando não há destinatário", async () => {
    const deps = makeDeps([]);
    expect(await notifyNewBudgetRequest("event-1", deps)).toBe("FAILED");
    expect(deps.finish).toHaveBeenCalledWith("link-1", false, expect.stringContaining("Nenhum"));
  });
  it("preserva erro do envio e permite retry de FAILED", async () => {
    const deps = makeDeps(undefined, false);
    expect(await notifyNewBudgetRequest("event-1", deps)).toBe("FAILED");
    (deps.send as any).mockResolvedValue(true);
    expect(await notifyNewBudgetRequest("event-1", deps, true)).toBe("SENT");
    expect(deps.claim).toHaveBeenLastCalledWith("event-1", true);
  });
  it("não envia quando o claim recusa USED/SENT", async () => {
    const deps = makeDeps();
    (deps.claim as any).mockResolvedValue(null);
    expect(await notifyNewBudgetRequest("event-1", deps)).toBe("SKIPPED");
    expect(deps.send).not.toHaveBeenCalled();
  });
});
