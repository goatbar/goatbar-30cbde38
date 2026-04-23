import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SectionCard, PrimaryButton, GhostButton } from "@/components/ui-bits";
import { eventos } from "@/lib/mock-data";
import { ArrowLeft, Save, Camera } from "lucide-react";

export const Route = createFileRoute("/pos-evento/$eventoId")({
  component: () => (
    <AppShell>
      <PosEvento />
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
      </div>
    </AppShell>
  ),
});

function PosEvento() {
  const { evento } = Route.useLoaderData();

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link to="/eventos/$eventoId" params={{ eventoId: evento.id }} className="inline-flex items-center gap-1.5">
            <ArrowLeft className="h-3 w-3" /> {evento.nome}
          </Link>
        }
        title="Fechamento pós-evento"
        subtitle="Lance os dados reais para alimentar a inteligência operacional."
        action={
          <div className="flex items-center gap-2">
            <GhostButton>Salvar rascunho</GhostButton>
            <PrimaryButton><Save className="h-4 w-4" /> Concluir fechamento</PrimaryButton>
          </div>
        }
      />

      <div className="px-8 py-7 space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <SectionCard title="Consumo de bebidas" subtitle="Levado vs consumido">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Garrafas levadas" suffix="un" placeholder="0" />
              <Field label="Garrafas consumidas" suffix="un" placeholder="0" />
              <Field label="Drinks servidos" suffix="un" placeholder="0" />
              <Field label="Sacos de gelo" suffix="sacos" placeholder="0" />
            </div>
          </SectionCard>

          <SectionCard title="Insumos e perdas" subtitle="Frutas, copos e quebras">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Frutas / garnishes" suffix="kg" placeholder="0" />
              <Field label="Quebra de copos" suffix="un" placeholder="0" />
              <Field label="Perdas estimadas" suffix="R$" placeholder="0,00" />
              <Field label="Outros insumos" suffix="R$" placeholder="0,00" />
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Resultado financeiro real">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Receita realizada" suffix="R$" placeholder="0,00" />
            <Field label="Custo real total" suffix="R$" placeholder="0,00" />
            <Field label="Repasse efetuado" suffix="R$" placeholder="0,00" />
          </div>
        </SectionCard>

        <SectionCard title="Avaliação da operação" subtitle="Equipe, ocorrências e observações">
          <div className="space-y-5">
            <div>
              <label className="label-eyebrow">Avaliação da equipe</label>
              <div className="mt-2 flex gap-2">
                {["Excelente", "Bom", "Regular", "Insuficiente"].map((o, i) => (
                  <button
                    key={o}
                    className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                      i === 0 ? "border-primary bg-primary/10 text-foreground" : "border-border bg-surface text-muted-foreground hover:border-border-strong"
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label-eyebrow">Ocorrências</label>
              <textarea
                rows={4}
                className="mt-2 w-full rounded-lg bg-input border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                placeholder="Registre incidentes, atrasos ou pontos de atenção..."
              />
            </div>
            <div>
              <label className="label-eyebrow">Observações gerais</label>
              <textarea
                rows={3}
                className="mt-2 w-full rounded-lg bg-input border border-border px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                placeholder="Aprendizados e recomendações para próximos eventos similares..."
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Anexos" subtitle="Fotos do evento, comprovantes, NFs">
          <div className="border-2 border-dashed border-border rounded-xl p-10 text-center hover:border-border-strong transition-colors cursor-pointer">
            <Camera className="h-8 w-8 mx-auto text-muted-foreground" />
            <div className="mt-3 font-medium">Arraste arquivos ou clique para enviar</div>
            <div className="text-xs text-muted-foreground mt-1">JPG, PNG ou PDF até 10MB</div>
          </div>
        </SectionCard>
      </div>
    </>
  );
}

function Field({ label, suffix, placeholder }: { label: string; suffix: string; placeholder: string }) {
  return (
    <div>
      <label className="label-eyebrow">{label}</label>
      <div className="mt-2 flex items-center rounded-lg bg-input border border-border focus-within:border-primary transition-colors">
        <input
          type="text"
          placeholder={placeholder}
          className="flex-1 bg-transparent px-4 py-2.5 text-sm focus:outline-none"
        />
        <span className="px-3 text-xs text-muted-foreground border-l border-border">{suffix}</span>
      </div>
    </div>
  );
}
