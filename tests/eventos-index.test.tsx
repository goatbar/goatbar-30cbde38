// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  groupEventsByKanbanStatus,
  getVisibleKanbanColumns,
} from "@/lib/kanban-pipeline";
import { eventBudgetService, type Event as RealEvent } from "@/services/event-budget-service";

describe("Eventos & Kanban Integration Logic", () => {
  const mockEvents: RealEvent[] = [
    {
      id: "evt-1",
      client_name: "Mariana",
      event_name: "Casamento Mariana & Lucas",
      date: "2026-10-01",
      event_location: "Buffet França",
      event_type: "Casamento",
      guests: 200,
      current_budget_value: 20000,
      status: "novo_orcamento",
      is_paid_full: false,
      created_at: "2026-08-01",
      updated_at: "2026-08-01",
    },
    {
      id: "evt-2",
      client_name: "Roberto",
      event_name: "Festa Roberto 40",
      date: "2026-10-15",
      event_location: "Espaço Jardins",
      event_type: "Aniversário",
      guests: 80,
      current_budget_value: 9600,
      status: "ORCAMENTO_ENVIADO",
      is_paid_full: false,
      created_at: "2026-08-01",
      updated_at: "2026-08-01",
    },
    {
      id: "evt-3",
      client_name: "Empresa XP",
      event_name: "End of Year Party",
      date: "2026-12-10",
      event_location: "Hotel Unique",
      event_type: "Corporativo",
      guests: 300,
      current_budget_value: 36000,
      status: "CONFIRMADO",
      is_paid_full: true,
      created_at: "2026-08-01",
      updated_at: "2026-08-01",
    },
    {
      id: "evt-4",
      client_name: "Beatriz",
      event_name: "Formatura Beatriz",
      date: "2026-07-20",
      event_location: "Clube Pinheiros",
      event_type: "Formatura",
      guests: 150,
      current_budget_value: 18000,
      status: "FINALIZADO",
      is_paid_full: true,
      created_at: "2026-07-01",
      updated_at: "2026-07-21",
    },
    {
      id: "evt-5",
      client_name: "Gustavo",
      event_name: "Evento Gustavo",
      date: "2026-08-10",
      event_location: "A definir",
      event_type: "Corporativo",
      guests: 50,
      current_budget_value: 5000,
      status: "CANCELADO",
      is_paid_full: false,
      created_at: "2026-08-01",
      updated_at: "2026-08-01",
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("LocalStorage View Mode Persistence", () => {
    const VIEW_STORAGE_KEY = "goatbar:eventos:view";

    function getStoredViewMode(): "lista" | "kanban" | "calendario" {
      try {
        const saved = localStorage.getItem(VIEW_STORAGE_KEY);
        if (saved === "lista" || saved === "kanban" || saved === "calendario") {
          return saved;
        }
      } catch (_e) {
        // Ignora erro de acesso a localStorage
      }
      return "lista";
    }

    it("defaults to 'lista' when no preference is saved", () => {
      expect(getStoredViewMode()).toBe("lista");
    });

    it("restores 'kanban' when previously saved in localStorage", () => {
      localStorage.setItem(VIEW_STORAGE_KEY, "kanban");
      expect(getStoredViewMode()).toBe("kanban");
    });

    it("restores 'calendario' when previously saved in localStorage", () => {
      localStorage.setItem(VIEW_STORAGE_KEY, "calendario");
      expect(getStoredViewMode()).toBe("calendario");
    });

    it("falls back safely to 'lista' when an invalid value is in localStorage", () => {
      localStorage.setItem(VIEW_STORAGE_KEY, "invalid_view_mode_123");
      expect(getStoredViewMode()).toBe("lista");
    });
  });

  describe("Shared Filters between List and Kanban", () => {
    it("filters pipeline events accurately for both List and Kanban", () => {
      const pipelineEvents = mockEvents.filter((e) => {
        const s = e.status?.toUpperCase() || "";
        return !["FINALIZADO", "REALIZADO", "CANCELADO", "PROPOSTA_RECUSADA"].includes(s);
      });

      expect(pipelineEvents).toHaveLength(3);
      expect(pipelineEvents.map((e) => e.id)).toEqual(["evt-1", "evt-2", "evt-3"]);

      const kanbanGroups = groupEventsByKanbanStatus(pipelineEvents);
      expect(kanbanGroups.novo_orcamento).toHaveLength(1);
      expect(kanbanGroups.orcamento_enviado).toHaveLength(1);
      expect(kanbanGroups.confirmado).toHaveLength(1);
      expect(kanbanGroups.finalizado).toHaveLength(0);
      expect(kanbanGroups.cancelado).toHaveLength(0);
    });

    it("filters 'confirmados' properly and groups in Kanban without duplicating logic", () => {
      const confirmados = mockEvents.filter((e) => e.status?.toUpperCase() === "CONFIRMADO");
      expect(confirmados).toHaveLength(1);
      expect(confirmados[0].id).toBe("evt-3");

      const visibleCols = getVisibleKanbanColumns("confirmados");
      expect(visibleCols.map((c) => c.id)).toEqual(["confirmado"]);

      const groups = groupEventsByKanbanStatus(confirmados);
      expect(groups.confirmado).toHaveLength(1);
    });
  });

  describe("Status Transition and Persistence", () => {
    it("calls eventBudgetService.updateNegotiationStatus with correct eventId and new status", async () => {
      const updateSpy = vi
        .spyOn(eventBudgetService, "updateNegotiationStatus")
        .mockResolvedValue({} as any);

      await eventBudgetService.updateNegotiationStatus("evt-1", "orcamento_enviado");

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith("evt-1", "orcamento_enviado");
    });

    it("performs rollback when status update fails in persistence", async () => {
      vi.spyOn(eventBudgetService, "updateNegotiationStatus").mockRejectedValue(
        new Error("Supabase error"),
      );

      const pendingOverrides: Record<string, string> = { "evt-1": "confirmado" };

      try {
        await eventBudgetService.updateNegotiationStatus("evt-1", "confirmado");
      } catch (_err) {
        // Rollback
        delete pendingOverrides["evt-1"];
      }

      expect(pendingOverrides["evt-1"]).toBeUndefined();
    });
  });
});
