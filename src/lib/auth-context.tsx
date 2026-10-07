import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AUTH_INIT_TIMEOUT_MS = 8_000;
const AUTH_REQUEST_TIMEOUT_MS = 15_000;

function getAuthErrorMessage(message: string | undefined) {
  if (!message) return null;

  if (message === "Invalid login credentials") {
    return "Credenciais inválidas";
  }

  if (message === "Email not confirmed") {
    return "Usuário ainda não está ativo";
  }

  if (message.toLowerCase().includes("captcha")) {
    return "Falha na validação de segurança. Tente novamente em instantes.";
  }

  return message;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let authEventSeen = false;

    const watchdog = setTimeout(() => {
      if (!mounted) return;
      console.error("[auth] A leitura da sessão excedeu o tempo limite; liberando a interface.");
      setLoading(false);
    }, AUTH_INIT_TIMEOUT_MS);

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted || authEventSeen) return;

        if (error) {
          console.error("[auth] Falha ao restaurar a sessão:", error);
          setSession(null);
        } else {
          setSession(data.session ?? null);
        }

        clearTimeout(watchdog);
        setLoading(false);
      })
      .catch((error) => {
        if (!mounted || authEventSeen) return;
        console.error("[auth] Erro inesperado ao restaurar a sessão:", error);
        clearTimeout(watchdog);
        setSession(null);
        setLoading(false);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;

      authEventSeen = true;
      clearTimeout(watchdog);
      setSession(nextSession ?? null);
      setLoading(false);

      if (event === "PASSWORD_RECOVERY" && typeof window !== "undefined") {
        window.sessionStorage.setItem("goatbar:password-recovery", "1");
        if (window.location.pathname !== "/primeiro-acesso") {
          window.location.replace("/primeiro-acesso");
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(watchdog);
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (usernameInput: string, password: string) => {
    const rawUsername = usernameInput.trim().toLowerCase();
    const username = rawUsername.startsWith("@") ? rawUsername.slice(1) : rawUsername;

    if (!/^[a-z0-9._-]+$/.test(username)) {
      return { error: "Usuário inválido" };
    }

    const internalAuthEmail = `${username}@goatbar.internal`;
    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: internalAuthEmail,
          password,
        }),
        AUTH_REQUEST_TIMEOUT_MS,
        "A autenticação demorou mais que o esperado. Recarregue a página e tente novamente.",
      );

      return { error: getAuthErrorMessage(error?.message) };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado ao autenticar";
      return { error: getAuthErrorMessage(message) ?? "Não foi possível realizar o login agora." };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signIn,
      signOut,
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
