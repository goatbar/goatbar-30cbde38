import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SectionCard, StatusBadge, PrimaryButton, GhostButton } from "@/components/ui-bits";
import { eventos, drinks, calcularEvento, fmtBRL, fmtPct } from "@/lib/mock-data";
import { Calendar, MapPin, Users, Phone, Mail, FileText, ClipboardCheck, Wine, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/eventos/$eventoId")({
  component: () => (
    <AppShell>
      <EventoInterna />
    </AppShell>
  ),
  loader: ({ params }) => {
    const e = eventos.find((x) => x.id === params.eventoId);
    if (!e) throw notFound();
    return { evento: e };
  },
  notFoundComponent: () => (
    <AppShell>
      <div className="p-12 text-center">
        <h2 className="font-display text-2xl">Evento não encontrado</h2>
        <Link to="/eventos" className="text-primary text-sm mt-3 inline-block">Voltar</Link>
      </div>
    </AppShell>
  ),
});

function EventoInterna() {
  const { evento } = Route.useLoaderData();
  const calc = calcularEvento(evento);
  const drinksSel = drinks.filter((d) => evento.drinks.includes(d.id));

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link to="/eventos" className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
            <ArrowLeft className="h-3 w-3" /> Eventos
          </Link>
        }
        title={evento.nome}
        subtitle={`${evento.tipo} · ${evento.cliente}`}
        action={
          <div className="flex items-center gap-2">
            <Link to="/pos-evento/$eventoId" params={{ eventoId: evento.id }}>
              <GhostButton><ClipboardCheck className="h-4 w-4" /> Pós-evento</GhostButton>
            </Link>
            <PrimaryButton>
              <FileText className="h-4 w-4" /> Gerar contrato
            </PrimaryButton>
          </div>
        }
      />

      <div className="px-8 py-7 space-y-7">
        {/* HERO */}
        <div className="card-premium p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
          <div className="relative grid grid-cols-1 lg:grid-cols-4 gap-7">
            <div className="lg:col-span-3">
              <div className="flex items-center gap-3 mb-3">
                <StatusBadge status={evento.status} />
                <span className="label-eyebrow">Operação Goat Bar</span>
              </div>
              <h2 className="font-display text-3xl font-semibold tracking-tight">
                {new Date(evento.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                <span className="text-muted-foreground"> · {evento.horario}</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-2">{evento.observacoes}</p>

              <div className="mt-7 grid grid-cols-2 md:grid-cols-4 gap-5">
                <Info icon={<MapPin className="h-3.5 w-3.5" />} label="Local" value={`${evento.local}, ${evento.cidade}`} />
                <Info icon={<Users className="h-3.5 w-3.5" />} label="Convidados" value={evento.convidados.toString()} />
                <Info icon={<Phone className="h-3.5 w-3.5" />} label="Contato" value={evento.telefone} />
                <Info icon={<Mail className="h-3.5 w-3.5" />} label="E-mail" value={evento.email} />
              </div>
            </div>

            <div className="rounded-xl bg-background/60 border border-border p-5">
              <div className="label-eyebrow">Receita prevista</div>
              <div className="font-display text-2xl font-semibold mt-2">{fmtBRL(evento.valorNegociado)}</div>
              <div className="mt-4 space-y-2 text-sm">
                <RowMini k="Custo" v={fmtBRL(calc.custoTotal)} />
                <RowMini k="Repasse" v={fmtBRL(calc.repasse)} />
                <RowMini k="Lucro" v={fmtBRL(calc.lucro)} highlight />
                <RowMini k="Margem" v={fmtPct(calc.margemPct)} />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-border">
          {["Visão geral", "Drinks", "Cálculo", "Equipe", "Contrato", "Histórico"].map((t, i) => (
            <button
              key={t}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                i === 0 ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <SectionCard title="Drinks selecionados" subtitle={`${drinksSel.length} itens no menu`} className="xl:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {drinksSel.map((d) => (
                <div key={d.id} className="flex items-center gap-4 p-4 rounded-lg border border-border bg-background/40">
                  <div className="h-12 w-12 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Wine className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{d.nome}</div>
                    <div className="text-xs text-muted-foreground truncate">{d.categoria}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{fmtBRL(d.precoVenda)}</div>
                    <div className="text-[11px] text-muted-foreground">custo {fmtBRL(d.custoUnitario)}</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Estimativas operacionais" subtitle="Calculado pelas diretrizes">
            <dl className="space-y-3">
              <Big k="Doses estimadas" v={`${calc.dosesEstimadas}`} sub="bebidas a serem servidas" />
              <Big k="Gelo previsto" v={`${calc.geloKg} kg`} sub={`${(calc.geloKg / evento.convidados).toFixed(1)} kg/convidado`} />
              <Big k="Insumos" v={fmtBRL(calc.insumos)} sub="frutas, garnishes, etc." />
              <Big k="Equipe necessária" v={`${calc.equipeNec} pessoas`} sub="bartenders + apoio" />
              <Big k="Rentabilidade/convidado" v={fmtBRL(calc.rentabilidadePorConvidado)} sub="lucro por pessoa" />
            </dl>
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Quick title="Cronograma" desc="Definir horários de montagem, abertura e desmontagem." icon={<Calendar className="h-5 w-5" />} />
          <Quick title="Equipe" desc={`Escalar ${calc.equipeNec} bartenders e apoio.`} icon={<Users className="h-5 w-5" />} />
          <Quick title="Contrato" desc="Gerar PDF e enviar para assinatura." icon={<FileText className="h-5 w-5" />} />
        </div>
      </div>
    </>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="label-eyebrow flex items-center gap-1.5">{icon} {label}</div>
      <div className="text-sm font-medium mt-1.5 truncate">{value}</div>
    </div>
  );
}
function RowMini({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className={`text-sm ${highlight ? "text-success font-semibold" : "font-medium"}`}>{v}</span>
    </div>
  );
}
function Big({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div className="border-b border-border/60 pb-3">
      <div className="label-eyebrow">{k}</div>
      <div className="font-display text-xl font-semibold mt-1">{v}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
function Quick({ title, desc, icon }: { title: string; desc: string; icon: React.ReactNode }) {
  return (
    <div className="card-premium p-5 hover:border-border-strong transition-colors cursor-pointer">
      <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">{icon}</div>
      <div className="font-display text-base font-semibold mt-4">{title}</div>
      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
    </div>
  );
}
