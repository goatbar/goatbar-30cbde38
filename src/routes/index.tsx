import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatCard, SectionCard, StatusBadge, MiniBars, PrimaryButton } from "@/components/ui-bits";
import {
  vendasResumo,
  rankingDrinks,
  vendasPorDia,
  eventos,
  fmtBRL,
  fmtPct,
} from "@/lib/mock-data";
import { DollarSign, TrendingUp, ShoppingBag, CalendarRange, Plus } from "lucide-react";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}

function DashboardContent() {
  const r = vendasResumo();
  const top = rankingDrinks().slice(0, 5);
  const serie = vendasPorDia(14);
  const eventosAtivos = eventos.filter((e) => e.status !== "concluido" && e.status !== "cancelado");

  const unidades: { nome: "7Steakhouse" | "Goat Botequim" }[] = [
    { nome: "7Steakhouse" },
    { nome: "Goat Botequim" },
  ];

  return (
    <>
      <PageHeader
        breadcrumb="Visão geral"
        title="Dashboard executivo"
        subtitle="Performance consolidada das três frentes de operação."
        action={
          <PrimaryButton>
            <Plus className="h-4 w-4" />
            Novo lançamento
          </PrimaryButton>
        }
      />

      <div className="px-8 py-7 space-y-8">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <StatCard
            label="Faturamento"
            value={fmtBRL(r.receita)}
            delta={12.4}
            hint="vs período anterior"
            icon={<DollarSign className="h-4 w-4" />}
          />
          <StatCard
            label="Lucro líquido"
            value={fmtBRL(r.lucro)}
            delta={8.1}
            hint={`Margem ${fmtPct(r.margem)}`}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatCard
            label="Vendas registradas"
            value={r.total.toLocaleString("pt-BR")}
            delta={4.2}
            hint={`Ticket médio ${fmtBRL(r.ticketMedio)}`}
            icon={<ShoppingBag className="h-4 w-4" />}
          />
          <StatCard
            label="Eventos ativos"
            value={eventosAtivos.length.toString()}
            delta={-1.5}
            hint="próximos 60 dias"
            icon={<CalendarRange className="h-4 w-4" />}
          />
        </div>

        {/* Gráfico + ranking */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <SectionCard
            title="Receita & lucro — 14 dias"
            subtitle="Consolidado 7Steakhouse + Goat Botequim"
            className="xl:col-span-2"
          >
            <div className="flex items-end gap-2 h-56">
              {serie.map((d) => {
                const max = Math.max(...serie.map((x) => x.receita), 1);
                const hReceita = (d.receita / max) * 100;
                const hLucro = (d.lucro / max) * 100;
                return (
                  <div key={d.data} className="flex-1 flex flex-col gap-1 items-stretch">
                    <div className="flex-1 flex items-end gap-0.5">
                      <div
                        className="flex-1 rounded-t-sm bg-primary"
                        style={{ height: `${hReceita}%`, minHeight: 4 }}
                      />
                      <div
                        className="flex-1 rounded-t-sm bg-primary-glow opacity-70"
                        style={{ height: `${hLucro}%`, minHeight: 4 }}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground text-center tracking-wider">
                      {new Date(d.data).getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex items-center gap-5 text-xs">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-3 rounded-sm bg-primary" /> Receita
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-3 rounded-sm bg-primary-glow opacity-70" /> Lucro
              </span>
            </div>
          </SectionCard>

          <SectionCard title="Top 5 drinks" subtitle="Ranking por receita">
            <ul className="space-y-4">
              {top.map((d, i) => (
                <li key={d.id} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center font-display text-sm font-semibold text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{d.nome}</div>
                    <div className="text-xs text-muted-foreground">{d.qtd} vendas</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{fmtBRL(d.receita)}</div>
                    <div className="text-[11px] text-success">+{fmtBRL(d.lucro)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        {/* Comparativo unidades + próximos eventos */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <SectionCard title="Performance por unidade" className="xl:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {unidades.map((u) => {
                const ru = vendasResumo(u.nome);
                return (
                  <div key={u.nome} className="rounded-xl border border-border p-5 bg-background/40">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="label-eyebrow">Unidade</div>
                        <div className="font-display text-lg font-semibold mt-1">{u.nome}</div>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-md bg-success/10 text-success">
                        {fmtPct(ru.margem)}
                      </span>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-4">
                      <div>
                        <div className="label-eyebrow">Faturamento</div>
                        <div className="font-display text-xl mt-1">{fmtBRL(ru.receita)}</div>
                      </div>
                      <div>
                        <div className="label-eyebrow">Lucro</div>
                        <div className="font-display text-xl mt-1">{fmtBRL(ru.lucro)}</div>
                      </div>
                    </div>
                    <div className="mt-5">
                      <MiniBars data={vendasPorDia(14).map((x) => x.receita)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Próximos eventos" subtitle="Pipeline de operação">
            <ul className="space-y-3">
              {eventosAtivos.slice(0, 4).map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-border-strong transition-colors"
                >
                  <div className="text-center px-2">
                    <div className="font-display text-lg font-semibold leading-none">
                      {new Date(e.data).getDate()}
                    </div>
                    <div className="label-eyebrow mt-1 leading-none">
                      {new Date(e.data).toLocaleDateString("pt-BR", { month: "short" })}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{e.nome}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {e.local} · {e.convidados} convidados
                    </div>
                  </div>
                  <StatusBadge status={e.status} />
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
