import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SectionCard, StatusBadge, PrimaryButton, GhostButton } from "@/components/ui-bits";
import { drinks as allDrinks, calcularOrcamentoEvento, fmtBRL, fmtPct, type Evento, type EventoStatus } from "@/lib/mock-data";
import { Calendar, MapPin, Users, Phone, Mail, FileText, ClipboardCheck, Wine, ArrowLeft, Save, Plus, Trash2, Edit3, MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/app-store";

export const Route = createFileRoute("/eventos/$eventoId")({
  component: () => (
    <AppShell>
      <EventoInterna />
    </AppShell>
  ),
  loader: ({ params }) => {
    return { eventoId: params.eventoId };
  },
});

function EventoInterna() {
  const { eventoId } = Route.useLoaderData();
  const { eventos, updateEvento } = useAppStore();
  const eventoOriginal = eventos.find((x) => x.id === eventoId);

  if (!eventoOriginal) {
    return (
      <div className="p-12 text-center">
        <h2 className="font-display text-2xl">Evento não encontrado</h2>
        <Link to="/eventos" className="text-primary text-sm mt-3 inline-block">Voltar</Link>
      </div>
    );
  }

  const [draft, setDraft] = useState<Evento>(eventoOriginal);
  const [activeTab, setActiveTab] = useState("Orçamento");
  
  // Update draft if external change happens
  useEffect(() => {
    setDraft(eventoOriginal);
  }, [eventoOriginal]);

  const calc = calcularOrcamentoEvento(draft);

  const handleSave = () => {
    const changes: string[] = [];
    if (draft.convidados !== eventoOriginal.convidados) changes.push("Convidados");
    if (draft.drinksPorPessoa !== eventoOriginal.drinksPorPessoa) changes.push("Drinks por pessoa");
    if (draft.lucroDesejado !== eventoOriginal.lucroDesejado) changes.push("Lucro");
    // Simplified diff check
    const calcOrig = calcularOrcamentoEvento(eventoOriginal);
    
    let finalDraft = { ...draft };

    if (calc.valorTotalOrcamento !== calcOrig.valorTotalOrcamento) {
      finalDraft.historicoAlteracoes = [
        {
          data: new Date().toISOString(),
          usuario: "Usuário",
          camposAlterados: changes.length ? changes : ["Vários"],
          valorAntigo: fmtBRL(calcOrig.valorTotalOrcamento),
          valorNovo: fmtBRL(calc.valorTotalOrcamento),
        },
        ...finalDraft.historicoAlteracoes
      ];
    }

    updateEvento(eventoOriginal.id, finalDraft);
    window.alert("Orçamento salvo com sucesso!");
  };

  const handleStatusChange = (newStatus: EventoStatus, note?: string) => {
    const hist = [
      { data: new Date().toISOString(), status: newStatus, observacao: note || "Status alterado" },
      ...draft.historicoNegociacao
    ];
    setDraft(p => ({ ...p, status: newStatus, historicoNegociacao: hist }));
  };

  const toggleDrink = (id: string) => {
    setDraft(p => ({
      ...p,
      drinks: p.drinks.includes(id) ? p.drinks.filter(x => x !== id) : [...p.drinks, id]
    }));
  };

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link to="/eventos" className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
            <ArrowLeft className="h-3 w-3" /> Voltar
          </Link>
        }
        title={draft.nome}
        subtitle={`${draft.tipo} · Solicitação`}
        action={
          <div className="flex items-center gap-2">
            <PrimaryButton onClick={handleSave}>
              <Save className="h-4 w-4" /> Salvar Orçamento
            </PrimaryButton>
          </div>
        }
      />

      <div className="px-8 py-7 space-y-7 max-w-[1400px] mx-auto">
        
        {/* RESUMO FIXO TOP */}
        <div className="card-premium p-6 relative overflow-hidden bg-surface flex flex-wrap gap-8 justify-between items-center">
          <div className="flex gap-8">
            <Info icon={<Calendar className="h-4 w-4 text-primary" />} label="Data" value={draft.data ? new Date(draft.data).toLocaleDateString("pt-BR") : "A definir"} />
            <Info icon={<Users className="h-4 w-4 text-primary" />} label="Convidados" value={draft.convidados.toString()} />
            <Info icon={<MapPin className="h-4 w-4 text-primary" />} label="Local" value={draft.local || "A definir"} />
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="label-eyebrow">Valor Final</div>
              <div className="font-display text-2xl font-bold text-foreground">{fmtBRL(calc.valorTotalOrcamento)}</div>
            </div>
            <div className="text-right">
              <div className="label-eyebrow">Ticket Médio</div>
              <div className="font-display text-2xl font-semibold text-muted-foreground">{fmtBRL(calc.mediaPorPessoa)}<span className="text-sm">/pax</span></div>
            </div>
            <div className="text-right">
              <div className="label-eyebrow mb-1">Status</div>
              <select 
                value={draft.status} 
                onChange={(e) => handleStatusChange(e.target.value as EventoStatus)}
                className="bg-primary/10 text-primary font-medium text-sm px-3 py-1.5 rounded-lg border-0 outline-none"
              >
                <option value="novo_orcamento">Novo orçamento</option>
                <option value="orcamento_enviado">Orçamento enviado</option>
                <option value="aguardando_retorno">Aguardando retorno</option>
                <option value="proposta_aceita">Proposta aceita</option>
                <option value="confirmado">Confirmado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="flex flex-wrap gap-2 border-b border-border">
          {["Orçamento", "Negociação & Pagamento", "Histórico"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* TAB ORÇAMENTO */}
        {activeTab === "Orçamento" && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-7">
            
            {/* Esquerda: Configurações */}
            <div className="xl:col-span-8 space-y-6">
              
              <SectionCard title="1. Drinks & Bebidas">
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label-eyebrow block mb-2">Drinks por pessoa</label>
                      <input type="number" value={draft.drinksPorPessoa} onChange={e => setDraft(p => ({...p, drinksPorPessoa: Number(e.target.value)}))} className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm" />
                    </div>
                    <div>
                      <label className="label-eyebrow block mb-2">Markup adicional (%)</label>
                      <input type="number" value={draft.markupAdicionalDrinks} onChange={e => setDraft(p => ({...p, markupAdicionalDrinks: Number(e.target.value)}))} className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="label-eyebrow block mb-2">Selecione os drinks ({draft.drinks.length} selecionados)</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto p-2 border border-border rounded-lg bg-background/30">
                      {allDrinks.map(d => (
                        <div key={d.id} onClick={() => toggleDrink(d.id)} className={`p-3 rounded-lg border text-sm cursor-pointer transition-all flex items-center justify-between ${draft.drinks.includes(d.id) ? "bg-primary/10 border-primary" : "bg-surface border-border hover:border-border-strong"}`}>
                          <span className="font-medium truncate">{d.nome}</span>
                          <span className="text-xs text-muted-foreground">{fmtBRL(d.custoUnitario)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-surface border border-border flex justify-between items-center">
                    <div>
                      <div className="text-xs text-muted-foreground">Média de custo: {fmtBRL(calc.mediaCustoDrinks)}</div>
                      <div className="text-xs text-muted-foreground">Custo base (Total): {fmtBRL(calc.custoBaseDrinks)}</div>
                    </div>
                    <div className="text-right">
                      <div className="label-eyebrow">Valor Drinks</div>
                      <div className="font-medium text-lg text-primary">{fmtBRL(calc.valorDrinksEvento)}</div>
                    </div>
                  </div>
                </div>
              </SectionCard>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SectionCard title="2. Equipe">
                  <div className="space-y-4">
                    {Object.entries(draft.equipe).map(([key, prof]) => (
                      <div key={key} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="text-xs text-muted-foreground capitalize block mb-1">{key} (Qtd)</label>
                          <input type="number" value={prof.qtd} onChange={e => setDraft(p => ({...p, equipe: { ...p.equipe, [key]: { ...prof, qtd: Number(e.target.value) }}}))} className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-muted-foreground block mb-1">Valor Unit. (R$)</label>
                          <input type="number" value={prof.valorUnitario} onChange={e => setDraft(p => ({...p, equipe: { ...p.equipe, [key]: { ...prof, valorUnitario: Number(e.target.value) }}}))} className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm" />
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 text-right font-medium text-primary border-t border-border/50">
                      Total Equipe: {fmtBRL(calc.valorEquipe)}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="3. Gelo & Viagem">
                  <div className="space-y-4">
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground block mb-1">Pacotes Gelo (Qtd)</label>
                        <input type="number" placeholder={`Sugerido: ${Math.ceil((draft.convidados/100)*35)}`} value={draft.gelo.pacotesOverride || ""} onChange={e => setDraft(p => ({...p, gelo: { ...p.gelo, pacotesOverride: e.target.value ? Number(e.target.value) : undefined }}))} className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm" />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground block mb-1">Valor Pct. (R$)</label>
                        <input type="number" value={draft.gelo.valorUnitario} onChange={e => setDraft(p => ({...p, gelo: { ...p.gelo, valorUnitario: Number(e.target.value) }}))} className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm" />
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t border-border/50">
                      <label className="flex items-center gap-2 text-sm font-medium mb-3 cursor-pointer">
                        <input type="checkbox" checked={draft.viagem.incluir} onChange={e => setDraft(p => ({...p, viagem: { ...p.viagem, incluir: e.target.checked }}))} className="rounded border-border" />
                        Incluir Viagem/Gasolina
                      </label>
                      {draft.viagem.incluir && (
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">Valor Gasolina (R$)</label>
                          <input type="number" value={draft.viagem.valor} onChange={e => setDraft(p => ({...p, viagem: { ...p.viagem, valor: Number(e.target.value) }}))} className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm" />
                        </div>
                      )}
                    </div>
                  </div>
                </SectionCard>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SectionCard title="4. Gastos Diversos">
                  <div className="space-y-3">
                    {draft.gastosDiversos.map((g, i) => (
                      <div key={g.id} className="flex gap-2">
                        <input type="text" value={g.descricao} onChange={e => {
                          const arr = [...draft.gastosDiversos];
                          arr[i].descricao = e.target.value;
                          setDraft(p => ({...p, gastosDiversos: arr}));
                        }} className="flex-1 h-9 px-3 rounded-md bg-input border border-border text-sm" placeholder="Ex: Copos" />
                        <input type="number" value={g.valor} onChange={e => {
                          const arr = [...draft.gastosDiversos];
                          arr[i].valor = Number(e.target.value);
                          setDraft(p => ({...p, gastosDiversos: arr}));
                        }} className="w-24 h-9 px-3 rounded-md bg-input border border-border text-sm" />
                        <button onClick={() => {
                          setDraft(p => ({...p, gastosDiversos: p.gastosDiversos.filter(x => x.id !== g.id)}));
                        }} className="h-9 w-9 flex items-center justify-center text-destructive hover:bg-destructive/10 rounded-md"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                    <GhostButton onClick={() => setDraft(p => ({...p, gastosDiversos: [...p.gastosDiversos, { id: `g${Date.now()}`, descricao: "", valor: 0 }]}))} className="w-full text-xs">
                      <Plus className="h-3 w-3" /> Adicionar Gasto
                    </GhostButton>
                    <div className="pt-2 text-right font-medium text-primary border-t border-border/50">
                      Total Diversos: {fmtBRL(calc.valorGastosDiversos)}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="5. Lucro">
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">Lucro fixo desejado na operação (R$)</label>
                    <input type="number" value={draft.lucroDesejado} onChange={e => setDraft(p => ({...p, lucroDesejado: Number(e.target.value)}))} className="w-full h-12 text-lg font-medium px-4 rounded-xl bg-input border border-border focus:border-primary text-primary" />
                  </div>
                </SectionCard>
              </div>

            </div>

            {/* Direita: Resumo */}
            <div className="xl:col-span-4">
              <div className="sticky top-6">
                <SectionCard title="Resumo do Orçamento" className="border-primary/20 shadow-xl shadow-primary/5">
                  <div className="space-y-4 text-sm">
                    <Row k="Drinks" v={fmtBRL(calc.valorDrinksEvento)} />
                    <Row k="Equipe" v={fmtBRL(calc.valorEquipe)} />
                    <Row k="Gelo" v={fmtBRL(calc.valorGelo)} />
                    {draft.viagem.incluir && <Row k="Gasolina" v={fmtBRL(calc.valorGasolina)} />}
                    {draft.gastosDiversos.length > 0 && <Row k="Diversos" v={fmtBRL(calc.valorGastosDiversos)} />}
                    <div className="border-t border-border/60 my-2" />
                    <Row k="Custo Total" v={fmtBRL(calc.custoTotalOrcamento)} />
                    <Row k="Lucro Adicionado" v={fmtBRL(calc.lucro)} highlight />
                    <div className="border-t border-border/60 my-2" />
                    <div className="flex justify-between items-end">
                      <span className="font-medium">Valor Final</span>
                      <span className="font-display text-2xl font-bold text-primary">{fmtBRL(calc.valorTotalOrcamento)}</span>
                    </div>
                    <div className="text-right text-xs text-muted-foreground mt-1">
                      Média: {fmtBRL(calc.mediaPorPessoa)} / pessoa
                    </div>
                  </div>
                  <PrimaryButton className="w-full mt-6" onClick={handleSave}>Salvar Orçamento</PrimaryButton>
                </SectionCard>
              </div>
            </div>

          </div>
        )}

        {/* TAB NEGOCIAÇÃO */}
        {activeTab === "Negociação & Pagamento" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
            <SectionCard title="Pagamento" subtitle="Controle de recebimento">
              <div className="space-y-4">
                <div>
                  <label className="label-eyebrow block mb-2">Forma de pagamento</label>
                  <input type="text" value={draft.pagamento.formaPagamento} onChange={e => setDraft(p => ({...p, pagamento: { ...p.pagamento, formaPagamento: e.target.value }}))} className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm" placeholder="Ex: 50% Pix / 50% Cartão" />
                </div>
                <div>
                  <label className="label-eyebrow block mb-2">Percentual Pago (%)</label>
                  <input type="number" max={100} min={0} value={draft.pagamento.percentualPago} onChange={e => setDraft(p => ({...p, pagamento: { ...p.pagamento, percentualPago: Number(e.target.value) }}))} className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm" />
                </div>
                <div className="p-4 rounded-lg bg-background/50 border border-border space-y-2 text-sm">
                  <Row k="Valor Total" v={fmtBRL(calc.valorTotalOrcamento)} />
                  <Row k="Valor Pago" v={fmtBRL(calc.valorPago)} highlight />
                  <Row k="Valor Pendente" v={fmtBRL(calc.valorPendente)} />
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <span className="text-xs text-muted-foreground">Status do Pagamento:</span>
                    <div className="font-medium">{calc.statusPagamento}</div>
                  </div>
                </div>
                <PrimaryButton onClick={handleSave} className="w-full">Salvar dados</PrimaryButton>
              </div>
            </SectionCard>

            <SectionCard title="Histórico de Negociação">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input type="text" id="noteInput" className="flex-1 h-10 px-4 rounded-lg bg-input border border-border text-sm" placeholder="Nova observação ou contato..." />
                  <PrimaryButton onClick={() => {
                    const input = document.getElementById("noteInput") as HTMLInputElement;
                    if(input.value) { handleStatusChange(draft.status, input.value); input.value = ""; }
                  }}><MessageCircle className="h-4 w-4" /></PrimaryButton>
                </div>
                <div className="space-y-3 mt-4 max-h-[400px] overflow-y-auto pr-2">
                  {draft.historicoNegociacao.map((n, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border bg-surface text-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium capitalize">{n.status.replace("_", " ")}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(n.data).toLocaleString("pt-BR")}</span>
                      </div>
                      <p className="text-muted-foreground">{n.observacao}</p>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {/* TAB HISTÓRICO */}
        {activeTab === "Histórico" && (
          <SectionCard title="Histórico de Alterações de Valor">
            <div className="space-y-4">
              {draft.historicoAlteracoes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma alteração de valor registrada.</p>}
              {draft.historicoAlteracoes.map((h, i) => (
                <div key={i} className="p-4 rounded-xl border border-border bg-surface flex flex-col sm:flex-row justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium mb-1">{new Date(h.data).toLocaleString("pt-BR")}</div>
                    <div className="text-xs text-muted-foreground">Campos alterados: {h.camposAlterados.join(", ")}</div>
                  </div>
                  <div className="flex items-center gap-3 bg-background/50 px-4 py-2 rounded-lg border border-border/50 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Anterior</div>
                      <div className="font-medium text-sm line-through opacity-60">{h.valorAntigo}</div>
                    </div>
                    <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180" />
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Novo</div>
                      <div className="font-medium text-sm text-primary">{h.valorNovo}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

      </div>
    </>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium text-sm">{value}</div>
      </div>
    </div>
  );
}

function Row({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className={`font-medium ${highlight ? "text-success font-semibold" : ""}`}>{v}</span>
    </div>
  );
}
