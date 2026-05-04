import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SectionCard, StatCard, PrimaryButton, StatusBadge } from "@/components/ui-bits";
import { drinks, fmtBRL2, fichaTecnica } from "@/lib/mock-data";
import { Plus, Wine, TrendingUp, Layers, Sparkles } from "lucide-react";

export const Route = createFileRoute("/drinks")({
  component: () => (
    <AppShell>
      <DrinksPage />
    </AppShell>
  ),
});

function DrinksPage() {
  const ativos = drinks.filter((d) => d.status === "ativo").length;
  const custoMedio = drinks.reduce((a, d) => a + d.custoUnitario, 0) / drinks.length;
  const categorias = Array.from(new Set(drinks.map((d) => d.categoria)));

  return (
    <>
      <PageHeader
        breadcrumb="Catálogo"
        title="Drinks"
        subtitle="Mixologia da Goat Bar — ficha técnica e custo de insumos por dose."
        action={
          <PrimaryButton>
            <Plus className="h-4 w-4" /> Novo drink
          </PrimaryButton>
        }
      />

      <div className="px-8 py-7 space-y-7">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <StatCard label="Total no catálogo" value={drinks.length.toString()} icon={<Wine className="h-4 w-4" />} />
          <StatCard label="Drinks ativos" value={ativos.toString()} icon={<Sparkles className="h-4 w-4" />} />
          <StatCard label="Custo médio" value={fmtBRL2(custoMedio)} icon={<TrendingUp className="h-4 w-4" />} />
          <StatCard label="Categorias" value={categorias.length.toString()} icon={<Layers className="h-4 w-4" />} />
        </div>

        {/* Filtros categoria */}
        <div className="flex flex-wrap gap-2">
          <button className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">Todos</button>
          {categorias.map((c) => (
            <button
              key={c}
              className="px-4 py-1.5 rounded-full border border-border bg-surface text-xs hover:border-border-strong transition-colors"
            >
              {c}
            </button>
          ))}
        </div>

        <SectionCard title="Catálogo" subtitle={`${drinks.length} drinks · custo de insumos por dose`}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {drinks.map((d) => {
              return (
                <article
                  key={d.id}
                  className="group rounded-xl border border-border bg-background/40 hover:border-border-strong transition-all overflow-hidden"
                >
                  <div className="aspect-[5/3] bg-gradient-to-br from-primary/30 via-surface-2 to-background relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Wine className="h-12 w-12 text-primary/60" strokeWidth={1.25} />
                    </div>
                    <div className="absolute top-3 left-3">
                      <span className="label-eyebrow !text-foreground/90 px-2 py-1 rounded-md bg-background/60 backdrop-blur">
                        {d.categoria}
                      </span>
                    </div>
                    <div className="absolute top-3 right-3">
                      <StatusBadge status={d.status} />
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="font-display text-lg font-semibold">{d.nome}</h3>
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{d.descricao}</p>

                    {fichaTecnica[d.id] && (
                      <div className="mt-4 rounded-lg border border-border bg-background/40 p-3">
                        <div className="label-eyebrow mb-2">Ficha técnica</div>
                        <ul className="space-y-1">
                          {fichaTecnica[d.id].map((ing, idx) => (
                            <li key={idx} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{ing.nome}</span>
                              <span className="font-medium tabular-nums">{fmtBRL2(ing.custo)}</span>
                            </li>
                          ))}
                          <li className="flex items-center justify-between text-sm pt-2 mt-2 border-t border-border/60">
                            <span className="font-semibold">Custo total</span>
                            <span className="font-semibold tabular-nums">{fmtBRL2(d.custoUnitario)}</span>
                          </li>
                        </ul>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {d.disponibilidade.map((u) => (
                        <span key={u} className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-secondary text-muted-foreground">
                          {u}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
