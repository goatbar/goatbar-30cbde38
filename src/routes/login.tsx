import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import logo from "@/assets/goatbar-logo.png";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading: sessionLoading, signIn } = useAuth();
  const [email, setEmail] = useState("admin@goat.com");
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

    const result = await signIn(email.trim(), password);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen w-full flex bg-background text-foreground">
      <div className="hidden lg:flex flex-col justify-between flex-1 relative overflow-hidden border-r border-border bg-sidebar">
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
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
          <p className="text-sm text-muted-foreground mt-4">Eventos · 7Steakhouse · Goat Botequim</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative z-20 pointer-events-auto">
        <div className="w-full max-w-sm relative z-20 pointer-events-auto">
          <div className="flex lg:hidden items-center gap-3 mb-10">
            <img src={logo} alt="GOAT BAR" className="h-12 w-auto" />
          </div>

          <div className="label-eyebrow mb-3">Acesso interno</div>
          <h1 className="font-display text-3xl font-semibold leading-tight">Bem-vindo de volta</h1>
          <p className="text-sm text-muted-foreground mt-2">Entre com suas credenciais para acessar o painel.</p>
          <p className="text-xs text-muted-foreground mt-2">
            Acesso demo: <strong>admin@goat.com</strong> / <strong>123456</strong>
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

            {error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
