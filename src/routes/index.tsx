import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatCard, SectionCard, StatusBadge } from "@/components/ui-bits";
import { fmtBRL } from "@/lib/format";
import { TrendingUp, ShoppingBag, CalendarRange, Wine, ChevronRight, Calculator } from "lucide-react";
import { useAppStore } from "@/lib/app-store";
import { calcularOrcamentoEvento } from "@/lib/mock-data";
import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/")({ component: () => <AppShell><Dashboard /></AppShell> });

function Dashboard() {
  const store = useAppStore();
  const { financialSessions, eventos: todosEventos, eventContracts, drinks: allDrinks } = store;
  const [periodoDias, setPeriodoDias] = useState<number>(30);

  // Gastos da controladoria
  const totalGastos = (store as any).financial_expenses?.reduce((a: number, b: any) => a + Number(b.amount), 0) || 0;

  // Filtros Globais Baseados no Período Selecionado
  const limiteData = useMemo(() => {
    if (periodoDias === 0) return new Date(0); // All time
    const d = new Date();
    d.setDate(d.getDate() - periodoDias);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [periodoDias]);

  // --- Filtered Data ---
  const filteredSessions = useMemo(() => {
    return financialSessions.filter(s => new Date(s.data).getTime() >= limiteData.getTime());
  }, [financialSessions, limiteData]);

  const filteredEventos = useMemo(() => {
    return todosEventos.filter(e => new Date(e.data || 0).getTime() >= limiteData.getTime());
  }, [todosEventos, limiteData]);

  // --- Modality Calculations ---

  // Goat Botequim
  const botStats = useMemo(() => {
    const list = filteredSessions.filter(s => s.modalidade === "Goat Botequim");
    const receitaBruta = list.reduce((acc, s) => acc + s.items.reduce((sum, item) => sum + (item.precoUnitario * item.quantidade), 0), 0);
    const custoDrinks = list.reduce((acc, s) => acc + s.items.reduce((sum, item) => sum + (item.custoUnitario * item.quantidade), 0), 0);
    const resLiq = receitaBruta - custoDrinks;
    const maoDeObra = list.reduce((acc, s) => acc + (s.maoDeObraValor * s.maoDeObraQtd), 0);
    const lucroFinal = (resLiq * 0.6) - maoDeObra;
    return { receitaBruta, custoDrinks, lucroFinal };
  }, [filteredSessions]);

  // 7Steakhouse
  const steakStats = useMemo(() => {
    const list = filteredSessions.filter(s => s.modalidade === "7Steakhouse");
    const receitaBruta = list.reduce((acc, s) => acc + s.items.reduce((sum, item) => sum + (item.precoUnitario * item.quantidade), 0), 0);
    const custoDrinks = list.reduce((acc, s) => acc + s.items.reduce((sum, item) => sum + (item.custoUnitario * item.quantidade), 0), 0);
    const resLiq = receitaBruta - custoDrinks;
    const maoDeObra = list.reduce((acc, s) => acc + (s.maoDeObraValor * s.maoDeObraQtd), 0);
    const reposicao = list.reduce((acc, s) => acc + (s.reposicaoRestaurante || 0), 0);
    const lucroFinal = resLiq - maoDeObra - reposicao;
    return { receitaBruta, custoDrinks, lucroFinal };
  }, [filteredSessions]);

  // Eventos
  const eventStats = useMemo(() => {
    const validos = filteredEventos.filter(e => {
      const contrato = eventContracts.find(ec => ec.eventId === e.id);
      return ["confirmado", "realizado", "proposta_aceita"].includes(e.status) && contrato?.status === "assinado";
    });
    const results = validos.map(e => calcularOrcamentoEvento(e, allDrinks));
    const receita = results.reduce((acc, r) => acc + r.valorTotalOrcamento, 0);
    const custos = results.reduce((acc, r) => acc + r.custoTotalOrcamento, 0);
    const lucro = results.reduce((acc, r) => acc + r.lucro, 0);
    return { receita, custos, lucro, qtd: validos.length };
  }, [filteredEventos, eventContracts]);

  // Consolidated
  const totalReceita = botStats.receitaBruta + steakStats.receitaBruta + eventStats.receita;
  const totalLucro = botStats.lucroFinal + steakStats.lucroFinal + eventStats.lucro;

  // --- UI Elements ---
  
  const rankingDrinks = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; receita: number; lucro: number }>();
    filteredSessions.forEach((s) => {
      s.items.forEach(item => {
        const cur = map.get(item.drinkId) || { nome: item.nome, qtd: 0, receita: 0, lucro: 0 };
        cur.qtd += item.quantidade;
        cur.receita += item.precoUnitario * item.quantidade;
        cur.lucro += (item.precoUnitario - item.custoUnitario) * item.quantidade;
        map.set(item.drinkId, cur);
      });
    });
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.receita - a.receita);
  }, [filteredSessions]);

  const topDrinks = rankingDrinks.slice(0, 5);

  const proximosEventos = [...filteredEventos]
    .filter(e => !["cancelado", "proposta_recusada"].includes(e.status))
    .sort((a, b) => new Date(a.data || 0).getTime() - new Date(b.data || 0).getTime())
    .filter(e => new Date(e.data || 0).getTime() >= new Date().setHours(0,0,0,0))
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
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
              <option value={0}>Todo o período</option>
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none rotate-90" />
          </div>
        }
      />

      <div className="px-8 py-7 space-y-7">
        {/* Main Financial Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <StatCard label="Receita Consolidada" value={fmtBRL(totalReceita)} icon={<TrendingUp className="h-4 w-4" />} />
          <StatCard label="Lucro Total Goat Bar" value={fmtBRL(totalLucro)} icon={<ShoppingBag className="h-4 w-4" />} highlight />
          <StatCard label="Eventos Confirmados" value={String(eventStats.qtd)} icon={<CalendarRange className="h-4 w-4" />} />
          <StatCard label="Custos Controladoria" value={fmtBRL(totalGastos)} icon={<Calculator className="h-4 w-4 text-amber-500" />} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Top Drinks */}
          <SectionCard title="Drinks mais rentáveis" subtitle="Participação no lucro por sessões diretas">
            <div className="space-y-3">
              {topDrinks.map((d, i) => {
                const drink = allDrinks.find((x) => x.id === d.id);
                return (
                  <div key={d.id} className="flex items-center gap-4">
                    <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary font-display font-semibold text-xs shrink-0">
                      {i + 1}
                    </div>
                    {drink?.imagem && (
                      <img
                        src={drink.imagem}
                        alt={d.nome}
                        className="h-10 w-10 rounded-lg object-cover shrink-0"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    )}
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
              {topDrinks.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma venda direta no período</p>}
            </div>
          </SectionCard>

          {/* Próximos Eventos */}
          <SectionCard title="Próximos eventos" subtitle="Agenda operacional" action={
            <Link to="/eventos" className="text-xs text-primary hover:text-primary/80 transition-colors font-medium">
              Ver todos
            </Link>
          }>
            <div className="space-y-2">
              {proximosEventos.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum evento ativo</p>
              )}
              {proximosEventos.map((e) => (
                <Link
                  key={e.id}
                  to="/eventos/$eventoId"
                  params={{ eventoId: e.id }}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-border-strong hover:bg-surface/50 transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{e.nome}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {e.data ? format(parseISO(e.data), "dd/MMM", { locale: ptBR }) : "--"} · {e.convidados} convidados
                    </div>
                  </div>
                  <StatusBadge status={e.status} />
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Resumo por Modalidade */}
        <SectionCard title="Resumo por Modalidade" subtitle="Consolidado de resultados líquidos">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-xl border border-border bg-background/40">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <div className="label-eyebrow">Goat Botequim</div>
              </div>
              <div className="space-y-2 text-sm">
                <Row k="Receita Bruta" v={fmtBRL(botStats.receitaBruta)} />
                <Row k="Lucro Final (60% - MO)" v={fmtBRL(botStats.lucroFinal)} highlight />
              </div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-background/40">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="h-4 w-4 text-success" />
                <div className="label-eyebrow">7Steakhouse</div>
              </div>
              <div className="space-y-2 text-sm">
                <Row k="Receita Bruta" v={fmtBRL(steakStats.receitaBruta)} />
                <Row k="Lucro Final (-MO, -Rep)" v={fmtBRL(steakStats.lucroFinal)} highlight />
              </div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-background/40">
              <div className="flex items-center gap-2 mb-3">
                <CalendarRange className="h-4 w-4 text-amber-500" />
                <div className="label-eyebrow">Eventos Fechados</div>
              </div>
              <div className="space-y-2 text-sm">
                <Row k="Receita Total" v={fmtBRL(eventStats.receita)} />
                <Row k="Lucro Orçamentário" v={fmtBRL(eventStats.lucro)} highlight />
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </>
  );
}

function Row({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className={`font-medium ${highlight ? "text-success" : ""}`}>{v}</span>
    </div>
  );
}
