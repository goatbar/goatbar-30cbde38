import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import logo from "@/assets/goatbar-logo.png";
import { getPublicLeadContext } from "@/lib/public-lead-session";
import {
  budgetRequestService,
  type BudgetRequestPayload,
  type BudgetRequestState,
  type PublicDrink,
  type PublicLeadContext,
} from "@/services/budget-request-service";
import { DrinkCardImage } from "./DrinkCardImage";

const EVENT_TYPES = ["Casamento", "Corporativo", "Aniversário", "Comemoração"] as const;

interface PublicBudgetRequestFormProps {
  mode: "public" | "token";
  token?: string;
}

export function PublicBudgetRequestForm({ mode, token }: PublicBudgetRequestFormProps) {
  const context = useMemo<PublicLeadContext | null>(() => {
    if (mode !== "public" || typeof window === "undefined") return null;
    return getPublicLeadContext();
  }, [mode]);

  const [tokenState, setTokenState] = useState<BudgetRequestState | "LOADING" | "SUCCESS">("LOADING");
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
    lead_source: "Site",
    referral_name: "",
    notes: "",
    groom_name: "",
    bride_name: "",
    duration_hours: 6,
    requested_drink_ids: [],
  });

  // Load public journey or validate token
  useEffect(() => {
    let isMounted = true;

    if (mode === "public") {
      if (!context) {
        setLoading(false);
        return;
      }
      budgetRequestService
        .startPublicJourney(context)
        .then((result) => {
          if (isMounted) {
            setPublicDrinks(result.public_drinks || []);
          }
        })
        .catch((err) => {
          console.warn("[budget-request] failed to start public journey:", err);
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else if (mode === "token" && token) {
      budgetRequestService
        .validate(token)
        .then((result) => {
          if (!isMounted) return;
          setTokenState(result.state);
          const drinks = result.public_drinks || [];
          setPublicDrinks(drinks);
          if (result.state === "ACTIVE" && result.metadata?.customer_name_hint) {
            setForm((old) => ({ ...old, client_name: result.metadata!.customer_name_hint! }));
          }
        })
        .catch(() => {
          if (isMounted) setTokenState("INVALID");
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [mode, token, context]);

  // Background lead capture on public mode when Name + WhatsApp are valid
  useEffect(() => {
    if (mode !== "public" || !context) return;
    const digits = form.phone.replace(/\D/g, "");
    if (form.client_name.trim().length < 2 || digits.length < 10) return;

    const timer = window.setTimeout(() => {
      budgetRequestService
        .capturePublicLead(context, {
          client_name: form.client_name.trim(),
          phone: form.phone.trim(),
          email: form.email?.trim() || undefined,
        })
        .catch((err) => {
          console.warn("[budget-request] background lead capture failed:", err);
        });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [mode, context, form.client_name, form.phone, form.email]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (mode === "public") {
        if (!context) throw new Error("Sessão não inicializada.");
        await budgetRequestService.submitPublicLeadRequest(context, form);
        setSuccess(true);
      } else if (mode === "token" && token) {
        await budgetRequestService.submit(token, form);
        setTokenState("SUCCESS");
        setSuccess(true);
      }
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
    placeholder?: string,
  ) => (
    <label className="space-y-2 text-sm font-medium">
      {label}
      <input
        type={type}
        required={required}
        placeholder={placeholder}
        value={String(form[key] ?? "")}
        onChange={(e) =>
          setForm((old) => ({
            ...old,
            [key]: type === "number" ? Number(e.target.value) : e.target.value,
          }))
        }
        className="mt-2 h-11 w-full rounded-lg border border-border bg-input px-3 outline-none focus:border-primary placeholder:text-muted-foreground/60"
      />
    </label>
  );

  if (loading || (mode === "token" && tokenState === "LOADING")) {
    return (
      <PublicShell>
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </PublicShell>
    );
  }

  if (mode === "token" && tokenState !== "ACTIVE" && tokenState !== "SUCCESS" && tokenState !== "USED") {
    const copyMap: Record<string, [string, string]> = {
      INVALID: ["Link inválido", "Este link não existe ou não está mais disponível."],
      EXPIRED: ["Link expirado", "Solicite um novo link à equipe da Goat Bar."],
      CANCELLED: ["Link cancelado", "Este link foi cancelado pela equipe."],
    };
    const copy = copyMap[tokenState] || ["Link indisponível", "Solicite um novo link à equipe."];

    return (
      <PublicShell>
        <AlertTriangle className="h-12 w-12 text-warning" />
        <h1 className="font-display text-2xl font-bold">{copy[0]}</h1>
        <p className="text-muted-foreground">{copy[1]}</p>
      </PublicShell>
    );
  }

  if (success || (mode === "token" && (tokenState === "SUCCESS" || tokenState === "USED"))) {
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
  }

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

          {isWedding
            ? field("Nome do casal *", "event_name", "text", true, "Ex.: João e Maria")
            : field("Nome do evento *", "event_name", "text", true, "Ex.: Aniversário 40 anos")}

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
                Selecione os seus preferidos. Essa escolha serve como referência para nossa equipe
                preparar o orçamento e pode ser ajustada posteriormente.
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
                        <div className="relative flex h-48 w-full items-center justify-center bg-black/40 p-2 overflow-hidden">
                          <DrinkCardImage src={drink.image} alt={drink.name} />
                        </div>
                        <div className="space-y-2 p-4">
                          <h3 className="break-words font-display font-bold text-sm text-foreground">
                            {drink.name}
                          </h3>
                          {drink.description && (
                            <p className="break-words text-xs text-muted-foreground line-clamp-3">
                              {drink.description}
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
            type="submit"
            disabled={submitting}
            className="sm:col-span-2 inline-flex h-12 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground disabled:opacity-60 cursor-pointer"
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
