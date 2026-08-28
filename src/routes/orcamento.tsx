import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import logo from "@/assets/goatbar-logo.png";
import { getPublicLeadContext } from "@/lib/public-lead-session";
import { budgetRequestService, type BudgetRequestPayload } from "@/services/budget-request-service";

export const Route = createFileRoute("/orcamento")({
  component: OrcamentoLandingPage,
});

const benefits = [
  "Coquetelaria pensada para o perfil do seu evento",
  "Equipe especializada e operação completa",
  "Proposta personalizada de acordo com sua necessidade",
];

const initialForm: BudgetRequestPayload = {
  client_name: "",
  phone: "",
  email: "",
  event_name: "",
  date: "",
  event_time: "",
  event_location: "",
  city: "São Paulo",
  event_type: "Casamento",
  guests: 100,
  lead_source: "Site",
  referral_name: "",
  notes: "",
  groom_name: "",
  bride_name: "",
  duration_hours: 5,
  requested_drink_ids: [],
};

function OrcamentoLandingPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const context = useMemo(() => (typeof window === "undefined" ? null : getPublicLeadContext()), []);

  useEffect(() => {
    if (!context) return;
    budgetRequestService.startPublicJourney(context).catch(() => undefined);
  }, [context]);

  const update = (key: keyof BudgetRequestPayload, value: string | number) =>
    setForm((old) => ({ ...old, [key]: value }));

  const captureContact = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!context) return;
    setBusy(true);
    setError("");
    try {
      await budgetRequestService.capturePublicLead(context, {
        client_name: form.client_name,
        phone: form.phone,
        email: form.email,
      });
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar seu contato.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!context) return;
    setBusy(true);
    setError("");
    try {
      await budgetRequestService.submitPublicLeadRequest(context, form);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar sua solicitação.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <img src={logo} alt="Goat Bar" className="h-12 w-auto" />
          <a href="#solicitar" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
            Solicitar orçamento <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:py-24">
          <div className="flex flex-col justify-center">
            <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <Sparkles className="h-4 w-4" /> Goat Bar
            </div>
            <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">Seu evento merece drinks inesquecíveis.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">A Goat Bar transforma eventos em experiências através de coquetelaria, atendimento e uma operação pensada em cada detalhe.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#solicitar" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 font-bold text-primary-foreground">Solicitar orçamento <ArrowRight className="h-4 w-4" /></a>
              <a href="#como-funciona" className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-surface px-5 font-semibold">Como funciona</a>
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Por que escolher a Goat Bar</p>
            <div className="mt-6 space-y-5">
              {benefits.map((item) => <div key={item} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p className="text-sm leading-6 sm:text-base">{item}</p></div>)}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="border-y border-border bg-surface/50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Como funciona</p>
            <div className="mt-8 grid gap-4 md:grid-cols-4">
              {[["01","Conte sobre seu evento"],["02","Recebemos sua solicitação"],["03","Montamos uma proposta personalizada"],["04","Cuidamos da experiência no dia"]].map(([number,title]) => <div key={number} className="rounded-2xl border border-border bg-background p-5"><div className="text-xs font-bold tracking-[0.18em] text-muted-foreground">{number}</div><div className="mt-3 font-display text-lg font-bold">{title}</div></div>)}
            </div>
          </div>
        </section>

        <section id="solicitar" className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="rounded-3xl border border-border bg-surface p-6 sm:p-10">
            {step === 1 && (
              <form onSubmit={captureContact} className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2"><h2 className="font-display text-3xl font-bold">Solicite seu orçamento</h2><p className="mt-3 text-muted-foreground">Comece com seus dados de contato. Eles são salvos antes da próxima etapa para que nossa equipe possa ajudar caso você não finalize.</p></div>
                <label className="text-sm font-medium">Nome *<input required value={form.client_name} onChange={(e)=>update("client_name",e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-border bg-input px-3" /></label>
                <label className="text-sm font-medium">WhatsApp *<input required type="tel" value={form.phone} onChange={(e)=>update("phone",e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-border bg-input px-3" /></label>
                <label className="text-sm font-medium sm:col-span-2">E-mail<input type="email" value={form.email} onChange={(e)=>update("email",e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-border bg-input px-3" /></label>
                <p className="sm:col-span-2 text-xs text-muted-foreground">Ao continuar, você concorda que a Goat Bar utilize seus dados para entrar em contato sobre seu evento e sua solicitação de orçamento. Isso não inclui consentimento automático para campanhas de marketing.</p>
                {error && <p className="sm:col-span-2 text-sm text-destructive">{error}</p>}
                <button disabled={busy} className="sm:col-span-2 inline-flex h-12 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground disabled:opacity-60">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Continuar</button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2"><h2 className="font-display text-3xl font-bold">Conte sobre seu evento</h2><p className="mt-3 text-muted-foreground">Agora precisamos das informações principais para criar oficialmente sua solicitação.</p></div>
                <label className="text-sm font-medium">Tipo de evento *<select required value={form.event_type} onChange={(e)=>update("event_type",e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-border bg-input px-3">{["Casamento","Corporativo","Aniversário","Confraternização"].map((item)=><option key={item}>{item}</option>)}</select></label>
                <label className="text-sm font-medium">Data *<input required type="date" value={form.date} onChange={(e)=>update("date",e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-border bg-input px-3" /></label>
                {form.event_type === "Casamento" ? <><label className="text-sm font-medium">Nome do noivo *<input required value={form.groom_name} onChange={(e)=>update("groom_name",e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-border bg-input px-3" /></label><label className="text-sm font-medium">Nome da noiva *<input required value={form.bride_name} onChange={(e)=>update("bride_name",e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-border bg-input px-3" /></label></> : <label className="text-sm font-medium sm:col-span-2">Nome do evento<input value={form.event_name} onChange={(e)=>update("event_name",e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-border bg-input px-3" /></label>}
                <label className="text-sm font-medium">Convidados *<input required type="number" min={1} max={10000} value={form.guests} onChange={(e)=>update("guests",Number(e.target.value))} className="mt-2 h-11 w-full rounded-lg border border-border bg-input px-3" /></label>
                <label className="text-sm font-medium">Duração *<select value={form.duration_hours} onChange={(e)=>update("duration_hours",Number(e.target.value))} className="mt-2 h-11 w-full rounded-lg border border-border bg-input px-3">{[3,4,5,6,7,8].map((h)=><option key={h} value={h}>{h} horas</option>)}</select></label>
                <label className="text-sm font-medium">Horário<input type="time" value={form.event_time} onChange={(e)=>update("event_time",e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-border bg-input px-3" /></label>
                <label className="text-sm font-medium">Cidade<input value={form.city} onChange={(e)=>update("city",e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-border bg-input px-3" /></label>
                <label className="text-sm font-medium sm:col-span-2">Local do evento<input value={form.event_location} onChange={(e)=>update("event_location",e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-border bg-input px-3" /></label>
                <label className="text-sm font-medium sm:col-span-2">Observações<textarea value={form.notes} onChange={(e)=>update("notes",e.target.value)} className="mt-2 min-h-28 w-full rounded-lg border border-border bg-input p-3" /></label>
                {error && <p className="sm:col-span-2 text-sm text-destructive">{error}</p>}
                <button disabled={busy} className="sm:col-span-2 inline-flex h-12 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground disabled:opacity-60">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar solicitação</button>
              </form>
            )}

            {step === 3 && <div className="py-8 text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-primary" /><h2 className="mt-5 font-display text-3xl font-bold">Solicitação recebida!</h2><p className="mx-auto mt-3 max-w-xl text-muted-foreground">Seu evento foi registrado e nossa equipe entrará em contato pelo WhatsApp.</p></div>}
          </div>
        </section>
      </main>
    </div>
  );
}
