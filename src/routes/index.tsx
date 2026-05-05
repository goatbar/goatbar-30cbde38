import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatCard, SectionCard, StatusBadge } from "@/components/ui-bits";
import { fmtBRL } from "@/lib/format";
import { TrendingUp, ShoppingBag, CalendarRange, Wine, ChevronRight } from "lucide-react";
import { useAppStore } from "@/lib/app-store";
import { drinks as allDrinks, rankingDrinks } from "@/lib/mock-data";

export const Route = createFileRoute("/")({ component: () => <AppShell><Dashboard /></AppShell> });

function Dashboard() {
  const { vendas, eventos } = useAppStore();

  const receita = vendas.reduce((a, v) => a + v.precoUnitario * v.quantidade, 0);
  const custo = vendas.reduce((a, v) => a + v.custoUnitario * v.quantidade, 0);
  const lucro = receita - custo;
  const margem = receita > 0 ? ((lucro / receita) * 100).toFixed(1) : "0.0";

  const receitaEventos = eventos.reduce((a, e) => a + e.valorNegociado, 0);
  const receitaTotal = receita + receitaEventos;

  const topDrinks = rankingDrinks().slice(0, 5);
  const eventosAtivos = eventos.filter((e) => ["confirmado", "em_andamento", "rascunho"].includes(e.status));
  const proximosEventos = [...eventosAtivos].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()).slice(0, 5);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral consolidada do Goat Bar Management System."
      />

      <div className="px-8 py-7 space-y-7">
        {/* Stats */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
          <StatCard
            label="Receita total"
            value={fmtBRL(receitaTotal)}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatCard
            label="Lucro (vendas)"
            value={fmtBRL(lucro)}
            icon={<ShoppingBag className="h-4 w-4" />}
          />
          <StatCard
            label="Margem média"
            value={`${margem}%`}
            icon={<Wine className="h-4 w-4" />}
          />
          <StatCard
            label="Eventos ativos"
            value={String(eventosAtivos.length)}
            icon={<CalendarRange className="h-4 w-4" />}
          />
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
              <div className="label-eyebrow">Eventos</div>
              <div className="mt-3 space-y-2 text-sm">
                <Row k="Receita prevista" v={fmtBRL(receitaEventos)} />
                <Row k="Custo previsto" v={fmtBRL(eventos.reduce((a, e) => a + e.custoPrevisto, 0))} />
                <Row k="Lucro previsto" v={fmtBRL(receitaEventos - eventos.reduce((a, e) => a + e.custoPrevisto, 0))} highlight />
                <Row k="Total eventos" v={String(eventos.length)} />
              </div>
            </div>
            <div>
              <div className="label-eyebrow">Consolidado</div>
              <div className="mt-3 space-y-2 text-sm">
                <Row k="Receita total" v={fmtBRL(receitaTotal)} />
                <Row k="Total transações" v={String(vendas.length)} />
                <Row k="Drinks no catálogo" v={String(allDrinks.length)} />
                <Row k="Drinks ativos" v={String(allDrinks.filter((d) => d.status === "ativo").length)} />
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
