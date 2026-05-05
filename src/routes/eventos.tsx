import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatCard, SectionCard, PrimaryButton, StatusBadge, GhostButton } from "@/components/ui-bits";
import { fmtBRL } from "@/lib/format";
import { Plus, Calendar, MapPin, Users, ChevronRight, X, AlertTriangle, LayoutGrid, List } from "lucide-react";
import { useState } from "react";
import { useAppStore } from "@/lib/app-store";
import { calcularOrcamentoEvento, type Evento } from "@/lib/mock-data";

export const Route = createFileRoute("/eventos")({ component: () => <AppShell><EventosPage /></AppShell> });

function EventosPage() {
  const { eventos, addEvento } = useAppStore();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState<"lista" | "calendario">("lista");
  const [form, setForm] = useState({ nome: "", telefone: "", email: "", tipo: "Casamento", data: "", local: "", cidade: "São Paulo", convidados: 100, observacoes: "" });

  const eventosAtivos = eventos.filter(e => !["cancelado", "proposta_recusada"].includes(e.status));
  const receitaEnviados = eventosAtivos.filter(e => ["orcamento_enviado", "aguardando_retorno", "em_assinatura"].includes(e.status)).reduce((a, e) => a + calcularOrcamentoEvento(e).valorTotalOrcamento, 0);
  const receitaConfirmados = eventosAtivos.filter(e => ["confirmado", "realizado", "proposta_aceita"].includes(e.status)).reduce((a, e) => a + calcularOrcamentoEvento(e).valorTotalOrcamento, 0);

  const mesmoDiaEventos = form.data ? eventos.filter(e => e.data === form.data && !["cancelado", "proposta_recusada"].includes(e.status)) : [];

  const handleCreate = () => {
    if (!form.nome || !form.data) return;
    const newId = `e${Date.now()}`;
    addEvento({
      ...form,
      id: newId,
      status: "novo_orcamento",
      drinks: [],
      drinksPorPessoa: 4,
      markupAdicionalDrinks: 0,
      equipe: { bartender: { qtd: 0, valorUnitario: 200 }, keeper: { qtd: 0, valorUnitario: 200 }, copeira: { qtd: 0, valorUnitario: 200 } },
      gelo: { valorUnitario: 6 },
      viagem: { incluir: false, valor: 0 },
      gastosDiversos: [],
      lucroDesejado: 0,
      pagamento: { formaPagamento: "", percentualPago: 0 },
      historicoAlteracoes: [],
      historicoNegociacao: [{ data: new Date().toISOString(), status: "novo_orcamento", observacao: "Orçamento criado." }],
      valorNegociado: 0,
      custoPrevisto: 0,
      horario: "19:00",
      cliente: form.nome,
    } as Evento);
    
    setShowModal(false);
    navigate({ to: "/eventos/$eventoId", params: { eventoId: newId } });
  };

  return (
    <>
      <PageHeader
        title="Eventos e Orçamentos"
        subtitle="Pipeline de operações e orçamentos."
        action={
          <PrimaryButton onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4" /> Novo orçamento
          </PrimaryButton>
        }
      />

      <div className="px-8 py-7 space-y-7">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
          <StatCard label="Total em pipeline" value={String(eventosAtivos.length)} />
          <StatCard label="Aguardando resposta" value={String(eventosAtivos.filter(e => e.status === "aguardando_retorno" || e.status === "orcamento_enviado").length)} />
          <StatCard label="Orçamentos enviados" value={fmtBRL(receitaEnviados)} />
          <StatCard label="Eventos confirmados" value={fmtBRL(receitaConfirmados)} />
        </div>

        <SectionCard 
          title="Pipeline de negociações" 
          subtitle={`${eventos.length} registros`}
          action={
            <div className="flex bg-background border border-border rounded-lg p-0.5">
              <button onClick={() => setViewMode("lista")} className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${viewMode === "lista" ? "bg-surface shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <List className="h-3.5 w-3.5" /> Lista
              </button>
              <button onClick={() => setViewMode("calendario")} className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${viewMode === "calendario" ? "bg-surface shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <LayoutGrid className="h-3.5 w-3.5" /> Calendário
              </button>
            </div>
          }
        >
          {viewMode === "lista" ? (
            <div className="space-y-2">
              {eventos.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento cadastrado. Crie o primeiro!</p>
              )}
              {eventos.map((e) => {
                const calc = calcularOrcamentoEvento(e);
                return (
                  <Link
                    key={e.id}
                    to="/eventos/$eventoId"
                    params={{ eventoId: e.id }}
                    className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-border-strong hover:bg-surface transition-all group"
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{e.nome}</div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {e.convidados} pessoas</span>
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {e.local || "A definir"}</span>
                        <span>{e.data ? new Date(e.data).toLocaleDateString("pt-BR", {timeZone: "UTC"}) : "Data a definir"}</span>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-medium">{calc.valorTotalOrcamento > 0 ? fmtBRL(calc.valorTotalOrcamento) : "--"}</div>
                        <div className="text-[11px] text-muted-foreground">{calc.valorTotalOrcamento > 0 ? \`\${fmtBRL(calc.mediaPorPessoa)}/pessoa\` : "Orçamento em aberto"}</div>
                      </div>
                      <StatusBadge status={e.status} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <CalendarView eventosAtivos={eventosAtivos} />
          )}
        </SectionCard>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h2 className="font-display text-lg font-semibold">Novo orçamento</h2>
              <button onClick={() => setShowModal(false)} className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 transition-colors"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {mesmoDiaEventos.length > 0 && (
                <div className="p-4 rounded-lg bg-warning/10 border border-warning/20 text-warning flex gap-3 text-sm">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <div>
                    <div className="font-semibold">Atenção: já existe outro evento orçado ou confirmado para esta mesma data.</div>
                    <ul className="mt-2 list-disc list-inside space-y-1 opacity-80">
                      {mesmoDiaEventos.map(ev => (
                        <li key={ev.id}>{ev.nome} ({ev.local}) - {ev.status.replace("_", " ")}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {[
                { label: "Nome do solicitante", key: "nome", type: "text", placeholder: "Ex: João & Maria" },
                { label: "Contato (Telefone/WhatsApp)", key: "telefone", type: "tel", placeholder: "(11) 99999-9999" },
                { label: "E-mail (opcional)", key: "email", type: "email", placeholder: "cliente@email.com" },
                { label: "Data do evento", key: "data", type: "date", placeholder: "" },
                { label: "Local do evento", key: "local", type: "text", placeholder: "Nome do espaço (A definir)" },
                { label: "Cidade", key: "cidade", type: "text", placeholder: "São Paulo" },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="label-eyebrow block mb-2">{label}</label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={(form as any)[key]}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-full h-10 px-4 rounded-lg bg-input border border-border focus:border-primary focus:outline-none text-sm transition-colors"
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-eyebrow block mb-2">Qtd Convidados</label>
                  <input
                    type="number"
                    value={form.convidados}
                    onChange={(e) => setForm((p) => ({ ...p, convidados: Number(e.target.value) }))}
                    className="w-full h-10 px-4 rounded-lg bg-input border border-border focus:border-primary focus:outline-none text-sm transition-colors"
                  />
                </div>
                <div>
                  <label className="label-eyebrow block mb-2">Tipo</label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
                    className="w-full h-10 px-4 rounded-lg bg-input border border-border focus:border-primary focus:outline-none text-sm transition-colors"
                  >
                    {["Casamento", "Corporativo", "Aniversário", "Confraternização"].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label-eyebrow block mb-2">Observações gerais</label>
                <textarea
                  rows={3}
                  value={form.observacoes}
                  onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
                  placeholder="Detalhes iniciais do cliente..."
                  className="w-full px-4 py-3 rounded-lg bg-input border border-border focus:border-primary focus:outline-none text-sm transition-colors resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <GhostButton onClick={() => setShowModal(false)}>Cancelar</GhostButton>
              <PrimaryButton onClick={handleCreate} disabled={!form.nome || !form.data}>Avançar para orçamento</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CalendarView({ eventosAtivos }: { eventosAtivos: Evento[] }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const days = Array.from({ length: 42 }, (_, i) => {
    const dayNum = i - firstDay + 1;
    if (dayNum > 0 && dayNum <= daysInMonth) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      const dayEvents = eventosAtivos.filter(e => e.data === dateStr);
      return { dayNum, dateStr, events: dayEvents };
    }
    return null;
  });

  return (
    <div>
      <div className="mb-4 text-sm font-medium text-foreground">{new Date(year, month).toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}</div>
      <div className="grid grid-cols-7 gap-px bg-border border border-border rounded-xl overflow-hidden">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
          <div key={d} className="bg-surface py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
        ))}
        {days.map((d, i) => (
          <div key={i} className={`min-h-[120px] bg-background p-2 ${!d ? 'opacity-50 bg-background/50' : ''}`}>
            {d && (
              <>
                <div className={`text-xs font-medium mb-1 ${d.dayNum === today.getDate() ? 'text-primary' : 'text-muted-foreground'}`}>{d.dayNum}</div>
                <div className="space-y-1.5">
                  {d.events.map(e => {
                    const calc = calcularOrcamentoEvento(e);
                    return (
                      <Link key={e.id} to="/eventos/$eventoId" params={{eventoId: e.id}} className="block p-1.5 rounded border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer">
                        <div className="font-medium text-primary text-[11px] truncate leading-tight">{e.nome}</div>
                        <div className="text-[9px] text-muted-foreground mt-0.5 truncate flex justify-between">
                          <span>{e.status.replace(/_/g, " ")}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

