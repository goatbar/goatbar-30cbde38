import { describe, expect, it } from "vitest";
import {
  formatConfirmedEventsReply,
  resolveExplicitConfirmedEventsIntent,
} from "./confirmed-events";
import { searchEventsTool } from "../tools/definitions/events";

describe("explicit confirmed-events intent", () => {
  it.each([
    "Me mande os eventos confirmados",
    "eventos confirmados",
    "Quais eventos estão confirmados?",
  ])("resolves only the current confirmed-events request: %s", (message) => {
    expect(resolveExplicitConfirmedEventsIntent(message)).toEqual({ matched: true });
  });

  it("does not re-run the previous next-event intent", () => {
    expect(resolveExplicitConfirmedEventsIntent("Qual é a data do próximo evento?")).toEqual({
      matched: false,
    });
  });

  it("uses pagination only when explicitly requested", () => {
    expect(resolveExplicitConfirmedEventsIntent("Me mande apenas 3 eventos confirmados")).toEqual({
      matched: true,
      limit: 3,
    });
  });
});

describe("confirmed-events canonical fields", () => {
  it("keeps client/contractor separate from the event name", () => {
    const reply = formatConfirmedEventsReply([
      {
        event_name: "Júlia e Sofia",
        client_name: "Michele Reis",
        date: "2026-09-26",
        event_location: "Espaço A",
        city: "São Paulo",
      },
    ]);

    expect(reply).toContain("*Júlia e Sofia*");
    expect(reply).toContain("Cliente/contratante: Michele Reis");
    expect(reply).toContain("26/09/2026");
  });
});

describe("search_events Pipeline contract", () => {
  it("returns every canonical confirmed event in ascending date order without a silent limit", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const rows = Array.from({ length: 6 }, (_, index) => ({
      id: `event-${index + 1}`,
      event_name: `Evento ${index + 1}`,
      client_name: `Cliente ${index + 1}`,
      date: `2026-${String(index + 1).padStart(2, "0")}-01`,
      status: "confirmado",
    }));
    const builder: any = {
      select(...args: unknown[]) {
        calls.push(["select", ...args]);
        return this;
      },
      order(...args: unknown[]) {
        calls.push(["order", ...args]);
        return this;
      },
      ilike(...args: unknown[]) {
        calls.push(["ilike", ...args]);
        return this;
      },
      limit(...args: unknown[]) {
        calls.push(["limit", ...args]);
        return this;
      },
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve(resolve({ data: rows, error: null }));
      },
    };
    const result = await searchEventsTool.execute(
      { supabaseAdmin: { from: () => builder } } as any,
      { query: "confirmados", status: "confirmed" },
    );

    expect(result.success).toBe(true);
    expect(result.data?.count).toBe(6);
    expect(result.data?.events).toHaveLength(6);
    expect(calls).toContainEqual(["ilike", "status", "confirmado"]);
    expect(calls).toContainEqual(["order", "date", { ascending: true }]);
    expect(calls.some(([method]) => method === "limit")).toBe(false);
  });
});
