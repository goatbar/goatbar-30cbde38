import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useState, useEffect } from "react";
import { AIInboxItem } from "@/services/goat-ai/types";
import { goatAIService } from "@/services/goat-ai/goat-ai-service";
import { GoatAIInboxCard } from "@/components/goat-ai/GoatAIInboxCard";
import { GoatAIItemDetailsModal } from "@/components/goat-ai/GoatAIItemDetailsModal";
import { GoatAIManualTestModal } from "@/components/goat-ai/GoatAIManualTestModal";
import { GoatAIIntegrationsView } from "@/components/goat-ai/GoatAIIntegrationsView";
import {
  Sparkles,
  Inbox,
  Filter,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  History,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/goat-ai")({
  component: () => (
    <AppShell>
      <GoatAIPage />
    </AppShell>
  ),
});

function GoatAIPage() {
  const [activeTab, setActiveTab] = useState<"inbox" | "logs" | "integracoes">("inbox");
  const [items, setItems] = useState<AIInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [classificationFilter, setClassificationFilter] = useState("all");

  // Selected item for details modal
  const [selectedItem, setSelectedItem] = useState<AIInboxItem | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);

  // General audit logs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const loadInboxItems = async () => {
    try {
      setLoading(true);
      const data = await goatAIService.listInboxItems({
        status: statusFilter !== "all" ? statusFilter : undefined,
        classification: classificationFilter !== "all" ? classificationFilter : undefined,
      });
      setItems(data);
    } catch (err) {
      console.error("Erro ao carregar itens da caixa de entrada Goat AI:", err);
      toast.error("Erro ao carregar mensagens da Goat AI");
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      setLoadingLogs(true);
      const logs = await goatAIService.listActionLogs(100);
      setAuditLogs(logs);
    } catch (err) {
      console.error("Erro ao carregar logs gerais:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === "inbox") {
      loadInboxItems();
    } else if (activeTab === "logs") {
      loadAuditLogs();
    }
  }, [activeTab, statusFilter, classificationFilter]);

  const handleQuickApprove = async (item: AIInboxItem) => {
    try {
      const result = await goatAIService.approveItem(item.id);
      if (result.already_applied) {
        toast.info("Item já havia sido aplicado anteriormente.");
      } else {
        toast.success("Item aprovado com sucesso!");
      }
      loadInboxItems();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao aprovar item");
    }
  };

  const handleQuickReject = async (item: AIInboxItem) => {
    if (!confirm("Tem certeza que deseja descartar este item?")) return;
    try {
      await goatAIService.rejectItem(item.id);
      toast.success("Item descartado.");
      loadInboxItems();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao descartar item");
    }
  };

  // Filter items by search query
  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const raw = (item.raw_text || "").toLowerCase();
    const sender = (item.source_sender_name || "").toLowerCase();
    const eventName = (item.events?.event_name || item.events?.client_name || "").toLowerCase();
    const supplier = ((item.structured_data as any)?.supplier || (item.structured_data as any)?.supplier_name || "").toLowerCase();
    return raw.includes(q) || sender.includes(q) || eventName.includes(q) || supplier.includes(q);
  });

  const pendingCount = items.filter((i) => i.approval_status === "pending").length;

  return (
    <>
      <PageHeader
        breadcrumb="Inteligência Artificial"
        title="Goat AI"
        subtitle="Central de IA e Caixa de Entrada Operacional via WhatsApp & Gemini."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTestModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:brightness-110 text-primary-foreground text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nova Entrada de Teste
            </button>
          </div>
        }
      />

      <div className="space-y-6">
        {/* TOP TABS */}
        <div className="flex items-center gap-6 border-b border-border text-sm font-medium">
          <button
            onClick={() => setActiveTab("inbox")}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "inbox"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Inbox className="w-4 h-4" />
            Caixa de Entrada
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-black">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "logs"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="w-4 h-4" />
            Auditoria & Logs
          </button>

          <button
            onClick={() => setActiveTab("integracoes")}
            className={`py-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "integracoes"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Configurações de Integração
          </button>
        </div>

        {/* TAB 1: INBOX */}
        {activeTab === "inbox" && (
          <div className="space-y-4">
            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por texto, fornecedor, evento ou remetente..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="all">Todos os status</option>
                  <option value="needs_review">Precisa revisão</option>
                  <option value="processed">Processados</option>
                  <option value="received">Recebidos</option>
                </select>

                <select
                  value={classificationFilter}
                  onChange={(e) => setClassificationFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="all">Todas as categorias</option>
                  <option value="event_purchase">Compra de Evento</option>
                  <option value="sales_session">Sessão de Vendas</option>
                  <option value="operation_report">Relatório de Operação</option>
                  <option value="invoice">Nota Fiscal</option>
                  <option value="receipt">Comprovante</option>
                  <option value="expense">Despesa Geral</option>
                  <option value="event_note">Nota de Evento</option>
                </select>

                <button
                  onClick={loadInboxItems}
                  disabled={loading}
                  className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Recarregar"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* List */}
            {loading ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">Carregando mensagens da Central de IA...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-16 text-center rounded-2xl border border-dashed border-border bg-card/40 space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-foreground">Nenhuma mensagem encontrada</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Utilize o botão &ldquo;Nova Entrada de Teste&rdquo; para simular o envio de mensagens ou aguarde mensagens reais via WhatsApp.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => (
                  <GoatAIInboxCard
                    key={item.id}
                    item={item}
                    onSelect={(it) => setSelectedItem(it)}
                    onQuickApprove={handleQuickApprove}
                    onQuickReject={handleQuickReject}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: AUDIT LOGS */}
        {activeTab === "logs" && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                Trilha de Auditoria Geral (Goat AI)
              </h3>
              <button
                onClick={loadAuditLogs}
                disabled={loadingLogs}
                className="p-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? "animate-spin" : ""}`} />
              </button>
            </div>

            {loadingLogs ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Carregando histórico de auditoria...
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Nenhum log registrado até o momento.
              </div>
            ) : (
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-lg bg-muted/30 border border-border text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground capitalize">
                        {log.action.replace(/_/g, " ")}
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        {new Date(log.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      Responsável: <span className="text-foreground">{log.performer_name || "Sistema"}</span>{" "}
                      • Tipo: <span>{log.automatic ? "Automático" : "Manual"}</span>
                      {log.event_id && <span> • Evento ID: {log.event_id}</span>}
                    </div>
                    {log.new_data && (
                      <pre className="p-2 rounded bg-background border border-border font-mono text-[11px] overflow-x-auto text-muted-foreground">
                        {JSON.stringify(log.new_data, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: INTEGRATIONS */}
        {activeTab === "integracoes" && <GoatAIIntegrationsView />}
      </div>

      {/* MODALS */}
      {selectedItem && (
        <GoatAIItemDetailsModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onUpdated={() => {
            loadInboxItems();
            setSelectedItem(null);
          }}
        />
      )}

      {testModalOpen && (
        <GoatAIManualTestModal
          onClose={() => setTestModalOpen(false)}
          onCreated={loadInboxItems}
        />
      )}
    </>
  );
}
