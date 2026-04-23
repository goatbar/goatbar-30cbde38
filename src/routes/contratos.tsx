import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SectionCard, StatusBadge, PrimaryButton, GhostButton } from "@/components/ui-bits";
import { contratos, eventos, fmtBRL } from "@/lib/mock-data";
import { Plus, Download, Save, FileText } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/contratos")({
  component: () => (
    <AppShell>
      <ContratosPage />
    </AppShell>
  ),
});

function ContratosPage() {
  const [selectedId, setSelectedId] = useState(contratos[0]?.id);
  const contrato = contratos.find((c) => c.id === selectedId)!;
  const evento = eventos.find((e) => e.id === contrato.eventoId);

  return (
    <>
      <PageHeader
        breadcrumb="Documentos"
        title="Contratos"
        subtitle="Templates, geração e acompanhamento de assinaturas."
        action={
          <PrimaryButton>
            <Plus className="h-4 w-4" /> Novo contrato
          </PrimaryButton>
        }
      />

      <div className="px-8 py-7 grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Lista esquerda */}
        <div className="xl:col-span-4 space-y-5">
          <SectionCard title="Contratos" subtitle={`${contratos.length} documentos`}>
            <ul className="space-y-2">
              {contratos.map((c) => {
                const e = eventos.find((x) => x.id === c.eventoId);
                const active = c.id === selectedId;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${
                        active ? "border-primary bg-primary/10" : "border-border hover:border-border-strong"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{c.cliente}</div>
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {e?.nome ?? "—"}
                          </div>
                        </div>
                        <StatusBadge status={c.status} />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{c.template}</span>
                        <span>{new Date(c.criadoEm).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </SectionCard>

          <SectionCard title="Templates" subtitle="Modelos disponíveis">
            <ul className="space-y-2">
              {["Casamento Padrão", "Corporativo", "Aniversário", "Eventos Sociais"].map((t) => (
                <li
                  key={t}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-border-strong transition-colors cursor-pointer"
                >
                  <div className="h-9 w-9 rounded-md bg-primary/15 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 text-sm font-medium">{t}</div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        {/* Preview direita */}
        <div className="xl:col-span-8">
          <SectionCard
            title={`Contrato — ${contrato.cliente}`}
            subtitle={contrato.template}
            action={
              <div className="flex items-center gap-2">
                <GhostButton><Save className="h-3.5 w-3.5" /> Salvar rascunho</GhostButton>
                <PrimaryButton><Download className="h-4 w-4" /> Exportar PDF</PrimaryButton>
              </div>
            }
          >
            <div className="rounded-xl bg-foreground/[0.04] border border-border p-10 font-sans text-sm leading-relaxed text-foreground/85 max-h-[640px] overflow-y-auto">
              <div className="text-center mb-8">
                <div className="label-eyebrow">Goat Bar · Hospitalidade Premium</div>
                <h2 className="font-display text-2xl font-semibold mt-3">
                  CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE BAR
                </h2>
              </div>

              <p>
                Pelo presente instrumento particular, de um lado <strong>{contrato.cliente}</strong>,
                doravante denominado(a) <strong>CONTRATANTE</strong>, e de outro lado{" "}
                <strong>GOAT BAR LTDA</strong>, inscrita no CNPJ sob o nº 00.000.000/0001-00, doravante
                denominada <strong>CONTRATADA</strong>, têm entre si justo e contratado o seguinte:
              </p>

              <h3 className="font-display text-base font-semibold mt-6 mb-2">CLÁUSULA 1ª — DO OBJETO</h3>
              <p>
                A CONTRATADA se compromete a prestar serviços de bar para o evento{" "}
                <strong>{evento?.nome ?? "—"}</strong>, a ser realizado em{" "}
                <strong>{evento ? new Date(evento.data).toLocaleDateString("pt-BR") : "—"}</strong>, no
                local <strong>{evento?.local}, {evento?.cidade}</strong>, com previsão de{" "}
                <strong>{evento?.convidados} convidados</strong>.
              </p>

              <h3 className="font-display text-base font-semibold mt-6 mb-2">CLÁUSULA 2ª — DO VALOR</h3>
              <p>
                O valor total dos serviços contratados é de{" "}
                <strong>{evento ? fmtBRL(evento.valorNegociado) : "—"}</strong>, a ser pago conforme
                condições comerciais acordadas em proposta anexa.
              </p>

              <h3 className="font-display text-base font-semibold mt-6 mb-2">CLÁUSULA 3ª — DO MENU</h3>
              <p>
                Os drinks contratados compõem o menu da operação e poderão ser ajustados em comum acordo
                até 7 (sete) dias antes do evento.
              </p>

              <h3 className="font-display text-base font-semibold mt-6 mb-2">CLÁUSULA 4ª — DA EQUIPE</h3>
              <p>
                A CONTRATADA disponibilizará equipe técnica composta por bartenders, apoio e supervisão
                operacional, dimensionada de acordo com o número de convidados.
              </p>

              <h3 className="font-display text-base font-semibold mt-6 mb-2">CLÁUSULA 5ª — DAS OBRIGAÇÕES</h3>
              <p>
                Cabe à CONTRATADA o fornecimento dos insumos, equipamentos e estrutura de bar acordados.
                Cabe à CONTRATANTE garantir acesso ao local com antecedência mínima de 4 (quatro) horas.
              </p>

              <p className="mt-10 text-center text-muted-foreground">
                São Paulo, {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
              </p>

              <div className="mt-10 grid grid-cols-2 gap-12 text-center">
                <div>
                  <div className="border-t border-foreground/30 pt-2 text-xs">{contrato.cliente}</div>
                  <div className="text-[11px] text-muted-foreground">CONTRATANTE</div>
                </div>
                <div>
                  <div className="border-t border-foreground/30 pt-2 text-xs">Goat Bar Ltda</div>
                  <div className="text-[11px] text-muted-foreground">CONTRATADA</div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
