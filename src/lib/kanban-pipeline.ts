import { type Event as RealEvent } from "@/services/event-budget-service";

export type KanbanColumnId =
  | "novo_orcamento"
  | "dados_solicitados"
  | "orcamento_enviado"
  | "aguardando_retorno"
  | "em_assinatura"
  | "confirmado"
  | "finalizado"
  | "cancelado";

export interface KanbanColumnDef {
  id: KanbanColumnId;
  label: string;
  dotColor: string;
  badgeClass?: string;
}

/**
 * Colunas canônicas do Kanban na ordem natural do funil comercial.
 */
export const KANBAN_COLUMNS: KanbanColumnDef[] = [
  {
    id: "novo_orcamento",
    label: "Novo Orçamento",
    dotColor: "bg-blue-500",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  {
    id: "dados_solicitados",
    label: "Dados Solicitados",
    dotColor: "bg-indigo-500",
    badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  },
  {
    id: "orcamento_enviado",
    label: "Orçamento Enviado",
    dotColor: "bg-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  {
    id: "aguardando_retorno",
    label: "Aguardando Retorno",
    dotColor: "bg-purple-500",
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
  {
    id: "em_assinatura",
    label: "Em Assinatura",
    dotColor: "bg-cyan-500",
    badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  },
  {
    id: "confirmado",
    label: "Confirmado",
    dotColor: "bg-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  {
    id: "finalizado",
    label: "Finalizado",
    dotColor: "bg-zinc-400",
    badgeClass: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  },
  {
    id: "cancelado",
    label: "Cancelado",
    dotColor: "bg-red-500",
    badgeClass: "bg-red-500/10 text-red-400 border-red-500/20",
  },
];

/**
 * Normaliza qualquer status ou alias legado para o ID canônico de coluna Kanban.
 * Fallback seguro: "novo_orcamento" para garantir que nenhum evento desapareça.
 */
export function normalizeEventStatus(rawStatus?: string | null): KanbanColumnId {
  if (!rawStatus) return "novo_orcamento";
  const s = rawStatus.trim().toLowerCase().replace(/\s+/g, "_");

  switch (s) {
    case "novo":
    case "novo_orcamento":
      return "novo_orcamento";

    case "dados_solicitados":
    case "dados_p/_contrato":
    case "dados_para_contrato":
      return "dados_solicitados";

    case "orcamento_enviado":
    case "enviado":
      return "orcamento_enviado";

    case "aguardando_retorno":
    case "aguardando_resposta":
      return "aguardando_retorno";

    case "em_assinatura":
    case "assinatura":
      return "em_assinatura";

    case "confirmado":
    case "proposta_aceita":
    case "ativo":
    case "assinado":
      return "confirmado";

    case "finalizado":
    case "realizado":
    case "concluido":
      return "finalizado";

    case "cancelado":
    case "proposta_recusada":
    case "inativo":
      return "cancelado";

    default:
      // Heurísticas de fallback seguro
      if (s.includes("cancel") || s.includes("recus")) return "cancelado";
      if (s.includes("final") || s.includes("realiz") || s.includes("concl")) return "finalizado";
      if (s.includes("conf")) return "confirmado";
      if (s.includes("assin")) return "em_assinatura";
      if (s.includes("aguard") || s.includes("respost")) return "aguardando_retorno";
      if (s.includes("enviad")) return "orcamento_enviado";
      if (s.includes("dad") || s.includes("solicit")) return "dados_solicitados";
      // Fallback seguro: mantém o evento visível na coluna inicial do funil
      return "novo_orcamento";
  }
}

/**
 * Retorna as colunas do Kanban a serem exibidas com base no filtro de status selecionado.
 */
export function getVisibleKanbanColumns(statusFilter: string): KanbanColumnDef[] {
  switch (statusFilter) {
    case "pipeline":
      // Pipeline ativo principal: exclui finalizados e cancelados
      return KANBAN_COLUMNS.filter((c) => c.id !== "finalizado" && c.id !== "cancelado");

    case "negociacao":
      // Apenas etapas de negociação (antes de confirmado/finalizado/cancelado)
      return KANBAN_COLUMNS.filter(
        (c) =>
          c.id === "novo_orcamento" ||
          c.id === "dados_solicitados" ||
          c.id === "orcamento_enviado" ||
          c.id === "aguardando_retorno" ||
          c.id === "em_assinatura",
      );

    case "confirmados":
      return KANBAN_COLUMNS.filter((c) => c.id === "confirmado");

    case "finalizados":
      return KANBAN_COLUMNS.filter((c) => c.id === "finalizado");

    case "cancelados":
      return KANBAN_COLUMNS.filter((c) => c.id === "cancelado");

    case "ativos":
      // Ativos inclui confirmados e finalizados, mas exclui cancelados
      return KANBAN_COLUMNS.filter((c) => c.id !== "cancelado");

    case "todos":
    default:
      return KANBAN_COLUMNS;
  }
}

/**
 * Agrupa os eventos filtrados por coluna Kanban, respeitando a ordem recebida
 * e aplicando overrides otimistas quando existirem.
 */
export function groupEventsByKanbanStatus(
  events: RealEvent[],
  pendingOverrides?: Record<string, KanbanColumnId>,
): Record<KanbanColumnId, RealEvent[]> {
  const groups: Record<KanbanColumnId, RealEvent[]> = {
    novo_orcamento: [],
    dados_solicitados: [],
    orcamento_enviado: [],
    aguardando_retorno: [],
    em_assinatura: [],
    confirmado: [],
    finalizado: [],
    cancelado: [],
  };

  for (const event of events) {
    const override = pendingOverrides?.[event.id];
    const statusKey = override ?? normalizeEventStatus(event.status);
    if (groups[statusKey]) {
      groups[statusKey].push(event);
    } else {
      groups.novo_orcamento.push(event);
    }
  }

  return groups;
}
