import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatCard, SectionCard, PrimaryButton, StatusBadge, GhostButton } from "@/components/ui-bits";
import { fmtBRL } from "@/lib/format";
import { Plus, Calendar, MapPin, Users, ChevronRight, X } from "lucide-react";
import { useState } from "react";
import { useAppStore } from "@/lib/app-store";

export const Route = createFileRoute("/eventos")({ component: () => <AppShell><EventosPage /></AppShell> });

function EventosPage() {
  const { eventos, addEvento } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nome: "", cliente: "", tipo: "Corporativo", data: "", local: "", cidade: "São Paulo", convidados: 100, valorNegociado: 10000, custoPrevisto: 4000, telefone: "", email: "", horario: "19:00", equipe: 5, observacoes: "" });

  const totalReceita = eventos.reduce((a, e) => a + e.valorNegociado, 0);
  const totalCusto = eventos.reduce((a, e) => a + e.custoPrevisto, 0);
  const confirmados = eventos.filter((e) => e.status === "confirmado" || e.status === "em_andamento").length;

  const handleCreate = () => {
    if (!form.nome || !form.cliente || !form.data) return;
    addEvento({ ...form, drinks: [], status: "rascunho", contratoId: undefined });
    setShowModal(false);
    setForm({ nome: "", cliente: "", tipo: "Corporativo", data: "", local: "", cidade: "São Paulo", convidados: 100, valorNegociado: 10000, custoPrevisto: 4000, telefone: "", email: "", horario: "19:00", equipe: 5, observacoes: "" });
  };

  return (
    <>
      <PageHeader
        title="Eventos"
        subtitle="Pipeline de operações e histórico de eventos."
        action={
          <PrimaryButton onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4" /> Novo evento
          </PrimaryButton>
        }
      />

      <div className="px-8 py-7 space-y-7">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <StatCard label="Total de eventos" value={String(eventos.length)} />
          <StatCard label="Receita prevista" value={fmtBRL(totalReceita)} />
          <StatCard label="Ativos / Confirmados" value={String(confirmados)} />
        </div>

        <SectionCard title="Pipeline de eventos" subtitle={`${eventos.length} registros`}>
          <div className="space-y-2">
            {eventos.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento cadastrado. Crie o primeiro!</p>
            )}
            {eventos.map((e) => (
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
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {e.convidados} convidados</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {e.cidade}</span>
                    <span>{new Date(e.data).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-medium">{fmtBRL(e.valorNegociado)}</div>
                    <div className="text-[11px] text-muted-foreground">lucro prev. {fmtBRL(e.valorNegociado - e.custoPrevisto)}</div>
                  </div>
                  <StatusBadge status={e.status} />
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h2 className="font-display text-lg font-semibold">Novo evento</h2>
              <button onClick={() => setShowModal(false)} className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 transition-colors"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {[
                { label: "Nome do evento", key: "nome", type: "text", placeholder: "Ex: Casamento João & Maria" },
                { label: "Cliente", key: "cliente", type: "text", placeholder: "Nome do cliente" },
                { label: "Data", key: "data", type: "date", placeholder: "" },
                { label: "Local", key: "local", type: "text", placeholder: "Nome do espaço" },
                { label: "Cidade", key: "cidade", type: "text", placeholder: "São Paulo" },
                { label: "Telefone", key: "telefone", type: "tel", placeholder: "(11) 99999-9999" },
                { label: "E-mail", key: "email", type: "email", placeholder: "cliente@email.com" },
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
                {[
                  { label: "Convidados", key: "convidados" },
                  { label: "Valor (R$)", key: "valorNegociado" },
                  { label: "Custo previsto (R$)", key: "custoPrevisto" },
                  { label: "Equipe", key: "equipe" },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="label-eyebrow block mb-2">{label}</label>
                    <input
                      type="number"
                      value={(form as any)[key]}
                      onChange={(e) => setForm((p) => ({ ...p, [key]: Number(e.target.value) }))}
                      className="w-full h-10 px-4 rounded-lg bg-input border border-border focus:border-primary focus:outline-none text-sm transition-colors"
                    />
                  </div>
                ))}
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
              <div>
                <label className="label-eyebrow block mb-2">Observações</label>
                <textarea
                  rows={3}
                  value={form.observacoes}
                  onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
                  placeholder="Detalhes da operação..."
                  className="w-full px-4 py-3 rounded-lg bg-input border border-border focus:border-primary focus:outline-none text-sm transition-colors resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <GhostButton onClick={() => setShowModal(false)}>Cancelar</GhostButton>
              <PrimaryButton onClick={handleCreate}>Criar evento</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
