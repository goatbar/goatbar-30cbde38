import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import logo from "@/assets/goatbar-logo.png";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/primeiro-acesso")({
  component: FirstAccessPage,
});

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
  const [username, setUsername] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    if (!passwordIsValid(password)) {
      setErrorMessage("Use pelo menos 8 caracteres, com letra maiúscula, minúscula e número.");
      return;
    }
    if (password !== passwordConfirm) {
      setErrorMessage("As duas senhas precisam ser iguais.");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("first-access", {
        body: { action: "activate", username: username.trim(), code: accessCode.trim(), password },
      });
      if (error || !data?.success) {
        setErrorMessage(data?.error || "Não foi possível concluir o primeiro acesso. Confira usuário e código.");
        return;
      }
      setSaved(true);
      window.setTimeout(() => void navigate({ to: "/login", replace: true }), 900);
    } catch {
      setErrorMessage("Não foi possível concluir o primeiro acesso agora.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background px-5 py-[calc(2rem+env(safe-area-inset-top))] text-foreground sm:flex sm:items-center sm:justify-center sm:p-8">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <img src={logo} alt="GOAT BAR" className="h-11 w-auto" />
          <div><div className="font-display text-sm font-semibold tracking-[0.16em]">GOAT BAR</div><div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Acesso interno</div></div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-7">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10"><KeyRound className="h-5 w-5 text-primary" /></div>
          <h1 className="font-display text-2xl font-semibold">Primeiro acesso</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Informe seu usuário e o código temporário fornecido pelo administrador. Depois, crie sua senha pessoal.</p>
          {saved ? (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /><div><div className="text-sm font-semibold">Senha criada.</div><div className="mt-1 text-xs text-muted-foreground">Abrindo o login...</div></div></div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div><label className="label-eyebrow mb-2 block">Usuário</label><input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" className="h-11 w-full rounded-lg border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary" placeholder="@romulochaves" /></div>
              <div><label className="label-eyebrow mb-2 block">Código temporário</label><input type="text" required value={accessCode} onChange={(e) => setAccessCode(e.target.value.toUpperCase())} autoComplete="one-time-code" maxLength={8} className="h-11 w-full rounded-lg border border-border bg-background px-4 text-sm uppercase tracking-[0.16em] outline-none transition-colors focus:border-primary" placeholder="ABCD2345" /></div>
              <div><label className="label-eyebrow mb-2 block">Nova senha</label><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="h-11 w-full rounded-lg border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary" placeholder="Sua nova senha" /></div>
              <div><label className="label-eyebrow mb-2 block">Confirmar senha</label><input type="password" required value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} autoComplete="new-password" className="h-11 w-full rounded-lg border border-border bg-background px-4 text-sm outline-none transition-colors focus:border-primary" placeholder="Repita a nova senha" /></div>
              <p className="text-xs leading-relaxed text-muted-foreground">O código é de uso único e expira em 24 horas. A senha deve ter no mínimo 8 caracteres, incluindo maiúscula, minúscula e número.</p>
              {errorMessage && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorMessage}</div>}
              <button type="submit" disabled={saving} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? "Criando senha..." : "Criar minha senha"}</button>
            </form>
          )}
        </div>
        <div className="mt-5 text-center"><Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">Voltar para o login</Link></div>
      </div>
    </div>
  );
}
