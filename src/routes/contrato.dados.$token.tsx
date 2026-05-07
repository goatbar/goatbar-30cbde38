import { createFileRoute } from "@tanstack/react-router";
import { PrimaryButton, SectionCard } from "@/components/ui-bits";
import { useState, useEffect } from "react";
import logo from "@/assets/goatbar-logo.png";
import {
  CheckCircle2, Lock, Loader2, AlertTriangle,
  User, Calendar, MapPin, CreditCard, Wallet, Hash
} from "lucide-react";
import { clientContractFormService } from "@/services/contract-service";

export const Route = createFileRoute("/contrato/dados/$token")({
  component: ContratoDadosPublicPage,
});

/* ─── Opções de pagamento ─────────────────────────────────────── */
const FORMAS = [
  {
    id: "cartao_pix",
    label: "Cartão de Crédito + Pix",
    desc: "Inserir valor pago em Pix e parcelar o restante",
    hasCard: true,
    hasPixVal: true,
  },
  {
    id: "cartao",
    label: "Cartão de Crédito",
    desc: "Parcelar o valor integral",
    hasCard: true,
    hasPixVal: false,
  },
  {
    id: "entrada_30",
    label: "30% na assinatura + Restante na semana do evento",
    desc: "Pague 30% agora e o restante próximo ao evento",
    hasCard: false,
    hasPixVal: false,
  },
] as const;

type FormaId = (typeof FORMAS)[number]["id"];

