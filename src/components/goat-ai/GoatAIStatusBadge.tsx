import {
  GoatAIApprovalStatus,
  GoatAIClassification,
  GoatAIProcessingMode,
  GoatAIProcessingStatus,
} from "@/services/goat-ai/types";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Sparkles,
  Cpu,
  HelpCircle,
  ShoppingBag,
  TrendingUp,
  Receipt,
  FileText,
  Boxes,
  FileSpreadsheet,
  StickyNote,
} from "lucide-react";

export function GoatAIStatusBadge({
  status,
  approvalStatus,
}: {
  status: GoatAIProcessingStatus;
  approvalStatus?: GoatAIApprovalStatus;
}) {
  if (approvalStatus === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Aprovado
      </span>
    );
  }

  if (approvalStatus === "rejected") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-500 border border-red-500/20">
        <XCircle className="w-3.5 h-3.5" />
        Descartado
      </span>
    );
  }

  switch (status) {
    case "received":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">
          <Clock className="w-3.5 h-3.5" />
          Recebido
        </span>
      );
    case "processing":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse">
          <Clock className="w-3.5 h-3.5 animate-spin" />
          Processando
        </span>
      );
    case "processed":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <Clock className="w-3.5 h-3.5" />
          Aguardando aprovação
        </span>
      );
    case "needs_review":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <AlertTriangle className="w-3.5 h-3.5" />
          Precisa revisão
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
          <AlertTriangle className="w-3.5 h-3.5" />
          Erro
        </span>
      );
    default:
      return null;
  }
}

export function GoatAIClassificationBadge({
  classification,
}: {
  classification: GoatAIClassification;
}) {
  const config: Record<
    GoatAIClassification,
    { label: string; icon: typeof ShoppingBag; className: string }
  > = {
    event_purchase: {
      label: "Compra de Evento",
      icon: ShoppingBag,
      className: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    },
    sales_session: {
      label: "Sessão de Vendas",
      icon: TrendingUp,
      className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    },
    operation_report: {
      label: "Relatório de Operação",
      icon: FileSpreadsheet,
      className: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
    },
    invoice: {
      label: "Nota Fiscal",
      icon: Receipt,
      className: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    },
    receipt: {
      label: "Comprovante",
      icon: FileText,
      className: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    },
    stock_movement: {
      label: "Movimentação Estoque",
      icon: Boxes,
      className: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    },
    expense: {
      label: "Despesa Geral",
      icon: Receipt,
      className: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    },
    event_note: {
      label: "Nota de Evento",
      icon: StickyNote,
      className: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    },
    general_note: {
      label: "Anotação Geral",
      icon: StickyNote,
      className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    },
    unknown: {
      label: "Incompleto / Desconhecido",
      icon: HelpCircle,
      className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    },
  };

  const item = config[classification] || config.unknown;
  const Icon = item.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${item.className}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {item.label}
    </span>
  );
}

export function GoatAIProcessingModeBadge({
  mode,
}: {
  mode: GoatAIProcessingMode;
}) {
  if (mode === "gemini") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
        <Sparkles className="w-3 h-3" />
        Gemini AI
      </span>
    );
  }
  if (mode === "heuristic") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <Cpu className="w-3 h-3" />
        Heurística (Dev)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
      <AlertTriangle className="w-3 h-3" />
      Indisponível
    </span>
  );
}
