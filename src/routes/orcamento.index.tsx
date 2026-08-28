import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import logo from "@/assets/goatbar-logo.png";

export const Route = createFileRoute("/orcamento/")({
  component: OrcamentoLandingPage,
});

const benefits = [
  "Coquetelaria pensada para o perfil do seu evento",
  "Equipe especializada e operação completa",
  "Proposta personalizada de acordo com sua necessidade",
];

function OrcamentoLandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-4 sm:px-6">
          <img src={logo} alt="Goat Bar" className="h-12 w-auto" />
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:py-24">
          <div className="flex flex-col justify-center">
            <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <Sparkles className="h-4 w-4" /> Goat Bar
            </div>
            <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              Seu evento merece drinks inesquecíveis.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              A Goat Bar transforma eventos em experiências através de coquetelaria, atendimento e uma operação pensada em cada detalhe.
            </p>
            <div className="mt-8">
              <Link
                to="/orcamento/solicitar"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 font-bold text-primary-foreground shadow-lg hover:bg-primary/90 transition-all cursor-pointer"
              >
                Solicitar orçamento <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Por que escolher a Goat Bar
            </p>
            <div className="mt-6 space-y-5">
              {benefits.map((item) => (
                <div key={item} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p className="text-sm leading-6 sm:text-base">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-surface/50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Como funciona</p>
            <div className="mt-8 grid gap-4 md:grid-cols-4">
              {[
                ["01", "Conte sobre seu evento"],
                ["02", "Recebemos sua solicitação"],
                ["03", "Montamos uma proposta personalizada"],
                ["04", "Cuidamos da experiência no dia"],
              ].map(([number, title]) => (
                <div key={number} className="rounded-2xl border border-border bg-background p-5">
                  <div className="text-xs font-bold tracking-[0.18em] text-muted-foreground">{number}</div>
                  <div className="mt-3 font-display text-lg font-bold">{title}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
