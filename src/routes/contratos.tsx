import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SectionCard, StatusBadge, PrimaryButton, GhostButton } from "@/components/ui-bits";
import { fmtBRL } from "@/lib/mock-data";
import { useAppStore } from "@/lib/app-store";
import { Plus, Download, Save, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import logo from "@/assets/goatbar-logo.png";

export const Route = createFileRoute("/contratos")({
  component: () => (
    <AppShell>
      <ContratosPage />
    </AppShell>
  ),
});

function ContratosPage() {
  const { contratos, eventos, addContrato } = useAppStore();
  const [selectedId, setSelectedId] = useState(contratos[0]?.id);
  const contrato = contratos.find((c) => c.id === selectedId) ?? contratos[0];
  const evento = eventos.find((e) => e.id === contrato?.eventoId);
  const [clausulasEditaveis, setClausulasEditaveis] = useState<Record<string, string>>({});

  const contratoStorageKey = useMemo(
    () => (contrato ? `goatbar-contrato-texto-${contrato.id}` : ""),
    [contrato],
  );

  useEffect(() => {
    if (!contratoStorageKey) return;
    const salvo = window.localStorage.getItem(contratoStorageKey);
    if (!salvo) {
      setClausulasEditaveis({});
      return;
    }
    try {
      const parsed = JSON.parse(salvo) as Record<string, string>;
      setClausulasEditaveis(parsed);
    } catch {
      setClausulasEditaveis({});
    }
  }, [contratoStorageKey]);

  useEffect(() => {
    if (!contratoStorageKey) return;
    window.localStorage.setItem(contratoStorageKey, JSON.stringify(clausulasEditaveis));
  }, [clausulasEditaveis, contratoStorageKey]);

  if (!contrato) {
    return (
      <>
        <PageHeader breadcrumb="Documentos" title="Contratos" subtitle="Templates, geração e acompanhamento de assinaturas." />
        <div className="px-8 py-7">
          <SectionCard title="Sem contratos" subtitle="Cadastre um evento para começar.">
            <p className="text-sm text-muted-foreground">Nenhum contrato disponível no momento.</p>
          </SectionCard>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumb="Documentos"
        title="Contratos"
        subtitle="Templates, geração e acompanhamento de assinaturas."
        action={
          <PrimaryButton onClick={() => {
            const primeiroEvento = eventos[0];
            if (!primeiroEvento) return;
            addContrato({
              eventoId: primeiroEvento.id,
              cliente: primeiroEvento.cliente,
              status: "rascunho",
              template: "Padrão automático",
            });
          }}>
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
            title={`Contrato — ${contrato?.cliente ?? "Sem cliente"}`}
            subtitle={contrato?.template ?? "Sem template"}
            action={
              <div className="flex items-center gap-2">
                <GhostButton onClick={() => window.alert("Rascunho já persistido automaticamente no navegador.")}><Save className="h-3.5 w-3.5" /> Salvar rascunho</GhostButton>
                <PrimaryButton onClick={() => window.print()}><Download className="h-4 w-4" /> Exportar PDF</PrimaryButton>
              </div>
            }
          >
            <div className="rounded-xl bg-foreground/[0.04] border border-border p-10 font-sans text-sm leading-relaxed text-foreground/85 max-h-[640px] overflow-y-auto">
              <div className="text-center mb-8">
                <img src={logo} alt="Goat Bar" className="h-14 w-auto mx-auto mb-4" />
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
              <EditableClause
                value={clausulasEditaveis.objeto}
                defaultValue={`A CONTRATADA se compromete a prestar serviços de bar para o evento ${evento?.nome ?? "—"}, a ser realizado em ${evento ? new Date(evento.data).toLocaleDateString("pt-BR") : "—"}, no local ${evento?.local}, ${evento?.cidade}, com previsão de ${evento?.convidados ?? "—"} convidados.`}
                onChange={(text) => setClausulasEditaveis((prev) => ({ ...prev, objeto: text }))}
              />

              <h3 className="font-display text-base font-semibold mt-6 mb-2">CLÁUSULA 2ª — DO VALOR</h3>
              <EditableClause
                value={clausulasEditaveis.valor}
                defaultValue={`O valor total dos serviços contratados é de ${evento ? fmtBRL(evento.valorNegociado) : "—"}, a ser pago conforme condições comerciais acordadas em proposta anexa.`}
                onChange={(text) => setClausulasEditaveis((prev) => ({ ...prev, valor: text }))}
              />

              <h3 className="font-display text-base font-semibold mt-6 mb-2">CLÁUSULA 3ª — DO MENU</h3>
              <EditableClause
                value={clausulasEditaveis.menu}
                defaultValue="Os drinks contratados compõem o menu da operação e poderão ser ajustados em comum acordo até 7 (sete) dias antes do evento."
                onChange={(text) => setClausulasEditaveis((prev) => ({ ...prev, menu: text }))}
              />

              <h3 className="font-display text-base font-semibold mt-6 mb-2">CLÁUSULA 4ª — DA EQUIPE</h3>
              <EditableClause
                value={clausulasEditaveis.equipe}
                defaultValue="A CONTRATADA disponibilizará equipe técnica composta por bartenders, apoio e supervisão operacional, dimensionada de acordo com o número de convidados."
                onChange={(text) => setClausulasEditaveis((prev) => ({ ...prev, equipe: text }))}
              />

              <h3 className="font-display text-base font-semibold mt-6 mb-2">CLÁUSULA 5ª — DAS OBRIGAÇÕES</h3>
              <EditableClause
                value={clausulasEditaveis.obrigacoes}
                defaultValue="Cabe à CONTRATADA o fornecimento dos insumos, equipamentos e estrutura de bar acordados. Cabe à CONTRATANTE garantir acesso ao local com antecedência mínima de 4 (quatro) horas."
                onChange={(text) => setClausulasEditaveis((prev) => ({ ...prev, obrigacoes: text }))}
              />

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

function EditableClause({
  value,
  defaultValue,
  onChange,
}: {
  value?: string;
  defaultValue: string;
  onChange: (value: string) => void;
}) {
  return (
    <textarea
      className="w-full resize-y min-h-[84px] rounded-lg border border-border bg-background/70 px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
      value={value ?? defaultValue}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
