import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, MessageCircle, ShieldCheck } from "lucide-react";
import logo from "@/assets/goatbar-logo.png";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/primeiro-acesso")({
  component: FirstAccessPage,
});

const GIA_WHATSAPP_URL =
  "https://wa.me/553192074076?text=PRIMEIRO%20ACESSO";

function passwordIsValid(password: string) {
  return (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password)
  );
}

function FirstAccessPage() {
  const navigate = useNavigate();
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [checkingRecovery, setCheckingRecovery] = useState(true);

  const [username, setUsername] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [phoneHint, setPhoneHint] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => {
    const marker =
      window.sessionStorage.getItem("goatbar:password-recovery") === "1";
    setRecoveryMode(marker);
    setCheckingRecovery(false);

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        window.sessionStorage.setItem("goatbar:password-recovery", "1");
        setRecoveryMode(true);
        setCheckingRecovery(false);
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const requestAccess = async (event: FormEvent) => {
    event.preventDefault();
    setRequesting(true);
    setRequestError(null);
    setRequestSent(false);
    setPhoneHint(null);

    try {
      const normalized = username.trim();
      const { data, error } = await supabase.functions.invoke("first-access", {
        body: { username: normalized },
      });

      if (error) {
        setRequestError(
          "Não conseguimos entregar o link automaticamente. Envie PRIMEIRO ACESSO para a GIA pelo seu WhatsApp cadastrado.",
        );
        return;
      }

      if (data?.success) {
        setRequestSent(true);
        setPhoneHint(data?.phone_hint || null);
      } else {
        setRequestError(
          "O WhatsApp não aceitou a mensagem automática agora. Envie PRIMEIRO ACESSO para a GIA pelo seu WhatsApp cadastrado.",
        );
      }
    } catch {
      setRequestError(
        "Não conseguimos solicitar o primeiro acesso agora. Tente novamente ou fale com a GIA pelo WhatsApp.",
      );
    } finally {
      setRequesting(false);
    }
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError(null);

    if (!passwordIsValid(password)) {
      setPasswordError(
        "Use pelo menos 8 caracteres, com letra maiúscula, minúscula e número.",
      );
      return;
    }

    if (password !== passwordConfirm) {
      setPasswordError("As duas senhas precisam ser iguais.");
      return;
    }

    setSavingPassword(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setPasswordError(
          "O link de primeiro acesso expirou ou já foi utilizado. Solicite um novo link.",
        );
        setRecoveryMode(false);
        window.sessionStorage.removeItem("goatbar:password-recovery");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setPasswordError(
          error.message || "Não foi possível definir a senha agora.",
        );
        return;
      }

      window.sessionStorage.removeItem("goatbar:password-recovery");
      setPasswordSaved(true);
      window.setTimeout(() => {
        void navigate({ to: "/gia", replace: true });
      }, 900);
    } catch {
      setPasswordError("Não foi possível definir a senha agora.");
    } finally {
      setSavingPassword(false);
    }
  };

  if (checkingRecovery) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background px-5 py-[calc(2rem+env(safe-area-inset-top))] text-foreground sm:flex sm:items-center sm:justify-center sm:p-8">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <img src={logo} alt="GOAT BAR" className="h-11 w-auto" />
          <div>
            <div className="font-display text-sm font-semibold tracking-[0.16em]">
              GOAT BAR
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Acesso interno
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-7">
          {recoveryMode ? (
            <>
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <h1 className="font-display text-2xl font-semibold">
                Crie sua senha
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Seu WhatsApp já confirmou este acesso. Agora escolha a senha que
                você vai usar para entrar no sistema.
              </p>

              {passwordSaved ? (
                <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                  <div>
                    <div className="text-sm font-semibold">Senha criada.</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Abrindo o Goat Bar...
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={savePassword} className="mt-6 space-y-4">
                  <div>
                    <label className="label-eyebrow mb-2 block">Nova senha</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="new-password"
                      className="h-11 w-full rounded-lg border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary"
                      placeholder="Sua nova senha"
                    />
                  </div>

                  <div>
                    <label className="label-eyebrow mb-2 block">
                      Confirmar senha
                    </label>
                    <input
                      type="password"
                      required
                      value={passwordConfirm}
                      onChange={(event) =>
                        setPasswordConfirm(event.target.value)
                      }
                      autoComplete="new-password"
                      className="h-11 w-full rounded-lg border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary"
                      placeholder="Repita a nova senha"
                    />
                  </div>

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Mínimo de 8 caracteres, incluindo maiúscula, minúscula e
                    número.
                  </p>

                  {passwordError && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {passwordError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-60"
                  >
                    {savingPassword && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {savingPassword ? "Criando senha..." : "Criar minha senha"}
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <h1 className="font-display text-2xl font-semibold">
                Primeiro acesso
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Informe seu usuário. O link seguro para criar sua senha será
                enviado somente para o WhatsApp já autorizado na GIA.
              </p>

              <form onSubmit={requestAccess} className="mt-6 space-y-4">
                <div>
                  <label className="label-eyebrow mb-2 block">Usuário</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    className="h-11 w-full rounded-lg border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary"
                    placeholder="@romulochaves"
                  />
                </div>

                {requestSent && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                      <div>
                        <div className="text-sm font-semibold">
                          Link enviado pelo WhatsApp.
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {phoneHint
                            ? `Enviamos para o número final ${phoneHint.replace("•••• ", "")}. `
                            : ""}
                          Abra a mensagem da GIA e toque no link para criar sua
                          senha.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {requestError && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                    <p>{requestError}</p>
                    <a
                      href={GIA_WHATSAPP_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 font-semibold text-primary hover:underline"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Abrir WhatsApp da GIA
                    </a>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={requesting}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-60"
                >
                  {requesting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {requesting ? "Enviando..." : "Enviar link pelo WhatsApp"}
                </button>
              </form>

              <div className="mt-5 border-t border-border pt-5">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Se a mensagem automática não chegar, envie{" "}
                  <strong className="text-foreground">PRIMEIRO ACESSO</strong>{" "}
                  para a GIA usando o seu número cadastrado.
                </p>
              </div>
            </>
          )}
        </div>

        {!recoveryMode && (
          <div className="mt-5 text-center">
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Voltar para o login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