/* ─── Pill radio reutilizável ─────────────────────────────────── */
function PillOption({
  selected,
  onClick,
  label,
  desc,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  desc?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-input text-muted-foreground hover:border-border-strong hover:text-foreground"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`h-4 w-4 rounded-full border-2 flex-shrink-0 transition-all ${
            selected ? "border-primary bg-primary" : "border-muted-foreground/40"
          }`}
        />
        <div>
          <div className="font-medium text-sm">{label}</div>
          {desc && (
            <div className="text-[11px] opacity-70 mt-0.5">{desc}</div>
          )}
        </div>
      </div>
    </button>
  );
}

/* ─── Página principal ────────────────────────────────────────── */
function ContratoDadosPublicPage() {
  const { token } = Route.useParams();
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  /* Campos pessoais */
  const [clientName, setClientName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");

  /* Campos do evento */
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [address, setAddress] = useState("");

  /* Pagamento */
  const [forma, setForma] = useState<FormaId | "">("");
  const [parcelas, setParcelas] = useState("1");
  const [pixValue, setPixValue] = useState("");

  const formaInfo = FORMAS.find((f) => f.id === forma);
  const needsCard = formaInfo?.hasCard ?? false;
  const needsPixVal = formaInfo?.hasPixVal ?? false;

  useEffect(() => {
    clientContractFormService
      .getFormByToken(token)
      .then((data) => { if (data.submitted_at) setSubmitted(true); })
      .catch(() => setError("O link acessado é inválido ou já expirou."))
      .finally(() => setPageLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forma) return;

    let paymentSummary = `Forma de Pagamento: ${formaInfo?.label}`;
    if (needsPixVal) {
      paymentSummary += ` | Valor em Pix: R$ ${pixValue}`;
    }
    if (needsCard) {
      paymentSummary += ` | Parcelas no Cartão: ${parcelas}x`;
    }

    const brEventDate = eventDate ? eventDate.split('-').reverse().join('/') : "";

    setSubmitting(true);
    try {
      await clientContractFormService.submitClientData(token, {
        client_name: clientName,
        cpf_cnpj: cpf,
        email,
        address,
        notes: [
          `Data do Evento: ${brEventDate}`,
          `Horário: ${eventTime}`,
          `Convidados: ${guestCount}`,
          paymentSummary,
        ].join("\n"),
      });
      setSubmitted(true);
    } catch {
      alert("Erro ao enviar dados. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Loading ── */
  if (pageLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
      </div>
    );
  }

  /* ── Erro ── */
  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="font-display text-2xl mb-2">Link Inválido</h2>
        <p className="text-muted-foreground max-w-sm">{error}</p>
      </div>
    );
  }

  /* ── Sucesso ── */
  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 bg-surface border border-border rounded-2xl text-center space-y-4 shadow-xl">
          <div className="h-16 w-16 mx-auto bg-success/10 rounded-full flex items-center justify-center text-success">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="font-display text-2xl">Dados Recebidos!</h2>
          <p className="text-muted-foreground">
            Suas informações foram enviadas com segurança. Em breve você receberá o contrato para assinatura digital.
          </p>
        </div>
      </div>
    );
  }

  /* ── Formulário ── */
  return (
    <div className="min-h-screen bg-background py-10 px-4 flex flex-col items-center">
      {/* Cabeçalho */}
      <div className="w-full max-w-2xl mb-8 flex flex-col items-center">
        <img src={logo} alt="GOAT BAR" className="h-16 w-auto mb-6" />
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-center leading-tight">
          Coleta de Dados <br /> para Contrato
        </h1>
        <p className="text-muted-foreground text-center mt-3 max-w-lg">
          Para a formalização do seu contrato com a <strong>Goat Bar</strong>, preencha os dados abaixo.
        </p>
      </div>

      <div className="w-full max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Dados Pessoais ── */}
          <SectionCard title="Dados Pessoais" subtitle="Informações do contratante">
            <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span>Como consta no seu documento oficial</span>
            </div>
            <div className="grid grid-cols-1 gap-5">
              <div>
                <label className="label-eyebrow block mb-2">Nome Completo *</label>
                <input
                  required
                  type="text"
                  placeholder="Como consta no CPF"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full h-11 px-4 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="label-eyebrow block mb-2">CPF *</label>
                  <input
                    required
                    type="text"
                    placeholder="000.000.000-00"
                    maxLength={14}
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    className="w-full h-11 px-4 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="label-eyebrow block mb-2">E-mail *</label>
                  <input
                    required
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 px-4 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ── Dados do Evento ── */}
          <SectionCard title="Dados do Evento" subtitle="Informações sobre a celebração">
            <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>Confirme os detalhes do seu evento</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label-eyebrow block mb-2">Data do Evento *</label>
                <input
                  required
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full h-11 px-4 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="label-eyebrow block mb-2">Horário *</label>
                <input
                  required
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="w-full h-11 px-4 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="label-eyebrow block mb-2">Número de Convidados *</label>
                <input
                  required
                  type="number"
                  min={1}
                  placeholder="Ex: 150"
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                  className="w-full h-11 px-4 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label-eyebrow block mb-2 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Local e Endereço do Evento *
                </label>
                <input
                  required
                  type="text"
                  placeholder="Nome do local, rua, número, bairro, cidade"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full h-11 px-4 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </SectionCard>

          {/* ── Forma de Pagamento ── */}
          <SectionCard title="Forma de Pagamento" subtitle="Selecione como deseja pagar">
            <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
              <Wallet className="h-3.5 w-3.5 shrink-0" />
              <span>Escolha a forma de pagamento preferida</span>
            </div>
            <div className="flex flex-col gap-3">
              {FORMAS.map((f) => (
                <PillOption
                  key={f.id}
                  selected={forma === f.id}
                  onClick={() => {
                    setForma(f.id);
                    if (!f.hasCard) setParcelas("1");
                    if (!f.hasPixVal) setPixValue("");
                  }}
                  label={f.label}
                  desc={f.desc}
                />
              ))}
            </div>

            {/* Condições dinâmicas */}
            {(needsCard || needsPixVal) && (
              <div className="mt-5 p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
                {needsPixVal && (
                  <div>
                    <label className="label-eyebrow block mb-2 flex items-center gap-1.5">
                      Valor a ser pago no Pix (R$) *
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="Ex: 5000,00"
                      value={pixValue}
                      onChange={(e) => setPixValue(e.target.value)}
                      className="w-full h-11 px-4 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                )}
                
                {needsCard && (
                  <div>
                    <label className="label-eyebrow block mb-2 flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5" /> Número de Parcelas no Cartão *
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        required
                        type="number"
                        min={1}
                        max={12}
                        value={parcelas}
                        onChange={(e) => setParcelas(e.target.value)}
                        className="w-24 h-11 px-4 rounded-lg bg-input border border-border text-sm text-center font-bold focus:border-primary focus:outline-none"
                      />
                      <span className="text-sm text-muted-foreground">
                        parcela{Number(parcelas) !== 1 ? "s" : ""} no cartão
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          {/* ── Resumo do pagamento ── */}
          {forma && (
            <div className="rounded-xl border border-success/30 bg-success/5 px-5 py-4 text-sm space-y-1">
              <div className="font-semibold text-success text-xs uppercase tracking-wider mb-2">Resumo selecionado</div>
              <div className="text-foreground">
                <span className="text-muted-foreground">Forma de Pagamento: </span>
                {formaInfo?.label}
              </div>
              {needsPixVal && pixValue && (
                <div className="text-foreground">
                  <span className="text-muted-foreground">Valor em Pix: </span>
                  R$ {pixValue}
                </div>
              )}
              {needsCard && (
                <div className="text-foreground">
                  <span className="text-muted-foreground">Parcelas: </span>
                  {parcelas}x no cartão
                </div>
              )}
            </div>
          )}

          {/* ── Rodapé ── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 pb-8">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background px-3 py-1.5 rounded-full border border-border">
              <Lock className="h-3 w-3" /> Ambiente Seguro — Goat Bar System
            </div>
            <PrimaryButton
              type="submit"
              disabled={submitting || !forma}
              className="w-full sm:w-auto h-12 px-8 text-base shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enviar Dados
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
