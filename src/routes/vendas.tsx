import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatCard, SectionCard, PrimaryButton, GhostButton, StatusBadge } from "@/components/ui-bits";
import { fmtBRL } from "@/lib/format";
import { Plus, ShoppingBag, TrendingUp, X, Users, Utensils, Calendar, Calculator, Trash2, Pencil, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useAppStore } from "@/lib/app-store";
import { calcularOrcamentoEvento, type SalesSessionItem, type FinancialSession } from "@/lib/mock-data";
import { eventBudgetService } from "@/services/event-budget-service";
import { financialService } from "@/services/financial-service";
import { goatbarService } from "@/services/goatbar-service";
import { eventContractsService } from "@/services/contract-service";

export const Route = createFileRoute("/vendas")({ component: () => <AppShell><VendasPage /></AppShell> });

function VendasPage() {
  const { addFinancialSession, updateFinancialSession, deleteFinancialSession } = useAppStore();
  const [financialSessions, setFinancialSessions] = useState<any[]>([]);
  const [allDrinks, setAllDrinks] = useState<any[]>([]);
  const [eventosSupabase, setEventosSupabase] = useState<any[]>([]);
  const [contractsSupabase, setContractsSupabase] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"Goat Botequim" | "7Steakhouse" | "Eventos" | "Consolidação">("Goat Botequim");
  const [periodoDias, setPeriodoDias] = useState<number>(30);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [evs, sessions, drinksData, contracts] = await Promise.all([
        eventBudgetService.listEvents(),
        financialService.listSessions(),
        goatbarService.listDrinks(),
        eventContractsService.listAllContracts()
      ]);
      setEventosSupabase(evs || []);
      setFinancialSessions(sessions || []);
      setAllDrinks(drinksData || []);
      setContractsSupabase(contracts || []);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  
  const [modalDate, setModalDate] = useState(new Date().toISOString().split("T")[0]);
  const [modalItems, setModalItems] = useState<SalesSessionItem[]>([]);
  const [maoDeObraValor, setMaoDeObraValor] = useState(0);
  const [maoDeObraQtd, setMaoDeObraQtd] = useState(0);
  const [maoDeObraNomes, setMaoDeObraNomes] = useState("");
  const [maoDeObraDetalhes, setMaoDeObraDetalhes] = useState<{data: string, valor: number, qtdPessoas: number, nomes?: string}[]>([]);

  // --- Date Filters ---
  const limiteData = useMemo(() => {
    if (periodoDias === 0) return new Date(0); // All time
    if (periodoDias === -1) { // Este mês
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    if (periodoDias === -2) { // Mês anterior
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth() - 1, 1);
    }
    const d = new Date();
    d.setDate(d.getDate() - periodoDias);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [periodoDias]);

  const dataFim = useMemo(() => {
    if (periodoDias === -2) { // Mês anterior
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59);
    }
    return new Date(2100, 0, 1);
  }, [periodoDias]);

  // --- Filtered Data ---
  const filteredSessions = useMemo(() => {
    return financialSessions.filter(s => {
      const d = new Date(s.data).getTime();
      return d >= limiteData.getTime() && d <= dataFim.getTime();
    });
  }, [financialSessions, limiteData, dataFim]);

  const filteredEventos = useMemo(() => {
    return eventosSupabase.filter(e => {
      const eventDate = e.date || e.data;
      const d = new Date(eventDate || 0).getTime();
      return d >= limiteData.getTime() && d <= dataFim.getTime();
    });
  }, [eventosSupabase, limiteData, dataFim]);

  const activeModalityKey = useMemo(() => {
    if (activeTab === "7Steakhouse") return "steakhouse";
    if (activeTab === "Goat Botequim") return "goatbotequim";
    return "evento";
  }, [activeTab]);

  const filteredDrinks = useMemo(() => {
    const key = activeModalityKey as "steakhouse" | "goatbotequim" | "evento";
    return allDrinks
      .filter(d => d.modalityConfig?.[key]?.active)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [activeModalityKey, allDrinks]);

  const addItem = () => {
    const firstDrink = filteredDrinks[0] || allDrinks[0];
    const isSteak = activeTab === "7Steakhouse";
    const config = firstDrink.modalityConfig?.[activeModalityKey as "steakhouse" | "goatbotequim"];
    
    setModalItems([...modalItems, { 
      drinkId: firstDrink.id, 
      nome: firstDrink.nome, 
      quantidade: 1, 
      precoUnitario: config?.price || 0, 
      custoUnitario: config?.cost || 0,
      custoInsumo: isSteak ? firstDrink.custoUnitario : config?.cost
    }]);
  };

  const updateItem = (index: number, field: keyof SalesSessionItem, value: any) => {
    const newItems = [...modalItems];
    if (field === "drinkId") {
      const d = allDrinks.find(x => x.id === value);
      if (d) {
        const isSteak = activeTab === "7Steakhouse";
        const config = d.modalityConfig?.[activeModalityKey as "steakhouse" | "goatbotequim"];
        newItems[index] = {
          ...newItems[index],
          drinkId: d.id,
          nome: d.nome,
          precoUnitario: config?.price || 0,
          custoUnitario: config?.cost || 0,
          custoInsumo: isSteak ? d.custoUnitario : config?.cost
        };
      }
    } else {
      (newItems[index] as any)[field] = value;
    }
    setModalItems(newItems);
  };

  const generateSteakhouseDays = (startDateStr: string) => {
    const days = [];
    const baseDate = new Date(startDateStr);
    baseDate.setUTCHours(12);
    for (let i = 0; i < 4; i++) {
      const d = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
      days.push({ data: d.toISOString().split("T")[0], valor: 0, qtdPessoas: 1, nomes: "" });
    }
    return days;
  };

  const handleEditSession = (session: any) => {
    setEditingSessionId(session.id);
    setModalDate(session.data);
    setModalItems(JSON.parse(JSON.stringify(session.items)));
    setMaoDeObraValor(session.maoDeObraValor);
    setMaoDeObraQtd(session.maoDeObraQtd);
    setMaoDeObraNomes(session.maoDeObraNomes || "");
    setMaoDeObraDetalhes(session.maoDeObraDetalhes ? JSON.parse(JSON.stringify(session.maoDeObraDetalhes)) : []);
    setShowModal(true);
  };

  const handleSave = async () => {
    const modalityKey = activeTab === "7Steakhouse" ? "steakhouse" : "goatbotequim";
    const normalizedItems = modalItems.map((item) => {
      const drink = allDrinks.find((d) => d.id === item.drinkId);
      const cfg = drink?.modalityConfig?.[modalityKey];
      if (!drink || !cfg) return item;
      const custoInsumo = activeTab === "7Steakhouse" ? Number(drink.custoUnitario || 0) : Number(cfg.cost || 0);
      return {
        ...item,
        nome: drink.nome,
        precoUnitario: Number(cfg.price || 0),
        custoUnitario: Number(cfg.cost || 0),
        custoInsumo,
      };
    });

    const payload = {
      data: modalDate,
      modalidade: activeTab,
      items: normalizedItems,
      maoDeObraValor,
      maoDeObraQtd,
      maoDeObraNomes,
      maoDeObraDetalhes: activeTab === "7Steakhouse" ? maoDeObraDetalhes : undefined,
    };

    try {
       await financialService.createSession(payload);
       // Also update local store if still using it partially
       if (editingSessionId) {
         updateFinancialSession(editingSessionId, payload);
       } else {
         addFinancialSession(payload);
       }
       setShowModal(false);
       loadAllData();
    } catch (e) {
       // Fallback to local if Supabase fails (e.g. table doesn't exist)
       if (editingSessionId) {
         updateFinancialSession(editingSessionId, payload);
       } else {
         addFinancialSession(payload);
       }
       setShowModal(false);
       loadAllData();
    }
  };

  // --- Metrics ---
  const metrics = useMemo(() => {
    return financialService.calculateMetrics(filteredSessions, filteredEventos, allDrinks);
  }, [filteredSessions, filteredEventos, allDrinks]);

  const statsMensal = useMemo(() => {
    const meses: Record<string, { mes: string, receita: number, custos: number, lucro: number, bot: number, steak: number, event: number }> = {};
    
    filteredSessions.forEach(s => {
      const date = new Date(s.data);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!meses[key]) meses[key] = { mes: key, receita: 0, custos: 0, lucro: 0, bot: 0, steak: 0, event: 0 };
      
      const sessionReceita = (s.items || []).reduce((acc: number, item: any) => acc + (item.precoUnitario * item.quantidade), 0);
      const sessionCusto = (s.items || []).reduce((acc: number, item: any) => {
        // Usa o custoInsumo gravado no item, fallback para o custoUnitario base do drink
        if (item.custoInsumo !== undefined && item.custoInsumo !== null) {
          return acc + (item.custoInsumo * item.quantidade);
        }
        const d = allDrinks.find(x => x.id === item.drinkId);
        return acc + ((d?.custoUnitario || 0) * item.quantidade);
      }, 0);
      
      const maoDeObra = s.maoDeObraDetalhes && s.maoDeObraDetalhes.length > 0 
        ? s.maoDeObraDetalhes.reduce((a: number, b: any) => a + b.valor, 0)
        : (s.maoDeObraValor * s.maoDeObraQtd);

      if (s.modalidade === "Goat Botequim") {
        const resLiq = sessionReceita - sessionCusto;
        const sessionLucro = (resLiq * 0.6) - maoDeObra;
        meses[key].receita += sessionReceita;
        meses[key].custos += sessionCusto + (resLiq * 0.4) + maoDeObra;
        meses[key].lucro += sessionLucro;
        meses[key].bot += sessionLucro;
      } else {
        // Steakhouse: Receita para o Goat Bar é o custo do insumo (o que o restaurante paga)
        const receitaGoat = (s.items || []).reduce((acc: number, item: any) => acc + (Number(item.custoUnitario || 0) * item.quantidade), 0);
        const sessionLucro = (receitaGoat - sessionCusto) - maoDeObra;
        meses[key].receita += receitaGoat;
        meses[key].custos += sessionCusto + maoDeObra;
        meses[key].lucro += sessionLucro;
        meses[key].steak += sessionLucro;
      }
    });

    filteredEventos.forEach(e => {
      const s = e.status?.toUpperCase();
      if (!["CONFIRMADO", "FINALIZADO", "REALIZADO", "PROPOSTA_ACEITA"].includes(s)) return;

      const date = new Date(e.date || e.data || 0);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!meses[key]) meses[key] = { mes: key, receita: 0, custos: 0, lucro: 0, bot: 0, steak: 0, event: 0 };
      
      const receita = e.current_budget_value || 0;
      const lucro = e.current_profit_value || 0;
      meses[key].receita += receita;
      meses[key].custos += (receita - lucro);
      meses[key].lucro += lucro;
      meses[key].event += lucro;
    });

    return Object.values(meses).sort((a, b) => b.mes.localeCompare(a.mes));
  }, [filteredSessions, filteredEventos, allDrinks]);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Operações Financeiras"
        subtitle="Controle de vendas, custos e lucratividade operacional."
        periodo={
          <div className="relative">
            <select
              value={periodoDias}
              onChange={(e) => setPeriodoDias(Number(e.target.value))}
              className="appearance-none inline-flex items-center gap-2 pl-4 pr-10 py-2 rounded-lg border border-border bg-surface text-sm font-medium hover:border-border-strong transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value={30}>Últimos 30 dias</option>
              <option value={-1}>Este mês</option>
              <option value={-2}>Mês anterior</option>
              <option value={7}>Últimos 7 dias</option>
              <option value={90}>Últimos 90 dias</option>
              <option value={0}>Todo o período</option>
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none rotate-90" />
          </div>
        }
      />

      <div className="px-8 py-7 space-y-7">
        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-surface border border-border rounded-xl w-fit">
          {["Goat Botequim", "7Steakhouse", "Eventos", "Consolidação"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* --- GOAT BOTEQUIM --- */}
        {activeTab === "Goat Botequim" && (
          <div className="space-y-7">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <StatCard label="Receita Bruta" value={fmtBRL(metrics.bot.receita)} />
              <StatCard label="Custo Drinks" value={fmtBRL(metrics.bot.custo)} />
              <StatCard label="Resultado Líquido" value={fmtBRL(metrics.bot.receita - metrics.bot.custo)} />
              <StatCard label="Repasse (40%)" value={fmtBRL((metrics.bot.receita - metrics.bot.custo) * 0.4)} />
              <StatCard label="Mão de Obra" value={fmtBRL(filteredSessions.filter(s => s.modalidade === "Goat Botequim").reduce((acc, s) => {
                if (s.maoDeObraDetalhes && s.maoDeObraDetalhes.length > 0) {
                  return acc + s.maoDeObraDetalhes.reduce((a: number, b: any) => a + Number(b.valor || 0), 0);
                }
                return acc + (Number(s.maoDeObraValor || 0) * Number(s.maoDeObraQtd || 0));
              }, 0))} />
              <StatCard label="Lucro Final" value={fmtBRL(metrics.bot.lucro)} highlight />
            </div>

            <div className="flex justify-end">
              <PrimaryButton onClick={() => { setEditingSessionId(null); setModalItems([]); setModalDate(new Date().toISOString().split("T")[0]); setShowModal(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Lançar Sessão Botequim
              </PrimaryButton>
            </div>

            <SectionCard title="Sessões Lançadas" subtitle="Histórico de vendas consolidadas por dia">
              <div className="space-y-4">
                {filteredSessions.filter(s => s.modalidade === "Goat Botequim").map(s => (
                  <SessionRow key={s.id} session={s} onEdit={() => handleEditSession(s)} onDelete={() => deleteFinancialSession(s.id)} />
                ))}
                {filteredSessions.filter(s => s.modalidade === "Goat Botequim").length === 0 && <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl">Nenhuma sessão lançada.</div>}
              </div>
            </SectionCard>
          </div>
        )}

        {/* --- STEAKHOUSE --- */}
        {activeTab === "7Steakhouse" && (
          <div className="space-y-7">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <StatCard label="Receita Goatbar" value={fmtBRL(metrics.steak.receita)} />
              <StatCard label="Custo Insumos" value={fmtBRL(metrics.steak.custo)} />
              <StatCard label="Lucro Bruto" value={fmtBRL(metrics.steak.receita - metrics.steak.custo)} />
              <StatCard label="Lucro Retido Rest." value={fmtBRL(filteredSessions.filter(s => s.modalidade === "7Steakhouse").reduce((acc, s) => acc + (s.items || []).reduce((sum: number, item: any) => sum + ((item.precoUnitario - item.custoUnitario) * item.quantidade), 0), 0))} />
              <StatCard label="Mão de Obra" value={fmtBRL(filteredSessions.filter(s => s.modalidade === "7Steakhouse").reduce((acc, s) => acc + (s.maoDeObraDetalhes && s.maoDeObraDetalhes.length > 0 ? s.maoDeObraDetalhes.reduce((a: number, b: any) => a + Number(b.valor || 0), 0) : Number(s.maoDeObraValor || 0) * Number(s.maoDeObraQtd || 0)), 0))} />
              <StatCard label="Lucro F. Goatbar" value={fmtBRL(metrics.steak.lucro)} highlight />
            </div>

            <div className="flex justify-end">
              <PrimaryButton onClick={() => { setEditingSessionId(null); setModalItems([]); setModalDate(new Date().toISOString().split("T")[0]); setShowModal(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Lançar Semana Steakhouse
              </PrimaryButton>
            </div>

            <SectionCard title="Sessões Semanais Lançadas" subtitle="Vendas diárias agregadas por semana">
              <div className="space-y-4">
                {filteredSessions.filter(s => s.modalidade === "7Steakhouse").map(s => (
                  <SessionRow key={s.id} session={s} onEdit={() => handleEditSession(s)} onDelete={() => deleteFinancialSession(s.id)} />
                ))}
                {filteredSessions.filter(s => s.modalidade === "7Steakhouse").length === 0 && <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl">Nenhuma sessão lançada.</div>}
              </div>
            </SectionCard>
          </div>
        )}

        {/* --- EVENTOS --- */}
        {activeTab === "Eventos" && (
          <div className="space-y-7">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <StatCard label="Receita Total" value={fmtBRL(metrics.events.receita)} />
              <StatCard label="Custos Totais" value={fmtBRL(metrics.events.custo)} />
              <StatCard label="Lucro Acumulado" value={fmtBRL(metrics.events.lucro)} highlight />
            </div>

            <SectionCard title="Eventos Integrados" subtitle="Eventos confirmados e finalizados aparecem aqui automaticamente">
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
                    {filteredEventos.filter(e => ["CONFIRMADO", "FINALIZADO", "REALIZADO", "PROPOSTA_ACEITA"].includes(e.status?.toUpperCase())).map(e => {
                      const receita = e.current_budget_value || 0;
                      const lucro = e.current_profit_value || 0;
                      const custo = receita - lucro;
                      const contract = contractsSupabase.find(c => c.event_id === e.id);
                      const isSigned = contract?.status === "signed";
                      
                      return (
                        <tr key={e.id} className="border-b border-border/60 hover:bg-surface/50 transition-colors">
                          <td className="px-6 py-4 font-medium">
                            <div>{e.client_name || e.nome}</div>
                            <div className="mt-1">
                              {isSigned ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success text-[9px] font-bold uppercase tracking-widest border border-success/20">
                                  <CheckCircle2 className="h-2.5 w-2.5" /> Contrato Assinado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10 text-warning text-[9px] font-bold uppercase tracking-widest border border-warning/20">
                                  <AlertCircle className="h-2.5 w-2.5" /> Contrato Pendente
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">{e.date ? new Date(e.date).toLocaleDateString("pt-BR", {timeZone: "UTC"}) : "--"}</td>
                          <td className="px-6 py-4">{fmtBRL(receita)}</td>
                          <td className="px-6 py-4 text-muted-foreground">{fmtBRL(custo)}</td>
                          <td className="px-6 py-4 text-success font-semibold">{fmtBRL(lucro)}</td>
                        </tr>
                      );
                    })}
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
              <StatCard label="Receita Consolidada" value={fmtBRL(metrics.consolidated.receita)} />
              <StatCard label="Custos Consolidados" value={fmtBRL(metrics.consolidated.receita - metrics.consolidated.lucro)} />
              <StatCard label="Lucro Total Goat Bar" value={fmtBRL(metrics.consolidated.lucro)} highlight />
            </div>

            <SectionCard title="Evolução Mensal" subtitle="Resumo consolidado por mês de operação">
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-y border-border">
                      <th className="px-6 py-3 label-eyebrow">Mês</th>
                      <th className="px-6 py-3 label-eyebrow">Receita Consolidada</th>
                      <th className="px-6 py-3 label-eyebrow">Custos/Operação</th>
                      <th className="px-6 py-3 label-eyebrow text-success">Lucro Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statsMensal.map(m => {
                      const [year, month] = m.mes.split('-');
                      const date = new Date(Number(year), Number(month) - 1, 1);
                      const monthName = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                      return (
                        <tr key={m.mes} className="border-b border-border/60 hover:bg-surface/50 transition-colors">
                          <td className="px-6 py-4 font-medium capitalize">{monthName}</td>
                          <td className="px-6 py-4">{fmtBRL(m.receita)}</td>
                          <td className="px-6 py-4 text-muted-foreground">{fmtBRL(m.custos)}</td>
                          <td className="px-6 py-4 text-success font-semibold">{fmtBRL(m.lucro)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard title="Distribuição por Modalidade (Geral)" subtitle="Participação de cada unidade no lucro acumulado">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SummaryCard label="Goat Botequim" value={metrics.bot.lucro} color="bg-primary" icon={<ShoppingBag className="h-4 w-4" />} />
                <SummaryCard label="7Steakhouse" value={metrics.steak.lucro} color="bg-success" icon={<Utensils className="h-4 w-4" />} />
                <SummaryCard label="Eventos" value={metrics.events.lucro} color="bg-amber-500" icon={<Calendar className="h-4 w-4" />} />
              </div>
            </SectionCard>
          </div>
        )}
      </div>

      {/* --- MODAL --- */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-display text-lg font-semibold">{editingSessionId ? "Editar Sessão" : "Lançar Sessão"} — {activeTab}</h2>
              <button onClick={() => setShowModal(false)} className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40"><X className="h-4 w-4" /></button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="label-eyebrow block mb-2">Data da Operação</label>
                <input type="date" value={modalDate} onChange={e => setModalDate(e.target.value)} className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm" />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="label-eyebrow">Drinks Vendidos</label>
                  <GhostButton onClick={addItem} className="h-8 text-xs"><Plus className="h-3 w-3 mr-1" /> Adicionar</GhostButton>
                </div>
                {modalItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select value={item.drinkId} onChange={e => updateItem(idx, "drinkId", e.target.value)} className="flex-1 h-10 px-3 rounded-lg bg-input border border-border text-sm">
                      {filteredDrinks.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                    </select>
                    <input type="number" value={item.quantidade} onChange={e => updateItem(idx, "quantidade", Number(e.target.value))} className="w-20 h-10 px-3 rounded-lg bg-input border border-border text-sm" />
                  </div>
                ))}
              </div>

              {activeTab === "7Steakhouse" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="label-eyebrow">Mão de Obra Detalhada (Semanal)</label>
                    <GhostButton onClick={() => setMaoDeObraDetalhes(generateSteakhouseDays(modalDate))} className="h-8 text-[10px] uppercase font-bold">Gerar Dias</GhostButton>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {maoDeObraDetalhes.map((d, i) => (
                      <div key={i} className="p-3 rounded-xl border border-border bg-background/40 space-y-2">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase">{new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR', {weekday: 'long', day: '2-digit', month: '2-digit'})}</div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-[8px] uppercase text-muted-foreground block mb-1">Valor</label>
                            <input type="number" value={d.valor} onChange={e => {
                              const newD = [...maoDeObraDetalhes];
                              newD[i].valor = Number(e.target.value);
                              setMaoDeObraDetalhes(newD);
                            }} className="w-full h-8 px-2 rounded bg-input border border-border text-xs" />
                          </div>
                          <div className="flex-1">
                            <label className="text-[8px] uppercase text-muted-foreground block mb-1">Pessoas</label>
                            <input type="number" value={d.qtdPessoas} onChange={e => {
                              const newD = [...maoDeObraDetalhes];
                              newD[i].qtdPessoas = Number(e.target.value);
                              setMaoDeObraDetalhes(newD);
                            }} className="w-full h-8 px-2 rounded bg-input border border-border text-xs" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-eyebrow block mb-2">Custo Mão de Obra (Dia)</label>
                    <input type="number" value={maoDeObraValor} onChange={e => setMaoDeObraValor(Number(e.target.value))} className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm" />
                  </div>
                  <div>
                    <label className="label-eyebrow block mb-2">Qtd Dias/Equipe</label>
                    <input type="number" value={maoDeObraQtd} onChange={e => setMaoDeObraQtd(Number(e.target.value))} className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm" />
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-border flex justify-end gap-3">
              <GhostButton onClick={() => setShowModal(false)}>Cancelar</GhostButton>
              <PrimaryButton onClick={handleSave}>Salvar Lançamento</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SessionRow({ session, onEdit, onDelete }: { session: any; onEdit: () => void; onDelete: () => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isSteak = session.modalidade === "7Steakhouse";
  
  // Cálculos Básicos
  const items = session.items || [];

  // No print do usuário para Botequim:
  // Receita Bruta: R$ 627
  // Custo Drinks: R$ 125.96
  // Lucro Bruto: R$ 501.04
  // Repasse 40%: R$ 200.42
  // Saldo Goat: R$ 300.62
  // Mão de Obra: R$ 100
  // Lucro Final: R$ 200.62

  const calc = useMemo(() => {
    const rb = items.reduce((acc: number, i: any) => acc + (Number(i.precoUnitario || 0) * i.quantidade), 0);
    const rg = items.reduce((acc: number, i: any) => acc + (Number(i.custoUnitario || 0) * i.quantidade), 0);
    const ci = items.reduce((acc: number, i: any) => acc + (Number(i.custoInsumo || i.custoUnitario || 0) * i.quantidade), 0);
    
    const lb = rb - ci;
    const rep = lb * 0.4;
    const saldo = lb - rep;
    
    const mo = session.maoDeObraDetalhes && session.maoDeObraDetalhes.length > 0
      ? session.maoDeObraDetalhes.reduce((a: number, b: any) => a + Number(b.valor || 0), 0)
      : (Number(session.maoDeObraValor || 0) * Number(session.maoDeObraQtd || 0));

    return {
      receitaBruta: rb,
      receitaGoat: rg,
      custoInsumos: ci,
      lucroRetidoRest: rb - rg,
      lucroBruto: isSteak ? (rg - ci) : lb,
      repasse: rep,
      saldoGoat: saldo,
      maoDeObra: mo,
      lucroFinal: isSteak ? (rg - ci - mo) : (saldo - mo)
    };
  }, [session, isSteak]);

  return (
    <div className={`rounded-2xl border-2 transition-all duration-300 overflow-hidden ${isExpanded ? "border-primary bg-surface shadow-2xl shadow-primary/5" : "border-border bg-surface/40 hover:border-primary/30"}`}>
      {/* HEADER CARD */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-5 flex flex-col md:flex-row justify-between gap-4 items-start md:items-center cursor-pointer select-none"
      >
        <div className="flex items-center gap-4">
           <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-transform duration-500 ${isExpanded ? "bg-primary text-white scale-110" : "bg-background text-muted-foreground border border-border"}`}>
              {isSteak ? <Utensils className="h-6 w-6" /> : <ShoppingBag className="h-6 w-6" />}
           </div>
           <div>
              <div className="font-bold text-base flex items-center gap-2">
                 {new Date(session.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                 <ChevronRight className={`h-4 w-4 text-primary transition-transform duration-300 ${isExpanded ? "rotate-90" : ""}`} />
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-0.5">
                 {items.length} drinks · Eqp: {session.maoDeObraQtd}x {fmtBRL(session.maoDeObraValor)}
              </div>
           </div>
        </div>

        <div className="flex items-center gap-8 w-full md:w-auto">
           <div className="text-right">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-0.5">Receita</div>
              <div className="font-black text-sm">{fmtBRL(isSteak ? calc.receitaGoat : calc.receitaBruta)}</div>
           </div>
           <div className="text-right">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-0.5">Lucro Final</div>
              <div className="font-black text-sm text-success">{fmtBRL(calc.lucroFinal)}</div>
           </div>
           <div className="flex gap-2 ml-4">
              <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="h-9 w-9 rounded-lg flex items-center justify-center bg-background border border-border hover:border-primary hover:text-primary transition-all shadow-sm">
                 <Pencil className="h-4 w-4" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="h-9 w-9 rounded-lg flex items-center justify-center bg-background border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all shadow-sm">
                 <Trash2 className="h-4 w-4" />
              </button>
           </div>
        </div>
      </div>

      {/* EXPANDED CONTENT */}
      {isExpanded && (
        <div className="px-5 pb-6 animate-in slide-in-from-top-2 duration-300">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 pt-6 border-t border-border/50">
              
              {/* COLUNA ESQUERDA: ITENS VENDIDOS */}
              <div className="space-y-4">
                 <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Itens Vendidos</h4>
                 <div className="space-y-3">
                    {items.map((it: any, i: number) => (
                      <div key={i} className="flex justify-between items-center text-xs group/item">
                         <div className="flex items-center gap-2">
                            <span className="font-black text-primary w-6">{it.quantidade}x</span>
                            <span className="font-medium text-foreground/80">{it.nome}</span>
                         </div>
                         <div className="font-bold text-muted-foreground group-hover/item:text-foreground transition-colors">
                            {fmtBRL(it.precoUnitario * it.quantidade)}
                         </div>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-border/40 flex justify-between items-center">
                       <span className="text-[10px] font-bold text-muted-foreground uppercase">Total Receita</span>
                       <span className="font-black text-sm">{fmtBRL(isSteak ? calc.receitaGoat : calc.receitaBruta)}</span>
                    </div>
                 </div>
              </div>

              {/* COLUNA DIREITA: CÁLCULO DE LUCRO */}
              <div className="space-y-4">
                 <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Cálculo de Lucro</h4>
                 <div className="bg-background/40 rounded-2xl p-5 border border-border/50 space-y-4">
                    
                    <div className="space-y-2">
                       <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Receita Bruta</span>
                          <span className="font-bold">{fmtBRL(isSteak ? calc.receitaGoat : calc.receitaBruta)}</span>
                       </div>
                       <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">(-) {isSteak ? "Custo Insumos (Produção)" : "Custo dos Drinks"}</span>
                          <span className="text-muted-foreground">{fmtBRL(calc.custoInsumos)}</span>
                       </div>
                       <div className="flex justify-between text-sm pt-2 border-t border-border/20">
                          <span className="font-bold">(=) Lucro Bruto</span>
                          <span className="font-black">{fmtBRL(calc.lucroBruto)}</span>
                       </div>
                    </div>

                    {isSteak && (
                      <div className="space-y-2">
                         <div className="flex justify-between text-xs">
                            <span className="text-warning font-medium">Lucro Retido (Restaurante)</span>
                            <span className="text-warning font-bold">{fmtBRL(calc.lucroRetidoRest)}</span>
                         </div>
                      </div>
                    )}

                    {!isSteak && (
                      <div className="space-y-2">
                         <div className="flex justify-between text-xs">
                            <span className="text-warning font-medium">(-) Repasse 40% Restaurante</span>
                            <span className="text-warning font-bold">{fmtBRL(calc.repasse)}</span>
                         </div>
                         <div className="flex justify-between text-xs pt-1">
                            <span className="font-bold text-foreground/70">(=) Saldo Operacional (GoatBar)</span>
                            <span className="font-bold">{fmtBRL(calc.saldoGoat)}</span>
                         </div>
                      </div>
                    )}

                    <div className="space-y-2">
                       <div className="flex justify-between text-xs">
                          <span className="text-destructive font-medium">(-) Mão de Obra {isSteak ? "Semanal" : "do Dia"}</span>
                          <span className="text-destructive font-bold">{fmtBRL(calc.maoDeObra)}</span>
                       </div>
                    </div>

                    <div className="pt-4 border-t border-primary/20 flex justify-between items-end">
                       <div>
                          <div className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Lucro Final</div>
                          <div className="text-2xl font-black font-display text-success">{fmtBRL(calc.lucroFinal)}</div>
                       </div>
                       <div className="pb-1">
                          <div className={`h-2 w-2 rounded-full bg-success animate-pulse`} />
                       </div>
                    </div>

                 </div>
              </div>

           </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div className="p-5 rounded-2xl border border-border bg-surface/50">
      <div className="flex items-center gap-3 mb-4">
        <div className={`h-8 w-8 rounded-lg ${color} text-white flex items-center justify-center`}>{icon}</div>
        <div className="font-medium text-sm">{label}</div>
      </div>
      <div className="text-2xl font-bold font-display">{fmtBRL(value)}</div>
      <div className="mt-2 text-xs text-muted-foreground">Lucro acumulado</div>
    </div>
  );
}
