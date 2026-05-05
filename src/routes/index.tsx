import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatCard, SectionCard, StatusBadge } from "@/components/ui-bits";
import { fmtBRL } from "@/lib/format";
import { TrendingUp, ShoppingBag, CalendarRange, Wine, ChevronRight } from "lucide-react";
import { useAppStore } from "@/lib/app-store";
import { drinks as allDrinks, calcularOrcamentoEvento } from "@/lib/mock-data";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/")({ component: () => <AppShell><Dashboard /></AppShell> });

function Dashboard() {
  const { vendas: todasVendas, eventos: todosEventos } = useAppStore();
  const [periodoDias, setPeriodoDias] = useState<number>(30);

  // Filtros Globais Baseados no Período Selecionado
  const limiteData = useMemo(() => {
    if (periodoDias === 0) return new Date(0); // All time
    const d = new Date();
    d.setDate(d.getDate() - periodoDias);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [periodoDias]);

  const vendas = useMemo(() => {
    return todasVendas.filter(v => new Date(v.data).getTime() >= limiteData.getTime());
  }, [todasVendas, limiteData]);

  const eventos = useMemo(() => {
    return todosEventos.filter(e => new Date(e.data || 0).getTime() >= limiteData.getTime());
  }, [todosEventos, limiteData]);

  const receita = vendas.reduce((a, v) => a + v.precoUnitario * v.quantidade, 0);
  const custo = vendas.reduce((a, v) => a + v.custoUnitario * v.quantidade, 0);
  const lucro = receita - custo;
  const margem = receita > 0 ? ((lucro / receita) * 100).toFixed(1) : "0.0";
  
  const rankingDrinks = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; receita: number; lucro: number }>();
    vendas.forEach((v) => {
      const cur = map.get(v.drinkId) || { nome: v.drinkNome, qtd: 0, receita: 0, lucro: 0 };
      cur.qtd += v.quantidade;
      cur.receita += v.precoUnitario * v.quantidade;
      cur.lucro += (v.precoUnitario - v.custoUnitario) * v.quantidade;
      map.set(v.drinkId, cur);
    });
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.receita - a.receita);
  }, [vendas]);

  const topDrinks = rankingDrinks.slice(0, 5);

  const eventosAtivos = eventos.filter((e) => !["cancelado", "proposta_recusada"].includes(e.status));
  const proximosEventos = [...eventosAtivos].sort((a, b) => new Date(a.data || 0).getTime() - new Date(b.data || 0).getTime()).filter(e => new Date(e.data || 0).getTime() >= new Date().setHours(0,0,0,0)).slice(0, 5);

  const mesAtual = new Date().getMonth();
  const eventosMes = eventos.filter(e => new Date(e.data || 0).getMonth() === mesAtual);
  
  const orcadosMes = eventosMes.length;
  const confirmadosMes = eventosMes.filter(e => ["confirmado", "realizado", "proposta_aceita"].includes(e.status)).length;
  
  const valorEnviados = eventosAtivos.filter(e => ["orcamento_enviado", "aguardando_retorno", "em_assinatura"].includes(e.status)).reduce((a, e) => a + calcularOrcamentoEvento(e).valorTotalOrcamento, 0);
  const valorConfirmados = eventosAtivos.filter(e => ["confirmado", "realizado", "proposta_aceita"].includes(e.status)).reduce((a, e) => a + calcularOrcamentoEvento(e).valorTotalOrcamento, 0);
  
  const ticketMedio = eventosAtivos.length ? eventosAtivos.reduce((a, e) => a + calcularOrcamentoEvento(e).valorTotalOrcamento, 0) / eventosAtivos.length : 0;
  const mediaPorPessoa = eventosAtivos.length ? eventosAtivos.reduce((a, e) => a + calcularOrcamentoEvento(e).mediaPorPessoa, 0) / eventosAtivos.length : 0;
  
  const aguardandoRetorno = eventosAtivos.filter(e => e.status === "aguardando_retorno").length;
  const pagamentoPendente = eventosAtivos.filter(e => ["confirmado", "proposta_aceita"].includes(e.status) && calcularOrcamentoEvento(e).percPendente > 0).length;

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
        {/* Stats */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
          <StatCard label="Orçados no Mês" value={String(orcadosMes)} icon={<CalendarRange className="h-4 w-4" />} />
          <StatCard label="Confirmados no Mês" value={String(confirmadosMes)} icon={<CalendarRange className="h-4 w-4" />} />
          <StatCard label="Valor Enviado" value={fmtBRL(valorEnviados)} icon={<TrendingUp className="h-4 w-4" />} />
          <StatCard label="Valor Confirmado" value={fmtBRL(valorConfirmados)} icon={<TrendingUp className="h-4 w-4" />} />
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
          <StatCard label="Ticket Médio" value={fmtBRL(ticketMedio)} />
          <StatCard label="Média / Pessoa" value={fmtBRL(mediaPorPessoa)} />
          <StatCard label="Aguardando Retorno" value={String(aguardandoRetorno)} />
          <StatCard label="Pagamento Pendente" value={String(pagamentoPendente)} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Top Drinks */}
          <SectionCard title="Drinks mais rentáveis" subtitle="Por lucro total nos últimos 90 dias">
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
                      <div className="text-xs text-muted-foreground">{d.qtd} unidades vendidas</div>
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

          {/* Próximos Eventos */}
          <SectionCard title="Próximos eventos" subtitle="Ordenados por data" action={
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
                      {new Date(e.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} · {e.convidados} convidados
                    </div>
                  </div>
                  <StatusBadge status={e.status} />
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Resumo Financeiro */}
        <SectionCard title="Resumo financeiro" subtitle="Consolidado das operações">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="label-eyebrow">Vendas diretas</div>
              <div className="mt-3 space-y-2 text-sm">
                <Row k="Receita" v={fmtBRL(receita)} />
                <Row k="Custo" v={fmtBRL(custo)} />
                <Row k="Lucro" v={fmtBRL(lucro)} highlight />
                <Row k="Margem" v={`${margem}%`} />
              </div>
            </div>
            <div>
              <div className="label-eyebrow">Eventos (Confirmados)</div>
              <div className="mt-3 space-y-2 text-sm">
                <Row k="Receita confirmada" v={fmtBRL(valorConfirmados)} highlight />
                <Row k="Ticket médio" v={fmtBRL(ticketMedio)} />
                <Row k="Média por pessoa" v={fmtBRL(mediaPorPessoa)} />
                <Row k="Total em pipeline" v={String(eventosAtivos.length)} />
              </div>
            </div>
            <div>
              <div className="label-eyebrow">Ações Necessárias</div>
              <div className="mt-3 space-y-2 text-sm">
                <Row k="Aguardando retorno" v={String(aguardandoRetorno)} />
                <Row k="Pagamentos pendentes" v={String(pagamentoPendente)} />
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
