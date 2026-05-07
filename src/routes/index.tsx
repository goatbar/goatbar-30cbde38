import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatCard, SectionCard, StatusBadge } from "@/components/ui-bits";
import { fmtBRL } from "@/lib/format";
import { TrendingUp, ShoppingBag, CalendarRange, Wine, ChevronRight, Calculator } from "lucide-react";
import { eventBudgetService } from "@/services/event-budget-service";
import { financialService } from "@/services/financial-service";
import { goatbarService } from "@/services/goatbar-service";
import { useState, useMemo, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/")({ component: () => <AppShell><Dashboard /></AppShell> });

function Dashboard() {
  const [financialSessions, setFinancialSessions] = useState<any[]>([]);
  const [allDrinks, setAllDrinks] = useState<any[]>([]);
  const [eventosSupabase, setEventosSupabase] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodoDias, setPeriodoDias] = useState<number>(30);

  const loadData = async () => {
    setLoading(true);
    try {
      const [evs, sessions, drinksData] = await Promise.all([
        eventBudgetService.listEvents(),
        financialService.listSessions(),
        goatbarService.listDrinks()
      ]);
      setEventosSupabase(evs || []);
      setFinancialSessions(sessions || []);
      setAllDrinks(drinksData || []);
    } catch (e) {
      console.error("Erro ao carregar dados do Dashboard:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  // --- Metrics via Centralized Service ---
  const metrics = useMemo(() => {
    return financialService.calculateMetrics(filteredSessions, filteredEventos, allDrinks);
  }, [filteredSessions, filteredEventos, allDrinks]);

  // Total de gastos (Controladoria/Geral)
  const totalGastos = financialSessions.reduce((a: number, b: any) => a + Number(b.amount || 0), 0);

  // --- UI Helpers ---
  const topDrinks = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; receita: number; lucro: number }>();
    filteredSessions.forEach((s) => {
      const isSteakhouse = s.modalidade === "7Steakhouse";
      (s.items || []).forEach((item: any) => {
        const cur = map.get(item.drinkId) || { nome: item.nome, qtd: 0, receita: 0, lucro: 0 };
        cur.qtd += item.quantidade;
        if (isSteakhouse) {
          const d = allDrinks.find(x => x.id === item.drinkId);
          cur.receita += item.custoUnitario * item.quantidade;
          cur.lucro += (item.custoUnitario - (d?.custoUnitario || 0)) * item.quantidade;
        } else {
          cur.receita += item.precoUnitario * item.quantidade;
          cur.lucro += (item.precoUnitario - item.custoUnitario) * item.quantidade * 0.6;
        }
        map.set(item.drinkId, cur);
      });
    });
    return Array.from(map.values())
      .sort((a, b) => b.lucro - a.lucro)
      .slice(0, 5);
  }, [filteredSessions, allDrinks]);

  const proximosEventos = [...eventosSupabase]
    .filter(e => {
      const s = e.status?.toUpperCase();
      return s === "CONFIRMADO" || s === "PROPOSTA_ACEITA";
    })
    .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
    .filter(e => new Date(e.date || 0).getTime() >= new Date().setHours(0,0,0,0))
    .slice(0, 5);

  const proximosPagamentos = [...eventosSupabase]
    .filter(e => {
      const s = e.status?.toUpperCase();
      const percentualPago = Number(e.payment_percent_received ?? e.paid_percentage ?? 0);
      const isPaid = percentualPago >= 100;
      return ["CONFIRMADO", "FINALIZADO", "REALIZADO", "PROPOSTA_ACEITA"].includes(s) && !isPaid;
    })
    .map(e => {
       const total = Number(e.current_budget_value || e.budget_value || 0);
       const percentPago = Number(e.payment_percent_received ?? e.paid_percentage ?? 0);
       const percentPendente = Math.max(0, 100 - percentPago);
       const pago = total * (percentPago / 100);
       const pendente = total - pago;
       const vencimento = e.payment_due_date || e.pending_payment_date || null;
       return { ...e, percentualPago: percentPago, percentualPendente: percentPendente, valorPendente: pendente, dataVencimentoPagamento: vencimento };
    })
    .filter(e => e.valorPendente > 0)
    .sort((a, b) => {
      const dateA = a.dataVencimentoPagamento || "9999-12-31";
      const dateB = b.dataVencimentoPagamento || "9999-12-31";
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    })
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral consolidada do Goat Bar Management System."
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

      <div className="page-container space-y-6 lg:space-y-7">
        <div className="responsive-grid-kpi">
          <StatCard label="Receita Consolidada" value={fmtBRL(metrics.consolidated.receita)} icon={<TrendingUp className="h-4 w-4" />} />
          <StatCard label="Lucro Total Goat Bar" value={fmtBRL(metrics.consolidated.lucro)} icon={<ShoppingBag className="h-4 w-4" />} highlight />
          <StatCard label="Eventos Confirmados" value={String(metrics.events.count)} icon={<CalendarRange className="h-4 w-4" />} />
          <StatCard label="Custos Controladoria" value={fmtBRL(totalGastos)} icon={<Calculator className="h-4 w-4 text-amber-500" />} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <SectionCard title="Drinks mais rentáveis" subtitle="Participação no lucro por sessões diretas">
            <div className="space-y-3">
              {topDrinks.map((d, i) => {
                const drink = allDrinks.find((x) => x.nome === d.nome);
                return (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary font-display font-semibold text-xs shrink-0">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{d.nome}</div>
                      <div className="text-xs text-muted-foreground">{d.qtd} doses vendidas</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-medium text-success">{fmtBRL(d.lucro)}</div>
                      <div className="text-xs text-muted-foreground">{fmtBRL(d.receita)} receita</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Próximos eventos" subtitle="Agenda operacional" action={<Link to="/eventos" className="text-xs text-primary font-medium">Ver todos</Link>}>
            <div className="space-y-2">
              {proximosEventos.map((e) => (
                <Link key={e.id} to="/eventos/$eventoId" params={{ eventoId: e.id }} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-surface/50 transition-all group">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{e.nome || e.client_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {e.date ? format(parseISO(e.date), "dd/MMM", { locale: ptBR }) : "--"} · {e.guests || e.convidados} convidados
                    </div>
                    <div className="text-[11px] text-muted-foreground/90 mt-0.5 truncate">
                      {[e.event_type, e.city].filter(Boolean).join(" · ") || "Tipo/cidade não informados"}
                    </div>
                  </div>
                  <StatusBadge status={e.status} />
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Próximos Pagamentos" subtitle="Fluxo de caixa de eventos confirmados" className="border-amber-500/20 shadow-lg shadow-amber-500/5">
            <div className="space-y-3">
              {proximosPagamentos.map((e) => (
                <Link key={e.id} to="/eventos/$eventoId" params={{ eventoId: e.id }} className="flex items-center gap-4 p-3 rounded-xl border border-border bg-amber-500/5 hover:bg-amber-500/10 transition-all group">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0"><Calculator className="h-5 w-5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{e.nome || e.client_name}</div>
                    <div className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-0.5">Vence em: {e.dataVencimentoPagamento ? format(parseISO(e.dataVencimentoPagamento), "dd/MM/yyyy") : "A definir"}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-black text-foreground">{fmtBRL(e.valorPendente)}</div>
                    <div className="text-[9px] font-bold text-muted-foreground uppercase">{e.percentualPendente.toFixed(0)}% pendente · {e.percentualPago.toFixed(0)}% pago</div>
                  </div>
                </Link>
              ))}
              {proximosPagamentos.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Tudo em dia!</p>}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Resumo por Modalidade" subtitle="Consolidado de resultados líquidos">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SummaryBlock title="Goat Botequim" icon={<ShoppingBag className="h-4 w-4 text-primary" />} receita={metrics.bot.receita} lucro={metrics.bot.lucro} />
            <SummaryBlock title="7Steakhouse" icon={<Calculator className="h-4 w-4 text-success" />} receita={metrics.steak.receita} lucro={metrics.steak.lucro} />
            <SummaryBlock title="Eventos Fechados" icon={<CalendarRange className="h-4 w-4 text-amber-500" />} receita={metrics.events.receita} lucro={metrics.events.lucro} />
          </div>
        </SectionCard>
      </div>
    </>
  );
}

function SummaryBlock({ title, icon, receita, lucro }: { title: string; icon: React.ReactNode; receita: number; lucro: number }) {
  return (
    <div className="p-4 rounded-xl border border-border bg-background/40">
      <div className="flex items-center gap-2 mb-3">{icon}<div className="label-eyebrow">{title}</div></div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Receita Bruta</span>
          <span className="font-medium">{fmtBRL(receita)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Lucro Final</span>
          <span className="font-medium text-success">{fmtBRL(lucro)}</span>
        </div>
      </div>
    </div>
  );
}
