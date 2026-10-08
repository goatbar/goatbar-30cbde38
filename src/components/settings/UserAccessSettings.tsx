import { useEffect, useState } from "react";
import { Copy, KeyRound, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

type UserOption = { user_id: string; username: string; display_name: string | null; active: boolean };

export function UserAccessSettings() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function initialize() {
      if (!user) return;
      const { data: caller, error: callerError } = await supabase
        .from("goatbar_user_profiles")
        .select("username, active")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!alive) return;
      const permitted = !callerError && caller?.active === true && caller?.username === "mariavelar";
      setIsAdmin(permitted);
      if (!permitted) {
        setLoading(false);
        return;
      }
      const { data, error: listError } = await supabase
        .from("goatbar_user_profiles")
        .select("user_id, username, display_name, active")
        .eq("active", true)
        .order("username");
      if (!alive) return;
      if (listError) setError("Não foi possível carregar os usuários.");
      else setUsers((data || []) as UserOption[]);
      setLoading(false);
    }
    void initialize();
    return () => { alive = false; };
  }, [user]);

  async function issueCode() {
    if (!username) return;
    setIssuing(true);
    setCode("");
    setExpiresAt("");
    setError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("first-access", {
        body: { action: "issue", username },
      });
      if (invokeError || !data?.success || !data?.code) {
        throw new Error(data?.error || "Não foi possível gerar o código. Verifique suas permissões.");
      }
      setCode(String(data.code));
      setExpiresAt(String(data.expires_at || ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar o código.");
    } finally {
      setIssuing(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Verificando permissões...</p>;
  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground">Somente a administradora de acessos pode gerar códigos. Solicite um código à administração da GOAT Bar.</p>;
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Gere um código para o primeiro acesso ou para redefinir uma senha esquecida.
        O novo código invalida os códigos anteriores e expira em 24 horas.
        Compartilhe o código somente com a pessoa autorizada.
      </p>
      <div className="space-y-2">
        <label htmlFor="access-user" className="label-eyebrow">Usuário</label>
        <select
          id="access-user"
          value={username}
          onChange={(e) => { setUsername(e.target.value); setCode(""); setError(""); }}
          className="h-11 w-full rounded-lg border border-border bg-background px-4 text-sm text-foreground"
        >
          <option value="">Selecione um usuário</option>
          {users.map((entry) => (
            <option key={entry.user_id} value={entry.username}>
              {entry.display_name ? entry.display_name + " — " : ""}@{entry.username}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={() => void issueCode()}
        disabled={!username || issuing}
        className="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {issuing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        {issuing ? "Gerando..." : "Gerar novo código"}
      </button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {code && (
        <div className="rounded-xl border border-border bg-background p-5 space-y-3">
          <div className="text-xs text-muted-foreground">Código temporário de @{username}</div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <strong className="font-mono text-2xl tracking-widest">{code}</strong>
            <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm" onClick={() => void navigator.clipboard.writeText(code)}>
              <Copy className="h-4 w-4" /> Copiar código
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Válido até {expiresAt ? new Date(expiresAt).toLocaleString("pt-BR") : "24 horas após a emissão"}. Uso único.</p>
          <a href="/primeiro-acesso" className="inline-block text-sm font-medium text-primary underline">Abrir página para criar ou redefinir senha</a>
        </div>
      )}
    </div>
  );
}
