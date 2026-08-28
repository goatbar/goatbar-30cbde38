import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ImageOff, Loader2 } from "lucide-react";
import logo from "@/assets/goatbar-logo.png";
import { getPublicLeadContext } from "@/lib/public-lead-session";
import {
  budgetRequestService,
  type BudgetRequestPayload,
  type PublicDrink,
} from "@/services/budget-request-service";

export const Route = createFileRoute("/orcamento/solicitar")({
  component: PublicBudgetRequestPage,
});

const EVENT_TYPES = ["Casamento", "Corporativo", "Aniversário", "Confraternização"];

function PublicBudgetRequestPage() {
  const context = useMemo(() => (typeof window === "undefined" ? null : getPublicLeadContext()), []);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [publicDrinks, setPublicDrinks] = useState<PublicDrink[]>([]);
  const [form, setForm] = useState<BudgetRequestPayload>({
    client_name: "",
    event_name: "",
    phone: "",
    email: "",
    date: "",
    event_time: "",
    event_location: "",
    city: "São Paulo",
    event_type: "Casamento",
    guests: 100,
    lead_source: "",
    referral_name: "",
    notes: "",
    groom_name: "",
    bride_name: "",
    duration_hours: 5,
    requested_drink_ids: [],
  });

  useEffect(() => {
    if (!context) {
      setLoading(false);
      return;
    }
    budgetRequestService
      .startPublicJourney(context)
      .then((result) => setPublicDrinks(result.public_drinks || []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [context]);

  useEffect(() => {
    if (!context) return;
    const digits = form.phone.replace(/\D/g, "");
    if (form.client_name.trim().length < 2 || digits.length < 10) return;

    const timeout = window.setTimeout(() => {
      budgetRequestService
        .capturePublicLead(context, {
          client_name: form.client_name,
          phone: form.phone,
          email: form.email,
        })
        .catch(() => undefined);
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [context, form.client_name, form.phone, form.email]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!context) return;
    setSubmitting(true);
    setError("");
    try {
      await budgetRequestService.submitPublicLeadRequest(context, form);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const isWedding = form.event_type === "Casamento";
  const toggleDrink = (id: string) =>
    setForm((old) => ({
      ...old,
      requested_drink_ids: old.requested_drink_ids?.includes(id)
        ? old.requested_drink_ids.filter((drinkId) => drinkId !== id)
        : [...(old.requested_drink_ids || []), id],
    }));

  const field = (
    label: string,
    key: keyof BudgetRequestPayload,
    type = "text",
    required = false,
  ) => (
    <label className="space-y-2 text-sm font-medium">
      {label}
      <input
        type={type}
        required={required}
        value={String(form[key] ?? "")}
        onChange={(e) =>
          setForm((old) => ({
            ...old,
            [key]: type === "number" ? Number(e.target.value) : e.target.value,
          }))
        }
        className="mt-2 h-11 w-full rounded-lg border border-border bg-input px-3 outline-none focus:border-primary"
      />
    </label>
  );

  if (loading)
    return (
      <PublicShell>
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </PublicShell>
    );

  if (success)
    return (
      <PublicShell>
        <CheckCircle2 className="h-14 w-14 text-success" />
        <h1 className="font-display text-2xl font-bold">Solicitação recebida!</h1>
        <p className="max-w-md text-center text-muted-foreground">
          Recebemos as informações do seu evento. Nossa equipe da Goat Bar irá preparar seu orçamento e entrar em contato pelo WhatsApp.
        </p>
      </PublicShell>
    );

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <main className="mx-auto max-w-5xl rounded-2xl border border-border bg-surface p-5 shadow-xl sm:p-9">
        <img src={logo} alt="Goat Bar" className="mx-auto mb-7 h-16 object-contain" />
        <h1 className="font-display text-2xl font-bold">Solicite seu orçamento</h1>
        <p className="mb-7 mt-2 text-sm text-muted-foreground">
          Conte as informações iniciais do evento. Nossa equipe cuidará dos detalhes comerciais depois.
        </p>
        <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
          {field("Nome do solicitante *", "client_name", "text", true)}
          {field("WhatsApp *", "phone", "tel", true)}
          {field("E-mail", "email", "email")}
          <label className="space-y-2 text-sm font-medium">
            Tipo de evento *
            <select
              value={form.event_type}
              onChange={(e) => setForm((old) => ({ ...old, event_type: e.target.value }))}
              className="mt-2 h-11 w-full rounded-lg border border-border bg-input px-3"
            >
              {EVENT_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          {isWedding && field("Nome do noivo *", "groom_name", "text", true)}
          {isWedding && field("Nome da noiva *", "bride_name", "text", true)}
          {!isWedding && field("Nome do evento", "event_name")}
          {field("Data do evento *", "date", "date", true)}
          {field("Horário", "event_time", "time")}
          <label className="space-y-2 text-sm font-medium">
            Duração do evento *
            <select
              value={form.duration_hours}
              onChange={(e) => setForm((old) => ({ ...old, duration_hours: Number(e.target.value) }))}
              className="mt-2 h-11 w-full rounded-lg border border-border bg-input px-3"
            >
              {[3, 4, 5, 6, 7, 8].map((hours) => (
                <option key={hours} value={hours}>
                  {hours} horas
                </option>
              ))}
            </select>
          </label>
          {field("Local do evento", "event_location")}
          {field("Cidade", "city")}
          {field("Convidados *", "guests", "number", true)}
          <label className="space-y-2 text-sm font-medium">
            Como nos conheceu?
            <select
              value={form.lead_source}
              onChange={(e) => setForm((old) => ({ ...old, lead_source: e.target.value }))}
              className="mt-2 h-11 w-full rounded-lg border border-border bg-input px-3"
            >
              <option value="">A definir</option>
              {["Instagram", "Google", "WhatsApp", "Indicação", "Site"].map((source) => (
                <option key={source}>{source}</option>
              ))}
            </select>
          </label>
          {form.lead_source === "Indicação" && field("Quem indicou?", "referral_name")}

          {publicDrinks.length > 0 && (
            <fieldset className="sm:col-span-2 min-w-0 space-y-4 border-t border-border pt-6">
              <legend className="font-display text-lg font-bold">
                Com base na nossa carta de drinks, tem algum drink que não pode faltar no seu evento?
              </legend>
              <p className="text-sm text-muted-foreground">
                Selecione os seus preferidos. Essa escolha serve como referência para nossa equipe preparar o orçamento e pode ser ajustada posteriormente.
              </p>
              <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
                {publicDrinks.map((drink) => {
                  const selected = form.requested_drink_ids?.includes(drink.id) || false;
                  return (
                    <label
                      key={drink.id}
                      className={`min-w-0 cursor-pointer overflow-hidden rounded-xl border bg-background transition ${selected ? "border-primary ring-1 ring-primary" : "border-border"}`}
                    >
                      {drink.image ? (
                        <img src={drink.image} alt="" className="h-40 w-full object-cover" />
                      ) : (
                        <div className="flex h-40 items-center justify-center bg-input text-muted-foreground">
                          <ImageOff className="h-8 w-8" />
                        </div>
                      )}
                      <div className="space-y-2 p-4">
                        <h3 className="break-words font-display font-bold">{drink.name}</h3>
                        {drink.description && <p className="break-words text-sm text-muted-foreground">{drink.description}</p>}
                        {drink.ingredients.length > 0 && <p className="break-words text-xs text-muted-foreground">{drink.ingredients.join(", ")}</p>}
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleDrink(drink.id)}
                            className="h-4 w-4 accent-primary"
                          />
                          Quero este drink
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          <label className="space-y-2 text-sm font-medium sm:col-span-2">
            Observações
            <textarea
              maxLength={1500}
              value={form.notes}
              onChange={(e) => setForm((old) => ({ ...old, notes: e.target.value }))}
              className="mt-2 min-h-28 w-full rounded-lg border border-border bg-input p-3 outline-none focus:border-primary"
            />
          </label>

          <p className="sm:col-span-2 text-xs text-muted-foreground">
            Seus dados de contato são salvos durante o preenchimento para que nossa equipe possa ajudar caso você não conclua a solicitação. Isso não representa consentimento automático para campanhas de marketing.
          </p>

          {error && (
            <p role="alert" className="sm:col-span-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <button
            disabled={submitting}
            className="sm:col-span-2 inline-flex h-12 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground disabled:opacity-60"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Solicitar orçamento
          </button>
        </form>
      </main>
    </div>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-4 flex items-center justify-center">
      <main className="flex w-full max-w-lg flex-col items-center gap-5 rounded-2xl border border-border bg-surface p-10 shadow-xl">
        <img src={logo} alt="Goat Bar" className="h-16 object-contain" />
        {children}
      </main>
    </div>
  );
}
