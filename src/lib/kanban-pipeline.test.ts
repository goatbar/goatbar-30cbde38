import { describe, it, expect } from "vitest";
import {
  normalizeEventStatus,
  getVisibleKanbanColumns,
  groupEventsByKanbanStatus,
  KANBAN_COLUMNS,
} from "./kanban-pipeline";
import { type Event as RealEvent } from "@/services/event-budget-service";

describe("kanban-pipeline", () => {
  describe("normalizeEventStatus", () => {
    it("normalizes canonical lowercase statuses", () => {
      expect(normalizeEventStatus("novo_orcamento")).toBe("novo_orcamento");
      expect(normalizeEventStatus("dados_solicitados")).toBe("dados_solicitados");
      expect(normalizeEventStatus("orcamento_enviado")).toBe("orcamento_enviado");
      expect(normalizeEventStatus("aguardando_retorno")).toBe("aguardando_retorno");
      expect(normalizeEventStatus("em_assinatura")).toBe("em_assinatura");
      expect(normalizeEventStatus("confirmado")).toBe("confirmado");
      expect(normalizeEventStatus("finalizado")).toBe("finalizado");
      expect(normalizeEventStatus("cancelado")).toBe("cancelado");
    });

    it("normalizes uppercase statuses and aliases", () => {
      expect(normalizeEventStatus("NOVO")).toBe("novo_orcamento");
      expect(normalizeEventStatus("NOVO_ORCAMENTO")).toBe("novo_orcamento");
      expect(normalizeEventStatus("DADOS_SOLICITADOS")).toBe("dados_solicitados");
      expect(normalizeEventStatus("ORCAMENTO_ENVIADO")).toBe("orcamento_enviado");
      expect(normalizeEventStatus("AGUARDANDO_RESPOSTA")).toBe("aguardando_retorno");
      expect(normalizeEventStatus("AGUARDANDO_RETORNO")).toBe("aguardando_retorno");
      expect(normalizeEventStatus("EM_ASSINATURA")).toBe("em_assinatura");
      expect(normalizeEventStatus("CONFIRMADO")).toBe("confirmado");
      expect(normalizeEventStatus("PROPOSTA_ACEITA")).toBe("confirmado");
      expect(normalizeEventStatus("FINALIZADO")).toBe("finalizado");
      expect(normalizeEventStatus("REALIZADO")).toBe("finalizado");
      expect(normalizeEventStatus("CANCELADO")).toBe("cancelado");
      expect(normalizeEventStatus("PROPOSTA_RECUSADA")).toBe("cancelado");
    });

    it("normalizes legacy string formats and variations", () => {
      expect(normalizeEventStatus("novo")).toBe("novo_orcamento");
      expect(normalizeEventStatus("aguardando_resposta")).toBe("aguardando_retorno");
      expect(normalizeEventStatus("realizado")).toBe("finalizado");
      expect(normalizeEventStatus("concluido")).toBe("finalizado");
      expect(normalizeEventStatus("dados p/ contrato")).toBe("dados_solicitados");
    });

    it("falls back safely to novo_orcamento for unknown or empty strings", () => {
      expect(normalizeEventStatus(null)).toBe("novo_orcamento");
      expect(normalizeEventStatus(undefined)).toBe("novo_orcamento");
      expect(normalizeEventStatus("")).toBe("novo_orcamento");
      expect(normalizeEventStatus("status_desconhecido_xyz")).toBe("novo_orcamento");
    });
  });

  describe("getVisibleKanbanColumns", () => {
    it("returns active pipeline columns when filter is 'pipeline'", () => {
      const cols = getVisibleKanbanColumns("pipeline");
      const ids = cols.map((c) => c.id);
      expect(ids).toEqual([
        "novo_orcamento",
        "dados_solicitados",
        "orcamento_enviado",
        "aguardando_retorno",
        "em_assinatura",
        "confirmado",
      ]);
      expect(ids).not.toContain("finalizado");
      expect(ids).not.toContain("cancelado");
    });

    it("returns negotiation columns when filter is 'negociacao'", () => {
      const cols = getVisibleKanbanColumns("negociacao");
      const ids = cols.map((c) => c.id);
      expect(ids).toEqual([
        "novo_orcamento",
        "dados_solicitados",
        "orcamento_enviado",
        "aguardando_retorno",
        "em_assinatura",
      ]);
    });

    it("returns confirmed column when filter is 'confirmados'", () => {
      const cols = getVisibleKanbanColumns("confirmados");
      expect(cols.map((c) => c.id)).toEqual(["confirmado"]);
    });

    it("returns all columns when filter is 'todos'", () => {
      const cols = getVisibleKanbanColumns("todos");
      expect(cols.length).toBe(KANBAN_COLUMNS.length);
      expect(cols.map((c) => c.id)).toContain("cancelado");
      expect(cols.map((c) => c.id)).toContain("finalizado");
    });
  });

  describe("groupEventsByKanbanStatus", () => {
    const mockEvents: RealEvent[] = [
      {
        id: "evt-1",
        client_name: "Cliente 1",
        event_type: "Casamento",
        date: "2026-09-01",
        guests: 120,
        status: "NOVO_ORCAMENTO",
        is_paid_full: false,
        created_at: "2026-08-01",
        updated_at: "2026-08-01",
      },
      {
        id: "evt-2",
        client_name: "Cliente 2",
        event_type: "Corporativo",
        date: "2026-09-05",
        guests: 80,
        status: "orcamento_enviado",
        is_paid_full: false,
        created_at: "2026-08-01",
        updated_at: "2026-08-01",
      },
      {
        id: "evt-3",
        client_name: "Cliente 3",
        event_type: "Aniversário",
        date: "2026-09-10",
        guests: 50,
        status: "CONFIRMADO",
        is_paid_full: true,
        created_at: "2026-08-01",
        updated_at: "2026-08-01",
      },
    ];

    it("groups events correctly into their canonical status buckets", () => {
      const grouped = groupEventsByKanbanStatus(mockEvents);
      expect(grouped.novo_orcamento).toHaveLength(1);
      expect(grouped.novo_orcamento[0].id).toBe("evt-1");
      expect(grouped.orcamento_enviado).toHaveLength(1);
      expect(grouped.orcamento_enviado[0].id).toBe("evt-2");
      expect(grouped.confirmado).toHaveLength(1);
      expect(grouped.confirmado[0].id).toBe("evt-3");
      expect(grouped.cancelado).toHaveLength(0);
    });

    it("applies optimistic overrides when provided", () => {
      const grouped = groupEventsByKanbanStatus(mockEvents, {
        "evt-1": "em_assinatura",
      });
      expect(grouped.novo_orcamento).toHaveLength(0);
      expect(grouped.em_assinatura).toHaveLength(1);
      expect(grouped.em_assinatura[0].id).toBe("evt-1");
    });
  });
});
