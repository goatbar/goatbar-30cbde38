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

  it("garante notificação interna mesmo quando não há destinatários de WhatsApp e registra NO_RECIPIENTS", async () => {
    const deps = makeDeps([]);
    expect(await notifyNewBudgetRequest("event-1", deps)).toBe("FAILED");
    expect(deps.notifyInternal).toHaveBeenCalledOnce();
    expect(deps.finish).toHaveBeenCalledWith(
      "link-1",
      false,
      expect.stringContaining("NO_RECIPIENTS: Nenhum destinatário WhatsApp verificado"),
      "NO_RECIPIENTS",
    );
  });

  it("envia para múltiplos destinatários (ex: 2 sócios) e registra SENT apenas se todos passarem", async () => {
    const deps = makeDeps([
      { phone_number: "+55 (31) 96970-0935" },
      { phone_number: "5537999985192" },
    ]);
    expect(await notifyNewBudgetRequest("event-multi", deps)).toBe("SENT");
    expect(deps.send).toHaveBeenCalledTimes(2);
    expect(deps.send).toHaveBeenNthCalledWith(
      1,
      "5531969700935",
      expect.any(Array),
      "budget_event-multi",
    );
    expect(deps.send).toHaveBeenNthCalledWith(
      2,
      "5537999985192",
      expect.any(Array),
      "budget_event-multi",
    );
    expect(deps.finish).toHaveBeenCalledWith("link-1", true);
  });

  it("registra erro detalhado com categoria META_REJECTED quando a Meta API rejeita o envio", async () => {
    const deps = makeDeps();
    (deps.send as any).mockResolvedValue({
      success: false,
      errorCategory: "META_REJECTED",
      httpStatus: 400,
      metaErrorCode: 131051,
      metaErrorMessage: "Unsupported message type",
    });

    expect(await notifyNewBudgetRequest("event-1", deps)).toBe("FAILED");
    expect(deps.finish).toHaveBeenCalledWith(
      "link-1",
      false,
      expect.stringContaining("META_REJECTED: HTTP 400 code=131051 message=\"Unsupported message type\""),
      "META_REJECTED",
    );
  });

  it("registra WHATSAPP_NOT_CONFIGURED quando as credenciais da Meta estão ausentes", async () => {
    const deps = makeDeps();
    (deps.send as any).mockResolvedValue({
      success: false,
      errorCategory: "WHATSAPP_NOT_CONFIGURED",
      errorReason: "WhatsApp credentials not configured",
    });

    expect(await notifyNewBudgetRequest("event-1", deps)).toBe("FAILED");
    expect(deps.finish).toHaveBeenCalledWith(
      "link-1",
      false,
      expect.stringContaining("WHATSAPP_NOT_CONFIGURED: WhatsApp credentials not configured"),
      "WHATSAPP_NOT_CONFIGURED",
    );
  });

  it("sanitiza parâmetros ausentes ou nulos para não quebrar a chamada de template da Meta", async () => {
    const deps = makeDeps();
    (deps.loadEvent as any).mockResolvedValue({
      client_name: "",
      phone: null,
      date: undefined,
      event_type: "Formatura",
      guests: null,
    });

    expect(await notifyNewBudgetRequest("event-empty-params", deps)).toBe("SENT");
    expect(deps.send).toHaveBeenCalledWith(
      "5531999999999",
      ["Cliente", "Formatura", "A definir", "A definir", "Não informado"],
      "budget_event-empty-params",
    );
  });

  it("registra INVALID_RECIPIENT quando o número do destinatário não puder ser normalizado", async () => {
    const deps = makeDeps([{ phone_number: "invalid" }]);
    expect(await notifyNewBudgetRequest("event-1", deps)).toBe("FAILED");
    expect(deps.finish).toHaveBeenCalledWith(
      "link-1",
      false,
      expect.stringContaining("INVALID_RECIPIENT"),
      "INVALID_RECIPIENT",
    );
  });

  it("preserva erro do envio e permite retry de FAILED sem duplicar se idempotente", async () => {
    const deps = makeDeps(undefined, false);
    expect(await notifyNewBudgetRequest("event-1", deps)).toBe("FAILED");
    expect(deps.notifyInternal).toHaveBeenCalledOnce();

    (deps.send as any).mockResolvedValue(true);
    expect(await notifyNewBudgetRequest("event-1", deps, true)).toBe("SENT");
    expect(deps.claim).toHaveBeenLastCalledWith("event-1", true);
  });

  it("no retry não reenvia para destinatário que a Meta já aceitou", async () => {
    const deps = makeDeps([
      { phone_number: "31999999999" },
      { phone_number: "37999999999" },
    ]);
    deps.recipientWasSent = vi.fn(async (_id, phone) => phone === "5531999999999");
    deps.finishRecipient = vi.fn().mockResolvedValue(undefined);

    expect(await notifyNewBudgetRequest("event-1", deps, true)).toBe("SENT");
    expect(deps.send).toHaveBeenCalledOnce();
    expect(deps.send).toHaveBeenCalledWith("5537999999999", expect.any(Array), "budget_event-1");
    expect(deps.finishRecipient).toHaveBeenCalledOnce();
  });

  it("não envia quando o claim recusa USED/SENT", async () => {
    const deps = makeDeps();
    (deps.claim as any).mockResolvedValue(null);
    expect(await notifyNewBudgetRequest("event-1", deps)).toBe("SKIPPED");
    expect(deps.notifyInternal).not.toHaveBeenCalled();
    expect(deps.send).not.toHaveBeenCalled();
  });
});
