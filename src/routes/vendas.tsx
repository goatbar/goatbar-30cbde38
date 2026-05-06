import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatCard, SectionCard, PrimaryButton, GhostButton, StatusBadge } from "@/components/ui-bits";
import { fmtBRL } from "@/lib/format";
import { Plus, ShoppingBag, TrendingUp, X, Users, Utensils, Calendar, Calculator, Trash2 } from "lucide-react";
import { useState, useMemo } from "react";
import { useAppStore } from "@/lib/app-store";
import { drinks as allDrinks, calcularOrcamentoEvento, type SalesSessionItem, type FinancialSession } from "@/lib/mock-data";

export const Route = createFileRoute("/vendas")({ component: () => <AppShell><VendasPage /></AppShell> });

function VendasPage() {
  const { financialSessions, addFinancialSession, deleteFinancialSession, eventos, eventContracts } = useAppStore();
  const [activeTab, setActiveTab] = useState<"Goat Botequim" | "7Steakhouse" | "Eventos" | "Consolidação">("Goat Botequim");
  const [showModal, setShowModal] = useState(false);
  
  // Modal states
  const [modalDate, setModalDate] = useState(new Date().toISOString().split("T")[0]);
  const [modalItems, setModalItems] = useState<SalesSessionItem[]>([]);
  const [maoDeObraValor, setMaoDeObraValor] = useState(0);
  const [maoDeObraQtd, setMaoDeObraQtd] = useState(0);
  const [custosDetalhes, setCustosDetalhes] = useState<{descricao: string, valor: number}[]>([]);

  // --- Helpers for Modal ---
  const activeModalityKey = useMemo(() => {
    if (activeTab === "7Steakhouse") return "steakhouse";
    if (activeTab === "Goat Botequim") return "goatbotequim";
    return "evento";
  }, [activeTab]);

  const filteredDrinks = useMemo(() => {
    const key = activeModalityKey as "steakhouse" | "goatbotequim" | "evento";
    return allDrinks.filter(d => d.modalityConfig?.[key]?.active);
  }, [activeModalityKey]);

  const addItem = () => {
    const firstDrink = filteredDrinks[0] || allDrinks[0];
    const key = activeModalityKey as "steakhouse" | "goatbotequim" | "evento";
    const config = firstDrink.modalityConfig?.[key];
    
    setModalItems([...modalItems, { 
      drinkId: firstDrink.id, 
      nome: firstDrink.nome, 
      quantidade: 1, 
      precoUnitario: config?.price || 0, 
      custoUnitario: config?.cost || 0 
    }]);
  };

  const removeItem = (index: number) => {
    setModalItems(modalItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof SalesSessionItem, value: any) => {
    const newItems = [...modalItems];
    if (field === "drinkId") {
      const d = allDrinks.find(x => x.id === value);
      if (d) {
        const key = activeModalityKey as "steakhouse" | "goatbotequim" | "evento";
        const config = d.modalityConfig?.[key];
        newItems[index] = {
          ...newItems[index],
          drinkId: d.id,
          nome: d.nome,
          precoUnitario: config?.price || 0,
          custoUnitario: config?.cost || 0
        };
      }
    } else {
      (newItems[index] as any)[field] = value;
    }
    setModalItems(newItems);
  };

  const handleSave = () => {
    if (activeTab === "Eventos" || activeTab === "Consolidação") return;
    
    const reposicaoTotal = custosDetalhes.reduce((a, c) => a + c.valor, 0);

    addFinancialSession({
      data: modalDate,
      modalidade: activeTab,
      items: modalItems,
      maoDeObraValor,
      maoDeObraQtd,
      reposicaoRestaurante: activeTab === "7Steakhouse" ? reposicaoTotal : undefined,
      custosRestauranteDetalhes: activeTab === "7Steakhouse" ? custosDetalhes : undefined,
    });
    
    setShowModal(false);
    // Reset
    setModalItems([]);
    setMaoDeObraValor(0);
    setMaoDeObraQtd(0);
    setCustosDetalhes([]);
  };

  // --- Calculations ---
  
  // Filtered sessions
  const sessions = financialSessions.filter(s => s.modalidade === activeTab);

  // Event calculations
  const eventosValidos = useMemo(() => {
    return eventos.filter(e => {
      const contrato = eventContracts.find(ec => ec.eventId === e.id);
      const isFechado = ["confirmado", "realizado", "proposta_aceita"].includes(e.status);
      const isAssinado = contrato?.status === "assinado";
      return isFechado && isAssinado;
    });
  }, [eventos, eventContracts]);

  const statsBotequim = useMemo(() => {
    const list = financialSessions.filter(s => s.modalidade === "Goat Botequim");
    const receitaBruta = list.reduce((acc, s) => acc + s.items.reduce((sum, item) => sum + (item.precoUnitario * item.quantidade), 0), 0);
    const custoDrinks = list.reduce((acc, s) => acc + s.items.reduce((sum, item) => sum + (item.custoUnitario * item.quantidade), 0), 0);
    const resultadoLiquido = receitaBruta - custoDrinks;
    const repasse = resultadoLiquido * 0.4;
    const saldoAposRepasse = resultadoLiquido * 0.6;
    const maoDeObra = list.reduce((acc, s) => acc + (s.maoDeObraValor * s.maoDeObraQtd), 0);
    const lucroFinal = saldoAposRepasse - maoDeObra;

    return { receitaBruta, custoDrinks, resultadoLiquido, repasse, maoDeObra, lucroFinal };
  }, [financialSessions]);

  const statsSteakhouse = useMemo(() => {
    const list = financialSessions.filter(s => s.modalidade === "7Steakhouse");
    const receitaBruta = list.reduce((acc, s) => acc + s.items.reduce((sum, item) => sum + (item.precoUnitario * item.quantidade), 0), 0);
    const custoDrinks = list.reduce((acc, s) => acc + s.items.reduce((sum, item) => sum + (item.custoUnitario * item.quantidade), 0), 0);
    const resultadoLiquido = receitaBruta - custoDrinks;
    const repasseRestaurante = resultadoLiquido * 0.5;
    const saldoAposRepasse = resultadoLiquido * 0.5;
    const maoDeObra = list.reduce((acc, s) => acc + (s.maoDeObraValor * s.maoDeObraQtd), 0);
    const reposicaoTotal = list.reduce((acc, s) => acc + (s.reposicaoRestaurante || 0), 0);
    const lucroFinal = saldoAposRepasse - maoDeObra - reposicaoTotal;

    return { receitaBruta, custoDrinks, resultadoLiquido, repasseRestaurante, saldoAposRepasse, maoDeObra, reposicaoTotal, lucroFinal };
  }, [financialSessions]);

  const statsEventos = useMemo(() => {
    const results = eventosValidos.map(e => calcularOrcamentoEvento(e));
    const receita = results.reduce((acc, r) => acc + r.valorTotalOrcamento, 0);
    const custos = results.reduce((acc, r) => acc + r.custoTotalOrcamento, 0);
    const lucro = results.reduce((acc, r) => acc + r.lucro, 0);

    return { receita, custos, lucro };
  }, [eventosValidos]);

  return (
    <>
      <PageHeader
        title="Operações Financeiras"
        subtitle="Controle de vendas, custos e resultados por modalidade."
        action={
          (activeTab === "Goat Botequim" || activeTab === "7Steakhouse") && (
            <PrimaryButton onClick={() => {
              setModalItems([]);
              setShowModal(true);
            }}>
              <Plus className="h-4 w-4" /> Lançar Sessão
            </PrimaryButton>
          )
        }
      />

      <div className="px-8 py-7 space-y-7">
        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-surface border border-border rounded-xl w-fit">
          {(["Goat Botequim", "7Steakhouse", "Eventos", "Consolidação"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* --- GOAT BOTEQUIM --- */}
        {activeTab === "Goat Botequim" && (
          <div className="space-y-7">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <StatCard label="Receita Bruta" value={fmtBRL(statsBotequim.receitaBruta)} />
              <StatCard label="Custo Drinks" value={fmtBRL(statsBotequim.custoDrinks)} />
              <StatCard label="Res. Líquido" value={fmtBRL(statsBotequim.resultadoLiquido)} />
              <StatCard label="Repasse (40%)" value={fmtBRL(statsBotequim.repasse)} />
              <StatCard label="Mão de Obra" value={fmtBRL(statsBotequim.maoDeObra)} />
              <StatCard label="Lucro Final" value={fmtBRL(statsBotequim.lucroFinal)} highlight />
            </div>

            <SectionCard title="Sessões Lançadas" subtitle="Histórico de vendas consolidadas por dia">
              <div className="space-y-4">
                {sessions.map(s => (
                  <SessionRow key={s.id} session={s} onDelete={() => deleteFinancialSession(s.id)} />
                ))}
                {sessions.length === 0 && <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl">Nenhuma sessão lançada.</div>}
              </div>
            </SectionCard>
          </div>
        )}

        {/* --- STEAKHOUSE --- */}
        {activeTab === "7Steakhouse" && (
          <div className="space-y-7">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <StatCard label="Receita Bruta" value={fmtBRL(statsSteakhouse.receitaBruta)} />
              <StatCard label="Custo Drinks" value={fmtBRL(statsSteakhouse.custoDrinks)} />
              <StatCard label="Lucro Bruto" value={fmtBRL(statsSteakhouse.resultadoLiquido)} />
              <StatCard label="Repasse 50%" value={fmtBRL(statsSteakhouse.repasseRestaurante)} />
              <StatCard label="Custos Oper." value={fmtBRL(statsSteakhouse.maoDeObra + statsSteakhouse.reposicaoTotal)} />
              <StatCard label="Lucro Final" value={fmtBRL(statsSteakhouse.lucroFinal)} highlight />
            </div>

            <SectionCard title="Sessões Semanais Lançadas" subtitle="Vendas diárias agregadas por semana (Quinta a Domingo)">
              <div className="space-y-4">
                {sessions.map(s => (
                  <SessionRow key={s.id} session={s} onDelete={() => deleteFinancialSession(s.id)} />
                ))}
                {sessions.length === 0 && <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl">Nenhuma sessão lançada.</div>}
              </div>
            </SectionCard>
          </div>
        )}

        {/* --- EVENTOS --- */}
        {activeTab === "Eventos" && (
          <div className="space-y-7">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <StatCard label="Receita Total" value={fmtBRL(statsEventos.receita)} />
              <StatCard label="Custos Totais" value={fmtBRL(statsEventos.custos)} />
              <StatCard label="Lucro Acumulado" value={fmtBRL(statsEventos.lucro)} highlight />
            </div>

            <SectionCard title="Eventos Integrados" subtitle="Apenas eventos fechados e com contrato assinado">
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-y border-border">
                      <th className="px-6 py-3 label-eyebrow">Evento</th>
                      <th className="px-6 py-3 label-eyebrow">Data</th>
                      <th className="px-6 py-3 label-eyebrow">Receita</th>
                      <th className="px-6 py-3 label-eyebrow">Custos</th>
                      <th className="px-6 py-3 label-eyebrow text-success">Lucro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventosValidos.map(e => {
                      const res = calcularOrcamentoEvento(e);
                      return (
                        <tr key={e.id} className="border-b border-border/60 hover:bg-surface/50 transition-colors">
                          <td className="px-6 py-4 font-medium">{e.nome}</td>
                          <td className="px-6 py-4 text-muted-foreground">{new Date(e.data).toLocaleDateString("pt-BR")}</td>
                          <td className="px-6 py-4">{fmtBRL(res.valorTotalOrcamento)}</td>
                          <td className="px-6 py-4 text-muted-foreground">{fmtBRL(res.custoTotalOrcamento)}</td>
                          <td className="px-6 py-4 text-success font-semibold">{fmtBRL(res.lucro)}</td>
                        </tr>
                      );
                    })}
                    {eventosValidos.length === 0 && (
                      <tr><td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">Nenhum evento qualificado para o financeiro.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        )}

        {/* --- CONSOLIDAÇÃO --- */}
        {activeTab === "Consolidação" && (
          <div className="space-y-7">
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <StatCard label="Receita Consolidada" value={fmtBRL(statsBotequim.receitaBruta + statsSteakhouse.receitaBruta + statsEventos.receita)} />
              <StatCard label="Custos Consolidados" value={fmtBRL(statsBotequim.custoDrinks + statsSteakhouse.custoDrinks + statsEventos.custos)} />
              <StatCard label="Lucro Total Goat Bar" value={fmtBRL(statsBotequim.lucroFinal + statsSteakhouse.lucroFinal + statsEventos.lucro)} highlight />
            </div>

            <SectionCard title="Distribuição por Modalidade" subtitle="Participação de cada unidade no lucro total">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SummaryCard label="Goat Botequim" value={statsBotequim.lucroFinal} color="bg-primary" icon={<ShoppingBag className="h-4 w-4" />} />
                <SummaryCard label="7Steakhouse" value={statsSteakhouse.lucroFinal} color="bg-success" icon={<Utensils className="h-4 w-4" />} />
                <SummaryCard label="Eventos" value={statsEventos.lucro} color="bg-amber-500" icon={<Calendar className="h-4 w-4" />} />
              </div>
            </SectionCard>
          </div>
        )}
      </div>

      {/* --- MODAL DE LANÇAMENTO --- */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl my-auto">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h2 className="font-display text-lg font-semibold">Lançar Sessão — {activeTab}</h2>
              <button onClick={() => setShowModal(false)} className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 transition-colors"><X className="h-4 w-4" /></button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Data */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-eyebrow block mb-2">{activeTab === "7Steakhouse" ? "Data Inicial da Semana (Ex: Quinta-feira)" : "Data da Operação"}</label>
                  <input
                    type="date"
                    value={modalDate}
                    onChange={e => setModalDate(e.target.value)}
                    className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <hr className="border-border" />

              {/* Lista de Drinks */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="label-eyebrow">Drinks Vendidos</label>
                  <GhostButton onClick={addItem} className="h-8 text-xs px-2"><Plus className="h-3 w-3 mr-1" /> Adicionar Drink</GhostButton>
                </div>
                <div className="space-y-2">
                  {modalItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        value={item.drinkId}
                        onChange={e => updateItem(idx, "drinkId", e.target.value)}
                        className="flex-1 h-9 px-3 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none"
                      >
                        {filteredDrinks.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={item.quantidade}
                        onChange={e => updateItem(idx, "quantidade", Number(e.target.value))}
                        className="w-20 h-9 px-3 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none"
                      />
                      <div className="w-24 text-right text-sm font-medium pr-2">
                        {fmtBRL(item.precoUnitario * item.quantidade)}
                      </div>
                      <button onClick={() => removeItem(idx)} className="h-9 w-9 flex items-center justify-center text-destructive hover:bg-destructive/10 rounded-md">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {modalItems.length === 0 && <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-lg">Nenhum drink lançado.</div>}
                </div>
              </div>

              <hr className="border-border" />

              {/* Mão de Obra */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-eyebrow block mb-2">Valor da Diária (R$)</label>
                  <input
                    type="number"
                    value={maoDeObraValor}
                    onChange={e => setMaoDeObraValor(Number(e.target.value))}
                    className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="label-eyebrow block mb-2">Qtd de Pessoas</label>
                  <input
                    type="number"
                    value={maoDeObraQtd}
                    onChange={e => setMaoDeObraQtd(Number(e.target.value))}
                    className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Steakhouse Specific */}
              {activeTab === "7Steakhouse" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="label-eyebrow block">Custos Repassados (Restaurante)</label>
                    <GhostButton onClick={() => setCustosDetalhes([...custosDetalhes, { descricao: "", valor: 0 }])} className="h-8 text-xs px-2"><Plus className="h-3 w-3 mr-1" /> Adicionar Custo</GhostButton>
                  </div>
                  <div className="space-y-2">
                    {custosDetalhes.map((c, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Ex: Frutas, Copos quebrados..."
                          value={c.descricao}
                          onChange={e => {
                            const arr = [...custosDetalhes];
                            arr[i].descricao = e.target.value;
                            setCustosDetalhes(arr);
                          }}
                          className="flex-1 h-9 px-3 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none"
                        />
                        <input
                          type="number"
                          placeholder="R$"
                          value={c.valor || ""}
                          onChange={e => {
                            const arr = [...custosDetalhes];
                            arr[i].valor = Number(e.target.value);
                            setCustosDetalhes(arr);
                          }}
                          className="w-28 h-9 px-3 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none"
                        />
                        <button onClick={() => setCustosDetalhes(custosDetalhes.filter((_, idx) => idx !== i))} className="h-9 w-9 flex items-center justify-center text-destructive hover:bg-destructive/10 rounded-md">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {custosDetalhes.length === 0 && <div className="text-[11px] text-muted-foreground italic mb-2">Nenhum custo listado. Adicione se houver.</div>}
                    {custosDetalhes.length > 0 && (
                      <div className="text-right text-sm font-bold pt-2">
                        Total Custos Restaurante: <span className="text-destructive">{fmtBRL(custosDetalhes.reduce((a, c) => a + c.valor, 0))}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border sticky bottom-0">
              <GhostButton onClick={() => setShowModal(false)}>Cancelar</GhostButton>
              <PrimaryButton onClick={handleSave}>Salvar Sessão</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SessionRow({ session, onDelete }: { session: FinancialSession; onDelete: () => void }) {
  const receita = session.items.reduce((a, b) => a + (b.precoUnitario * b.quantidade), 0);
  const custo = session.items.reduce((a, b) => a + (b.custoUnitario * b.quantidade), 0);
  const resLiq = receita - custo;
  
  let lucro = 0;
  if (session.modalidade === "Goat Botequim") {
    lucro = (resLiq * 0.6) - (session.maoDeObraValor * session.maoDeObraQtd);
  } else {
    lucro = (resLiq * 0.5) - (session.maoDeObraValor * session.maoDeObraQtd) - (session.reposicaoRestaurante || 0);
  }

  // Format date correctly based on modality
  let dateFormatted = "";
  if (session.modalidade === "7Steakhouse") {
    const startDate = new Date(session.data);
    startDate.setUTCHours(12); // avoid timezone bugs
    const endDate = new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000);
    dateFormatted = `Semana de ${startDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} a ${endDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
  } else {
    const d = new Date(session.data);
    d.setUTCHours(12);
    dateFormatted = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-background/40 hover:border-border-strong transition-all group">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Calculator className="h-5 w-5" />
        </div>
        <div>
          <div className="font-medium text-sm capitalize">{dateFormatted}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {session.items.length} drinks • Eqp: {session.maoDeObraQtd}x {fmtBRL(session.maoDeObraValor)}
            {session.modalidade === "7Steakhouse" && session.custosRestauranteDetalhes && session.custosRestauranteDetalhes.length > 0 && (
              <span className="ml-1 text-destructive/80">• Custos: {fmtBRL(session.reposicaoRestaurante || 0)}</span>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-6 w-full sm:w-auto">
        <div className="text-right">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Receita</div>
          <div className="text-sm font-medium">{fmtBRL(receita)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Lucro Final</div>
          <div className="text-sm font-bold text-success">{fmtBRL(lucro)}</div>
        </div>
        <button onClick={onDelete} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all shrink-0">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div className="p-5 rounded-2xl border border-border bg-surface/50">
      <div className="flex items-center gap-3 mb-4">
        <div className={`h-8 w-8 rounded-lg ${color} text-white flex items-center justify-center`}>
          {icon}
        </div>
        <div className="font-medium text-sm">{label}</div>
      </div>
      <div className="text-2xl font-bold font-display">{fmtBRL(value)}</div>
      <div className="mt-2 text-xs text-muted-foreground">Lucro líquido acumulado</div>
    </div>
  );
}
