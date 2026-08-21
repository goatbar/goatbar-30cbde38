import React from "react";
import { Link } from "@tanstack/react-router";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, Users, MapPin, Loader2, GripVertical } from "lucide-react";
import { type Event as RealEvent } from "@/services/event-budget-service";
import { type KanbanColumnId, KANBAN_COLUMNS } from "@/lib/kanban-pipeline";
import { fmtBRL } from "@/lib/format";

interface KanbanCardProps {
  event: RealEvent;
  currentColumnId: KanbanColumnId;
  isSaving?: boolean;
  onStatusChange?: (eventId: string, newStatus: KanbanColumnId) => void;
  isOverlay?: boolean;
}

export function KanbanCard({
  event,
  currentColumnId,
  isSaving = false,
  onStatusChange,
  isOverlay = false,
}: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    disabled: isSaving,
    data: {
      eventId: event.id,
      currentColumnId,
      event,
    },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  const eventTitle = event.event_name || event.client_name || "Evento sem nome";
  const formattedDate = event.date
    ? new Date(event.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })
    : "Data a definir";

  const guestsCount = event.guests || 0;
  const budgetValue = event.current_budget_value;
  const valuePerPerson = budgetValue && guestsCount > 0 ? budgetValue / guestsCount : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-xl border border-border bg-card p-3.5 shadow-sm transition-all select-none hover:border-primary/40 hover:shadow-md ${
        isDragging ? "opacity-30 border-dashed border-primary" : ""
      } ${isSaving ? "opacity-70 pointer-events-none" : ""} ${
        isOverlay
          ? "shadow-2xl border-primary scale-105 rotate-1 bg-surface z-50 cursor-grabbing"
          : ""
      }`}
    >
      {/* Indicador de Salvando */}
      {isSaving && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/60 backdrop-blur-[1px]">
          <div className="flex items-center gap-1.5 rounded-md bg-surface px-2.5 py-1 text-[11px] font-medium text-foreground border border-border shadow">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            <span>Salvando...</span>
          </div>
        </div>
      )}

      {/* Top row: Drag Handle, Tipo do Evento e Seletor Acessível de Status */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 text-muted-foreground/60 hover:text-foreground rounded transition-colors"
            title="Arraste para mover de coluna"
            aria-label={`Mover evento ${eventTitle}`}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>
          {event.event_type && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-secondary text-secondary-foreground truncate">
              {event.event_type}
            </span>
          )}
        </div>

        {/* Seletor rápido e acessível de status (para teclado/mobile) */}
        {onStatusChange && (
          <div
            className="relative shrink-0"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <label htmlFor={`status-select-${event.id}`} className="sr-only">
              Alterar status de {eventTitle}
            </label>
            <select
              id={`status-select-${event.id}`}
              value={currentColumnId}
              disabled={isSaving}
              onChange={(e) => {
                e.stopPropagation();
                onStatusChange(event.id, e.target.value as KanbanColumnId);
              }}
              className="h-6 px-1.5 text-[10px] font-medium rounded border border-border bg-input text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-[110px] truncate"
              title="Alterar status do evento"
            >
              {KANBAN_COLUMNS.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Link para detalhes do evento */}
      <Link
        to="/eventos/$eventoId"
        params={{ eventoId: event.id }}
        className="block space-y-2 group/link cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary rounded-lg"
        onClick={(e) => {
          if (isDragging) {
            e.preventDefault();
          }
        }}
      >
        <div className="font-bold text-sm text-foreground group-hover/link:text-primary transition-colors line-clamp-2 leading-tight">
          {eventTitle}
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-primary/80 shrink-0" />
            <span className="truncate">{formattedDate}</span>
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span
              className="flex items-center gap-1 truncate"
              title={event.event_location || "A definir"}
            >
              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="truncate">{event.event_location || "A definir"}</span>
            </span>

            <span className="flex items-center gap-1 shrink-0 font-medium">
              <Users className="h-3 w-3 text-muted-foreground shrink-0" />
              <span>{guestsCount} pax</span>
            </span>
          </div>
        </div>

        {/* Linha financeira */}
        <div className="pt-2 mt-2 border-t border-border flex items-baseline justify-between text-xs">
          <div className="font-bold text-foreground">
            {budgetValue ? fmtBRL(budgetValue) : "--"}
          </div>
          <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
            {valuePerPerson ? `${fmtBRL(valuePerPerson)}/pax` : "Em aberto"}
          </div>
        </div>
      </Link>
    </div>
  );
}
