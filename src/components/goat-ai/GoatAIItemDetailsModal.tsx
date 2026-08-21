import { useState, useEffect } from "react";
import {
  AIInboxItem,
  AIActionLog,
  GoatAIClassification,
} from "@/services/goat-ai/types";
import { goatAIService } from "@/services/goat-ai/goat-ai-service";
import {
  GoatAIClassificationBadge,
  GoatAIProcessingModeBadge,
  GoatAIStatusBadge,
} from "./GoatAIStatusBadge";
import {
  X,
  Sparkles,
  Calendar,
  User,
  Store,
  DollarSign,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  History,
  Info,
  Layers,
  FileText,
  Save,
} from "lucide-react";
import { fmtBRL } from "@/lib/format";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function GoatAIItemDetailsModal({
  item,
  onClose,
  onUpdated,
}: {
  item: AIInboxItem;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"details" | "logs">("details");
  const [logs, setLogs] = useState<AIActionLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [eventsList, setEventsList] = useState<any[]>([]);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>(
    item.matched_event_id || ""
  );
  const [classification, setClassification] = useState<GoatAIClassification>(
    item.classification
  );
  const [structuredData, setStructuredData] = useState<Record<string, any>>(
    structuredClone(item.structured_data || {})
  );

  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // Load events and action logs
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingLogs(true);
        const { logs: itemLogs } = await goatAIService.getItemDetails(item.id);
        setLogs(itemLogs);

        const { data: events } = await supabase
          .from("events")
          .select("id, client_name, event_name, date")
          .order("date", { ascending: false });
        setEventsList(events || []);
      } catch (err) {
        console.error("Erro ao carregar dados adicionais do item:", err);
      } finally {
        setLoadingLogs(false);
      }
    }
    loadData();
  }, [item.id]);

  // Handle Item Array Editing
  const itemsArray = Array.isArray(structuredData.items)
    ? structuredData.items
    : [];

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...itemsArray];
    updated[index] = { ...updated[index], [field]: value };

    // auto recalculate total price if qty or unit price change
    if (field === "quantity" || field === "unit_price") {
      const qty = Number(updated[index].quantity || 0);
      const price = Number(updated[index].unit_price || 0);
      updated[index].total_price = qty * price;
    }

    // auto recalculate total sum
    const totalSum = updated.reduce(
      (acc, it) => acc + (Number(it.total_price) || 0),
      0
    );

    setStructuredData({
      ...structuredData,
      items: updated,
      total: totalSum > 0 ? totalSum : structuredData.total,
    });
  };

  const handleAddItem = () => {
    const updated = [
      ...itemsArray,
      {
        name: "Novo Item",
        quantity: 1,
        unit: "un",
        unit_price: 0,
        total_price: 0,
      },
    ];
    setStructuredData({ ...structuredData, items: updated });
  };

  const handleRemoveItem = (index: number) => {
    const updated = itemsArray.filter((_, i) => i !== index);
    setStructuredData({ ...structuredData, items: updated });
  };

  // Save manual modifications
  const handleSaveEdits = async () => {
    try {
      setSaving(true);
      await goatAIService.updateItemInterpretation(item.id, {
        classification,
        matched_event_id: selectedEventId || null,
        structured_data: structuredData,
      });
      toast.success("Interpretação atualizada com sucesso!");
      setIsEditing(false);
      onUpdated();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar alterações");
    } finally {
      setSaving(false);
    }
  };

  // Reprocess Item
  const handleReprocess = async () => {
    try {
      setReprocessing(true);
      const updated = await goatAIService.reprocessItem(item.id);
      toast.success("Item reprocessado com sucesso!");
      setStructuredData(structuredClone(updated.structured_data || {}));
      setSelectedEventId(updated.matched_event_id || "");
      setClassification(updated.classification);
      onUpdated();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao reprocessar item");
    } finally {
      setReprocessing(false);
    }
  };

  // Approve Item (Transactional Backend RPC)
  const handleApprove = async () => {
    try {
      setApproving(true);
      const result = await goatAIService.approveItem(item.id, {
        override_data: structuredData,
        event_id: selectedEventId || undefined,
      });

      if (result.already_applied) {
        toast.info("Este item já havia sido aprovado anteriormente.");
      } else {
        toast.success("Item aprovado e registrado com sucesso!");
      }
      onUpdated();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao aprovar item");
    } finally {
      setApproving(false);
    }
  };

  // Reject / Discard Item
  const handleReject = async () => {
    if (!confirm("Tem certeza que deseja descartar esta mensagem?")) return;
    try {
      setRejecting(true);
      await goatAIService.rejectItem(item.id, "Descartado pelo usuário");
      toast.success("Item descartado.");
      onUpdated();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao descartar");
    } finally {
      setRejecting(false);
    }
  };

  const isPending = item.approval_status === "pending";
  const isApproved = item.approval_status === "approved";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Revisão Goat AI
            </h2>
            <GoatAIClassificationBadge classification={classification} />
            <GoatAIStatusBadge
              status={item.processing_status}
              approvalStatus={item.approval_status}
            />
            <GoatAIProcessingModeBadge mode={item.processing_mode} />
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SUBNAV TABS */}
        <div className="px-6 border-b border-border flex items-center gap-6 text-sm font-medium bg-card">
          <button
            onClick={() => setActiveTab("details")}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "details"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="w-4 h-4" />
            Interpretação e Dados
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "logs"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="w-4 h-4" />
            Auditoria ({logs.length})
          </button>
        </div>

        {/* CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "details" ? (
            <>
              {/* AREA 1: CONTEUDO ORIGINAL */}
              <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border/50 pb-2">
                  <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5 text-foreground">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    1. Conteúdo Original Recebido
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {item.source_sender_name || "Sócio"} ({item.source})
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(item.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-background border border-border/60 text-sm font-mono whitespace-pre-wrap text-foreground">
                  {item.raw_text || item.transcribed_text || "(Sem texto)"}
                </div>

                {item.transcribed_text && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      Transcrição de Áudio:{" "}
                    </span>
                    {item.transcribed_text}
                  </div>
                )}
              </div>

              {/* AREA 2: INTERPRETACAO DA IA */}
              <div className="rounded-xl border border-border/80 bg-card p-5 space-y-5">
                <div className="flex items-center justify-between border-b border-border/50 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm uppercase tracking-wider text-foreground">
                      2. Interpretação da IA & Dados Estruturados
                    </span>
                  </div>

                  {!isApproved && (
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                    >
                      {isEditing ? "Cancelar Edição" : "Editar Campos"}
                    </button>
                  )}
                </div>

                {/* Confidences Gauge */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-center">
                    <span className="text-[11px] text-muted-foreground block">
                      Confiança da Classificação
                    </span>
                    <span className="text-base font-bold text-foreground">
                      {(item.classification_confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-center">
                    <span className="text-[11px] text-muted-foreground block">
                      Confiança da Extração
                    </span>
                    <span className="text-base font-bold text-foreground">
                      {(item.extraction_confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-center">
                    <span className="text-[11px] text-muted-foreground block">
                      Confiança do Evento
                    </span>
                    <span className="text-base font-bold text-foreground">
                      {(item.event_match_confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Matched Event Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Evento Vinculado</span>
                    {item.provider_metadata?.event_match_reason && (
                      <span className="text-[11px] text-muted-foreground font-normal">
                        Motivo: {item.provider_metadata.event_match_reason}
                      </span>
                    )}
                  </label>
                  <select
                    disabled={isApproved || (!isEditing && !isPending)}
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary disabled:opacity-75"
                  >
                    <option value="">-- Nenhum evento selecionado (Geral) --</option>
                    {eventsList.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.event_name || ev.client_name} ({new Date(ev.date).toLocaleDateString("pt-BR")})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Structured Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Fornecedor / Local
                    </label>
                    <input
                      type="text"
                      disabled={isApproved || (!isEditing && !isPending)}
                      value={structuredData.supplier || structuredData.supplier_name || structuredData.location || ""}
                      onChange={(e) =>
                        setStructuredData({
                          ...structuredData,
                          supplier: e.target.value,
                          supplier_name: e.target.value,
                          location: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary disabled:opacity-75"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Valor Total (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      disabled={isApproved || (!isEditing && !isPending)}
                      value={structuredData.total ?? structuredData.revenue ?? structuredData.amount ?? 0}
                      onChange={(e) =>
                        setStructuredData({
                          ...structuredData,
                          total: Number(e.target.value),
                          amount: Number(e.target.value),
                          revenue: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm font-semibold text-foreground focus:outline-none focus:border-primary disabled:opacity-75"
                    />
                  </div>
                </div>

                {/* Items Table (if purchase / invoice / sales) */}
                {itemsArray.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        Itens Extraídos ({itemsArray.length})
                      </span>
                      {isEditing && (
                        <button
                          onClick={handleAddItem}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Adicionar Item
                        </button>
                      )}
                    </div>

                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                          <tr>
                            <th className="p-2.5">Descrição</th>
                            <th className="p-2.5 w-20 text-center">Qtd</th>
                            <th className="p-2.5 w-24 text-right">Preço Unit</th>
                            <th className="p-2.5 w-24 text-right">Total</th>
                            {isEditing && <th className="p-2.5 w-10"></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {itemsArray.map((it: any, idx: number) => (
                            <tr key={idx} className="hover:bg-muted/20">
                              <td className="p-2">
                                <input
                                  type="text"
                                  disabled={!isEditing}
                                  value={it.name || it.product || it.description || ""}
                                  onChange={(e) =>
                                    handleItemChange(idx, "name", e.target.value)
                                  }
                                  className="w-full bg-transparent px-1.5 py-1 rounded border border-transparent focus:border-border disabled:border-transparent text-foreground"
                                />
                              </td>
                              <td className="p-2 text-center">
                                <input
                                  type="number"
                                  disabled={!isEditing}
                                  value={it.quantity ?? 1}
                                  onChange={(e) =>
                                    handleItemChange(idx, "quantity", Number(e.target.value))
                                  }
                                  className="w-full text-center bg-transparent px-1.5 py-1 rounded border border-transparent focus:border-border disabled:border-transparent text-foreground"
                                />
                              </td>
                              <td className="p-2 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  disabled={!isEditing}
                                  value={it.unit_price ?? 0}
                                  onChange={(e) =>
                                    handleItemChange(idx, "unit_price", Number(e.target.value))
                                  }
                                  className="w-full text-right bg-transparent px-1.5 py-1 rounded border border-transparent focus:border-border disabled:border-transparent text-foreground"
                                />
                              </td>
                              <td className="p-2 text-right font-semibold text-foreground">
                                {fmtBRL(Number(it.total_price || 0))}
                              </td>
                              {isEditing && (
                                <td className="p-2 text-center">
                                  <button
                                    onClick={() => handleRemoveItem(idx)}
                                    className="text-red-400 hover:text-red-500 p-1 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Warnings / Notes */}
                {Array.isArray(item.provider_metadata?.warnings) &&
                  item.provider_metadata.warnings.length > 0 && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
                      <div className="font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        Avisos e Validações:
                      </div>
                      <ul className="list-disc pl-5 space-y-0.5">
                        {item.provider_metadata.warnings.map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* Applied Entity Info if Approved */}
                {isApproved && item.applied_entity_id && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                    <span className="font-semibold">Registro Aplicado com Sucesso:</span>{" "}
                    Entidade: <code className="font-mono">{item.applied_entity_type}</code> (ID:{" "}
                    <code className="font-mono">{item.applied_entity_id}</code> em{" "}
                    {new Date(item.applied_at || item.updated_at).toLocaleString("pt-BR")})
                  </div>
                )}
              </div>
            </>
          ) : (
            /* AUDIT LOGS TAB */
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                Histórico e Auditoria de Ações
              </h3>

              {loadingLogs ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Carregando histórico...
                </div>
              ) : logs.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum log registrado para este item.
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-lg bg-muted/30 border border-border/60 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-foreground">
                        <span className="font-semibold capitalize">
                          {log.action.replace(/_/g, " ")}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(log.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        Responsável: <span className="text-foreground">{log.performer_name || "Sistema"}</span>{" "}
                        ({log.automatic ? "Automático" : "Manual"})
                      </div>
                      {log.new_data && (
                        <pre className="mt-1.5 p-2 rounded bg-background border border-border font-mono text-[11px] overflow-x-auto text-muted-foreground">
                          {JSON.stringify(log.new_data, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="px-6 py-4 border-t border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              disabled={reprocessing}
              onClick={handleReprocess}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reprocessing ? "animate-spin" : ""}`} />
              {reprocessing ? "Reprocessando..." : "Reprocessar"}
            </button>

            {isPending && (
              <button
                disabled={rejecting}
                onClick={handleReject}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-xs font-semibold text-red-400 transition-all cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Descartar
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isEditing && (
              <button
                disabled={saving}
                onClick={handleSaveEdits}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-card border border-primary text-primary hover:bg-primary/10 text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Salvando..." : "Salvar Edições"}
              </button>
            )}

            {isPending && (
              <button
                disabled={approving}
                onClick={handleApprove}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {approving ? "Aprovando no Backend..." : "Aprovar e Integrar"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
