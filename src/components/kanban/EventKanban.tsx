import React, { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  useSensors,
  useSensor,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { type Event as RealEvent } from "@/services/event-budget-service";
import {
  type KanbanColumnId,
  getVisibleKanbanColumns,
  groupEventsByKanbanStatus,
} from "@/lib/kanban-pipeline";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";

interface EventKanbanProps {
  events: RealEvent[];
  statusFilter: string;
  savingEventIds?: Set<string>;
  pendingOverrides?: Record<string, KanbanColumnId>;
  onStatusChange: (eventId: string, newStatus: KanbanColumnId) => void | Promise<void>;
}

export function EventKanban({
  events,
  statusFilter,
  savingEventIds = new Set(),
  pendingOverrides,
  onStatusChange,
}: EventKanbanProps) {
  const [activeEvent, setActiveEvent] = useState<{
    event: RealEvent;
    currentColumnId: KanbanColumnId;
  } | null>(null);

  // Configuração refinada de sensores para suporte a mouse, touch e teclado
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Exige 8px de movimento para iniciar drag, permitindo cliques normais
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // Previne conflito com scroll em touch
        tolerance: 6,
      },
    }),
    useSensor(KeyboardSensor),
  );

  // Determina as colunas visíveis de acordo com o filtro atual
  const visibleColumns = useMemo(() => getVisibleKanbanColumns(statusFilter), [statusFilter]);

  // Agrupa os eventos filtrados pelas colunas
  const groupedEvents = useMemo(
    () => groupEventsByKanbanStatus(events, pendingOverrides),
    [events, pendingOverrides],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.event && data?.currentColumnId) {
      setActiveEvent({
        event: data.event as RealEvent,
        currentColumnId: data.currentColumnId as KanbanColumnId,
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveEvent(null);

    if (!over) return;

    const eventId = String(active.id);
    const sourceColumnId = active.data.current?.currentColumnId as KanbanColumnId | undefined;
    const targetColumnId = (over.data.current?.columnId || over.id) as KanbanColumnId;

    // Se soltou na mesma coluna ou destino inválido, não faz requisição
    if (!targetColumnId || sourceColumnId === targetColumnId) {
      return;
    }

    // Se o card já estiver sendo salvo (bloqueio de concorrência), ignora novo drop
    if (savingEventIds.has(eventId)) {
      return;
    }

    onStatusChange(eventId, targetColumnId);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveEvent(null)}
    >
      <div className="w-full">
        {/* Container horizontal com scroll interno estrito (não causa overflow na página) */}
        <div
          className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1 scrollbar-thin scrollbar-thumb-border hover:scrollbar-thumb-muted-foreground/30 focus:outline-none"
          tabIndex={0}
          aria-label="Quadro Kanban de eventos"
        >
          {visibleColumns.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              events={groupedEvents[col.id] || []}
              savingEventIds={savingEventIds}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      </div>

      {/* Overlay para visual suave do card durante o arraste */}
      <DragOverlay dropAnimation={null}>
        {activeEvent ? (
          <div className="w-[280px]">
            <KanbanCard
              event={activeEvent.event}
              currentColumnId={activeEvent.currentColumnId}
              isOverlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
