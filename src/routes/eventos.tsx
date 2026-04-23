import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SectionCard, StatCard, PrimaryButton, StatusBadge } from "@/components/ui-bits";
import { eventos, calcularEvento, fmtBRL, fmtPct } from "@/lib/mock-data";
import { Plus, Calendar, Users, MapPin, TrendingUp, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/eventos")({
  component: () => (
    <AppShell>
      <EventosPage />
    </AppShell>
  ),
});

function EventosPage() {
  const principal = eventos.find((e) => e.status === "em_andamento") || eventos[0];
  const calc = calcularEvento(principal);
  const ativos = eventos.filter((e) => e.status !== "concluido");
  const totalReceita = eventos.reduce((a, e) => a + e.valorNegociado, 0);

  return (
    <>
      <PageHeader
        breadcrumb="Operação"
        title="Eventos"
        subtitle="Pipeline e performance de eventos contratados."
        action={
          <PrimaryButton>
            <Plus className="h-4 w-4" /> Novo evento
          </PrimaryButton>
        }
      />

      <div className="px-8 py-7 space-y-7">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <StatCard label="Eventos ativos" value={ativos.length.toString()} icon={<Calendar className="h-4 w-4" />} />
          <StatCard label="Receita contratada" value={fmtBRL(totalReceita)} delta={18.3} icon={<TrendingUp className="h-4 w-4" />} />
          <StatCard label="Convidados totais" value={eventos.reduce((a, e) => a + e.convidados, 0).toString()} icon={<Users className="h-4 w-4" />} />
          <StatCard label="Margem média" value={fmtPct(calc.margemPct)} delta={3.6} />
        </div>

        {/* Hero do evento principal */}
        <article className="card-premium overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-5">
            <div className="lg:col-span-3 p-8 lg:p-10 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-transparent pointer-events-none" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <span className="label-eyebrow">Evento em destaque</span>
                  <StatusBadge status={principal.status} />
                </div>
                <h2 className="font-display text-4xl font-semibold tracking-tight leading-tight">
                  {principal.nome}
                </h2>
                <p className="mt-3 text-muted-foreground max-w-lg">
                  {principal.observacoes}
                </p>

                <div className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-5">
                  <Info icon={<Calendar className="h-4 w-4" />} label="Data" value={new Date(principal.data).toLocaleDateString("pt-BR")} />
                  <Info icon={<MapPin className="h-4 w-4" />} label="Local" value={principal.cidade} />
                  <Info icon={<Users className="h-4 w-4" />} label="Convidados" value={principal.convidados.toString()} />
                  <Info icon={<TrendingUp className="h-4 w-4" />} label="Margem" value={fmtPct(calc.margemPct)} />
                </div>

                <div className="mt-8 flex items-center gap-3">
                  <Link
                    to="/eventos/$eventoId"
                    params={{ eventoId: principal.id }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-all"
                  >
                    Abrir interna do evento <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/contratos"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface text-sm hover:border-border-strong transition-all"
                  >
                    Ver contrato
                  </Link>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-background/60 border-l border-border p-8 lg:p-10">
              <div className="label-eyebrow">Resumo financeiro previsto</div>
              <div className="mt-3 font-display text-3xl font-semibold">
                {fmtBRL(principal.valorNegociado)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Valor negociado</div>

              <dl className="mt-6 space-y-3 text-sm">
                <Row k="Custo previsto" v={fmtBRL(calc.custoTotal)} />
                <Row k="Repasse" v={fmtBRL(calc.repasse)} />
                <Row k="Lucro estimado" v={fmtBRL(calc.lucro)} highlight />
                <Row k="Bebidas estimadas" v={`${calc.dosesEstimadas} doses`} />
                <Row k="Gelo estimado" v={`${calc.geloKg} kg`} />
                <Row k="Equipe necessária" v={`${calc.equipeNec} pessoas`} />
              </dl>
            </div>
          </div>
        </article>

        <SectionCard title="Pipeline de eventos" subtitle={`${eventos.length} eventos cadastrados`}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {eventos.map((e) => {
              const c = calcularEvento(e);
              return (
                <Link
                  key={e.id}
                  to="/eventos/$eventoId"
                  params={{ eventoId: e.id }}
                  className="group rounded-xl border border-border bg-background/40 hover:border-border-strong transition-all p-5"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="label-eyebrow">{e.tipo}</div>
                    <StatusBadge status={e.status} />
                  </div>
                  <h3 className="font-display text-lg font-semibold leading-snug">{e.nome}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{e.cliente}</p>

                  <div className="mt-5 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(e.data).toLocaleDateString("pt-BR")}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> {e.convidados}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> {e.cidade}
                    </span>
                  </div>

                  <div className="mt-5 pt-5 border-t border-border flex items-center justify-between">
                    <div>
                      <div className="label-eyebrow">Receita</div>
                      <div className="font-medium mt-1">{fmtBRL(e.valorNegociado)}</div>
                    </div>
                    <div className="text-right">
                      <div className="label-eyebrow">Margem</div>
                      <div className="font-medium text-success mt-1">{fmtPct(c.margemPct)}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="label-eyebrow flex items-center gap-1.5">{icon} {label}</div>
      <div className="font-display text-base font-medium mt-1.5">{value}</div>
    </div>
  );
}
function Row({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border/60 pb-2">
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className={`text-sm ${highlight ? "text-success font-semibold" : "font-medium"}`}>{v}</dd>
    </div>
  );
}
