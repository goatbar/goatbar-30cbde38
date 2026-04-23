import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import logo from "@/assets/goatbar-logo.png";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useAuth();
  const [email, setEmail] = useState("drinksgoatbar@gmail.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!sessionLoading && session) {
    return <Navigate to="/" />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Try sign in first
    let { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    // If user doesn't exist, attempt signup (auto-confirm enabled)
    if (signInError && /Invalid login credentials/i.test(signInError.message)) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (!signUpError) {
        const retry = await supabase.auth.signInWithPassword({ email, password });
        signInError = retry.error;
      } else if (!/already registered/i.test(signUpError.message)) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }
    }

    if (signInError) {
      setError("E-mail ou senha incorretos.");
      setLoading(false);
      return;
    }

    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen w-full flex bg-background text-foreground">
      {/* LEFT — branding */}
      <div className="hidden lg:flex flex-col justify-between flex-1 relative overflow-hidden border-r border-border bg-sidebar">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 20%, var(--primary) 0, transparent 45%), radial-gradient(circle at 70% 80%, var(--primary) 0, transparent 45%)",
          }}
        />
        <div className="relative px-14 pt-12">
          <div className="label-eyebrow">Goat Bar · Management System</div>
        </div>
        <div className="relative px-14 flex-1 flex items-center">
          <img src={logo} alt="GOAT BAR" className="w-72 h-auto" />
        </div>
        <div className="relative px-14 pb-12 max-w-lg">
          <p className="font-display text-2xl leading-snug font-medium">
            Hospitalidade premium,<br />
            <span className="text-muted-foreground">gestão de alta performance.</span>
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Eventos · 7Steakhouse · Goat Botequim
          </p>
        </div>
      </div>

      {/* RIGHT — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="flex lg:hidden items-center gap-3 mb-10">
            <img src={logo} alt="GOAT BAR" className="h-12 w-auto" />
          </div>

          <div className="label-eyebrow mb-3">Acesso interno</div>
          <h1 className="font-display text-3xl font-semibold leading-tight">
            Bem-vindo de volta
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Entre com suas credenciais para acessar o painel.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="label-eyebrow block mb-2">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-4 rounded-lg bg-surface border border-border focus:border-primary focus:outline-none text-sm transition-colors"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label className="label-eyebrow block mb-2">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 px-4 rounded-lg bg-surface border border-border focus:border-primary focus:outline-none text-sm transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="mt-10 text-[11px] text-muted-foreground text-center tracking-wider uppercase">
            © Goat Bar · Management System
          </p>
        </div>
      </div>
    </div>
  );
}
