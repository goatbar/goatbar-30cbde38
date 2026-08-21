import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { type Event as RealEvent } from "@/services/event-budget-service";
import { type KanbanColumnDef, type KanbanColumnId } from "@/lib/kanban-pipeline";
import { KanbanCard } from "./KanbanCard";

interface KanbanColumnProps {
  column: KanbanColumnDef;
  events: RealEvent[];
  savingEventIds: Set<string>;
  onStatusChange: (eventId: string, newStatus: KanbanColumnId) => void;
}

export function KanbanColumn({
  column,
  events,
  savingEventIds,
  onStatusChange,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      columnId: column.id,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col flex-1 min-w-[280px] max-w-[320px] shrink-0 rounded-2xl bg-surface/70 border transition-colors ${
        isOver ? "border-primary/50 bg-primary/[0.04] ring-1 ring-primary/30" : "border-border"
      }`}
    >
      {/* Cabeçalho da Coluna: TÍTULO + CONTAGEM */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/80 bg-surface/90 rounded-t-2xl">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-2 w-2 rounded-full shrink-0 ${column.dotColor}`} />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground truncate">
            {column.label}
          </h3>
        </div>

        <span
          className={`inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-bold rounded-full border ${
            column.badgeClass || "bg-secondary text-secondary-foreground border-border"
          }`}
          title={`${events.length} evento(s) nesta etapa`}
        >
          {events.length}
        </span>
      </div>

      {/* Lista de Cards da Coluna */}
      <div className="p-3 flex-1 flex flex-col gap-2.5 overflow-y-auto max-h-[calc(100vh-320px)] min-h-[160px]">
        {events.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 border border-dashed border-border/60 rounded-xl text-center">
            <p className="text-xs text-muted-foreground/70">Nenhum evento nesta etapa</p>
          </div>
        ) : (
          events.map((event) => (
            <KanbanCard
              key={event.id}
              event={event}
              currentColumnId={column.id}
              isSaving={savingEventIds.has(event.id)}
              onStatusChange={onStatusChange}
            />
          ))
        )}
      </div>
    </div>
  );
}
