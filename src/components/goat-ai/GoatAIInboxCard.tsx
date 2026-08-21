import { AIInboxItem } from "@/services/goat-ai/types";
import {
  GoatAIClassificationBadge,
  GoatAIProcessingModeBadge,
  GoatAIStatusBadge,
} from "./GoatAIStatusBadge";
import {
  Calendar,
  DollarSign,
  Store,
  User,
  MessageSquare,
  ChevronRight,
  Check,
  Trash2,
  Sparkles,
} from "lucide-react";
import { fmtBRL } from "@/lib/format";

export function GoatAIInboxCard({
  item,
  onSelect,
  onQuickApprove,
  onQuickReject,
}: {
  item: AIInboxItem;
  onSelect: (item: AIInboxItem) => void;
  onQuickApprove?: (item: AIInboxItem) => void;
  onQuickReject?: (item: AIInboxItem) => void;
}) {
  const isPending = item.approval_status === "pending";
  const data = item.structured_data || {};

  // Extract primary summary highlights
  const total =
    Number(data.total || data.total_value || data.amount || data.revenue) || 0;
  const supplier = data.supplier || data.supplier_name;
  const location = data.location;
  const itemsCount = Array.isArray(data.items)
    ? data.items.length
    : Array.isArray(data.sales)
    ? data.sales.length
    : 0;

  const eventName =
    item.events?.event_name || item.events?.client_name || null;

  return (
    <div className="group relative rounded-xl bg-card border border-border/80 hover:border-primary/50 transition-all p-5 shadow-sm hover:shadow-md">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Section: Badges & Info */}
        <div className="space-y-3 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <GoatAIClassificationBadge classification={item.classification} />
            <GoatAIStatusBadge
              status={item.processing_status}
              approvalStatus={item.approval_status}
            />
            <GoatAIProcessingModeBadge mode={item.processing_mode} />

            {item.classification_confidence > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground px-2 py-0.5 rounded bg-muted/60">
                <Sparkles className="w-3 h-3 text-primary" />
                {(item.classification_confidence * 100).toFixed(0)}% confiança
              </span>
            )}
          </div>

          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2 truncate">
              {eventName ? (
                <span className="text-primary font-medium">{eventName}</span>
              ) : supplier ? (
                <span>{supplier}</span>
              ) : location ? (
                <span>{location}</span>
              ) : (
                <span>{item.raw_text?.slice(0, 60) || "Sem descrição"}</span>
              )}
            </h3>

            <p className="text-xs text-muted-foreground line-clamp-2 mt-1 italic">
              &ldquo;{item.raw_text}&rdquo;
            </p>
          </div>

          {/* Details Row */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {total > 0 && (
              <div className="flex items-center gap-1 font-semibold text-foreground">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                <span>{fmtBRL(total)}</span>
              </div>
            )}

            {supplier && (
              <div className="flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{supplier}</span>
              </div>
            )}

            {itemsCount > 0 && (
              <div className="flex items-center gap-1">
                <span>{itemsCount} {itemsCount === 1 ? "item" : "itens"}</span>
              </div>
            )}

            <div className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{item.source_sender_name || "Sócio"}</span>
              <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-muted">
                {item.source}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{new Date(item.created_at).toLocaleString("pt-BR")}</span>
            </div>
          </div>
        </div>

        {/* Right Section: Action Buttons */}
        <div className="flex items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-border/50">
          {isPending && onQuickApprove && (
            <button
              onClick={() => onQuickApprove(item)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              Aprovar
            </button>
          )}

          {isPending && onQuickReject && (
            <button
              onClick={() => onQuickReject(item)}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-border hover:border-red-500/50 hover:bg-red-500/10 text-muted-foreground hover:text-red-400 text-xs font-medium transition-all cursor-pointer"
              title="Descartar"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => onSelect(item)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary hover:brightness-110 text-primary-foreground text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <span>{isPending ? "Revisar" : "Ver detalhes"}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
