import { describe, expect, it } from "vitest";
import {
  assertPersistedBudgetRequest,
  extractInvokeErrorMessage,
  normalizePayloadForBackend,
  type BudgetRequestPayload,
} from "./budget-request-service";

describe("assertPersistedBudgetRequest", () => {
  const eventId = "123e4567-e89b-42d3-a456-426614174000";

  it("aceita sucesso somente com state USED e event_id persistido", () => {
    expect(
      assertPersistedBudgetRequest({ state: "USED", idempotent: false, event_id: eventId }),
    ).toEqual({ state: "USED", idempotent: false, event_id: eventId });
  });

  it.each([
    undefined,
    {},
    { state: "USED", idempotent: false },
    { state: "ACTIVE", event_id: eventId },
    { state: "USED", event_id: "not-an-id" },
  ])("rejeita resposta sem confirmação real de persistência: %j", (response) => {
    expect(() => assertPersistedBudgetRequest(response)).toThrow(/não confirmou a persistência/);
  });
});

describe("normalizePayloadForBackend", () => {
  const basePayload: BudgetRequestPayload = {
    client_name: "Cliente Teste",
    phone: "11999999999",
    date: "2026-12-12",
    event_type: "Comemoração",
    guests: 100,
    duration_hours: 5,
  };

  it("mapeia Comemoração para Confraternização para compatibilidade com o backend em produção", () => {
    const normalized = normalizePayloadForBackend(basePayload);
    expect(normalized.event_type).toBe("Confraternização");
    expect(normalized.client_name).toBe("Cliente Teste");
  });

  it("mantém inalterados outros tipos de eventos suportados nativamente", () => {
    expect(normalizePayloadForBackend({ ...basePayload, event_type: "Casamento" }).event_type).toBe(
      "Casamento",
    );
    expect(normalizePayloadForBackend({ ...basePayload, event_type: "Corporativo" }).event_type).toBe(
      "Corporativo",
    );
    expect(normalizePayloadForBackend({ ...basePayload, event_type: "Aniversário" }).event_type).toBe(
      "Aniversário",
    );
  });
});

describe("extractInvokeErrorMessage", () => {
  it("extrai a mensagem de erro específica do JSON em error.context", async () => {
    const errorWithContext = {
      message: "Edge Function returned a non-2xx status code",
      context: new Response(JSON.stringify({ error: "Tipo de evento inválido." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    };

    const msg = await extractInvokeErrorMessage(errorWithContext);
    expect(msg).toBe("Tipo de evento inválido.");
  });

  it("extrai campo message do JSON em error.context se error não existir", async () => {
    const errorWithContext = {
      message: "Edge Function returned a non-2xx status code",
      context: new Response(JSON.stringify({ message: "Nome do casal é obrigatório." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    };

    const msg = await extractInvokeErrorMessage(errorWithContext);
    expect(msg).toBe("Nome do casal é obrigatório.");
  });

  it("substitui a mensagem técnica em inglês por fallback em português amigável", async () => {
    const rawError = {
      message: "Edge Function returned a non-2xx status code",
    };

    const msg = await extractInvokeErrorMessage(rawError);
    expect(msg).toBe(
      "Não foi possível processar a solicitação. Por favor, revise as informações e tente novamente.",
    );
  });

  it("retorna fallback amigável quando o erro for nulo ou vazio", async () => {
    const msg = await extractInvokeErrorMessage(null);
    expect(msg).toBe(
      "Não foi possível processar a solicitação. Por favor, revise as informações e tente novamente.",
    );
  });
});
