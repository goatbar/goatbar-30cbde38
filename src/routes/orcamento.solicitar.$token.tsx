import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ImageOff, Loader2 } from "lucide-react";
import logo from "@/assets/goatbar-logo.png";
import {
  budgetRequestService,
  type BudgetRequestPayload,
  type BudgetRequestState,
  type PublicDrink,
} from "@/services/budget-request-service";

export const Route = createFileRoute("/orcamento/solicitar/$token")({
  component: PublicBudgetRequestPage,
});
const EVENT_TYPES = ["Casamento", "Corporativo", "Aniversário", "Confraternização"];

function PublicBudgetRequestPage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<BudgetRequestState | "LOADING" | "SUCCESS">("LOADING");
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
    duration_hours: 5,
    requested_drink_ids: [],
  });

  useEffect(() => {
    budgetRequestService
      .validate(token)
      .then((result) => {
        setState(result.state);
        const drinks = result.public_drinks || [];
        setPublicDrinks(drinks);
        if (drinks.length === 0 && process.env.NODE_ENV !== "production") {
          console.info(
            "[budget-request] public_drinks retornou vazio ([]). Para exibir drinks na carta pública, configure show_in_public_menu = true e modalidade Evento ativa.",
          );
        }
        if (result.state === "ACTIVE" && result.metadata?.customer_name_hint)
          setForm((old) => ({ ...old, client_name: result.metadata!.customer_name_hint! }));
      })
      .catch(() => setState("INVALID"));
  }, [token]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await budgetRequestService.submit(token, form);
      setState("SUCCESS");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDrink = (id: string) =>
    setForm((old) => ({
      ...old,
      requested_drink_ids: old.requested_drink_ids?.includes(id)
        ? old.requested_drink_ids.filter((drinkId) => drinkId !== id)
        : [...(old.requested_drink_ids || []), id],
    }));

  if (state === "LOADING")
    return (
      <PublicShell>
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </PublicShell>
    );
  if (state === "SUCCESS" || state === "USED")
    return (
      <PublicShell>
        <CheckCircle2 className="h-14 w-14 text-success" />
        <h1 className="font-display text-2xl font-bold">Solicitação recebida!</h1>
        <p className="max-w-md text-center text-muted-foreground">
          Recebemos as informações do seu evento. Nossa equipe da Goat Bar irá preparar seu
          orçamento e entrar em contato pelo WhatsApp.
        </p>
      </PublicShell>
    );
  if (state !== "ACTIVE") {
    const copy = {
      INVALID: ["Link inválido", "Este link não existe ou não está mais disponível."],
      EXPIRED: ["Link expirado", "Solicite um novo link à equipe da Goat Bar."],
      CANCELLED: ["Link cancelado", "Este link foi cancelado pela equipe."],
    }[state] || ["Link indisponível", "Solicite um novo link à equipe."];
    return (
      <PublicShell>
        <AlertTriangle className="h-12 w-12 text-warning" />
        <h1 className="font-display text-2xl font-bold">{copy[0]}</h1>
        <p className="text-muted-foreground">{copy[1]}</p>
      </PublicShell>
    );
  }

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
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <main className="mx-auto max-w-5xl rounded-2xl border border-border bg-surface p-5 shadow-xl sm:p-9">
        <img src={logo} alt="Goat Bar" className="mx-auto mb-7 h-16 object-contain" />
        <h1 className="font-display text-2xl font-bold">Solicite seu orçamento</h1>
        <p className="mb-7 mt-2 text-sm text-muted-foreground">
          Conte as informações iniciais do evento. Nossa equipe cuidará dos detalhes comerciais
          depois.
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
          {field("Nome do evento / casal", "event_name")}
          {field("Data do evento *", "date", "date", true)}
          {field("Horário", "event_time", "time")}
          <label className="space-y-2 text-sm font-medium">
            Duração do evento *
            <select
              value={form.duration_hours}
              onChange={(e) =>
                setForm((old) => ({ ...old, duration_hours: Number(e.target.value) }))
              }
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
                Tem algum drink que não pode faltar?
              </legend>
              <p className="text-sm text-muted-foreground">
                Com base na nossa carta de drinks, selecione os seus favoritos. Isso nos ajuda a
                preparar uma proposta mais personalizada.
              </p>
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {publicDrinks.map((drink) => {
                  const selected = form.requested_drink_ids?.includes(drink.id) || false;
                  return (
                    <label
                      key={drink.id}
                      className={`relative flex min-w-0 flex-col justify-between cursor-pointer overflow-hidden rounded-xl border transition-all select-none ${
                        selected
                          ? "border-primary bg-primary/10 ring-2 ring-primary shadow-md"
                          : "border-border bg-background/60 hover:border-border-strong hover:bg-background/80"
                      }`}
                    >
                      <div>
                        {drink.image ? (
                          <img
                            src={drink.image}
                            alt={drink.name}
                            className="h-36 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-36 items-center justify-center bg-input text-muted-foreground">
                            <ImageOff className="h-8 w-8 opacity-60" />
                          </div>
                        )}
                        <div className="space-y-2 p-4">
                          <h3 className="break-words font-display font-bold text-sm text-foreground">
                            {drink.name}
                          </h3>
                          {drink.description && (
                            <p className="break-words text-xs text-muted-foreground line-clamp-3">
                              {drink.description}
                            </p>
                          )}
                          {drink.ingredients.length > 0 && (
                            <p className="break-words text-[11px] text-muted-foreground/90">
                              <span className="font-semibold text-foreground/80">Insumos:</span>{" "}
                              {drink.ingredients.join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="p-4 pt-0">
                        <span
                          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                            selected
                              ? "bg-primary text-primary-foreground"
                              : "bg-surface text-muted-foreground"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleDrink(drink.id)}
                            className="h-4 w-4 accent-primary"
                          />
                          {selected ? "Selecionado" : "Quero este drink"}
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
          {error && (
            <p role="alert" className="sm:col-span-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <button
            disabled={submitting}
            className="sm:col-span-2 inline-flex h-12 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground disabled:opacity-60"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Solicitar orçamento
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
