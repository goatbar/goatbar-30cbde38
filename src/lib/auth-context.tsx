import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const LOCAL_AUTH_KEY = "goatbar-local-auth";
const LOCAL_LOGIN_EMAIL = "drinksgoatbar@gmail.com";
const LOCAL_LOGIN_PASSWORD = "Goatbar@1234";

function getAuthErrorMessage(message: string | undefined) {
  if (!message) return null;

  if (message === "Invalid login credentials") {
    return "Credenciais inválidas";
  }

  if (message === "Email not confirmed") {
    return "E-mail ainda não confirmado";
  }

  if (message.toLowerCase().includes("captcha")) {
    return "Falha na validação de segurança. Tente novamente em instantes.";
  }

  return message;
}

function buildLocalUser(): User {
  return {
    id: "local-goatbar-admin",
    aud: "authenticated",
    role: "authenticated",
    email: LOCAL_LOGIN_EMAIL,
    email_confirmed_at: new Date(0).toISOString(),
    phone: "",
    confirmed_at: new Date(0).toISOString(),
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    app_metadata: {},
    user_metadata: { name: "Goatbar Local Admin" },
    identities: [],
    factors: [],
    is_anonymous: false,
  } as User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [localAuthed, setLocalAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const hasLocalAuth = typeof window !== "undefined" && window.localStorage.getItem(LOCAL_AUTH_KEY) === "1";
    if (hasLocalAuth) {
      setLocalAuthed(true);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    if (normalizedEmail === LOCAL_LOGIN_EMAIL && normalizedPassword === LOCAL_LOGIN_PASSWORD) {
      setLocalAuthed(true);
      window.localStorage.setItem(LOCAL_AUTH_KEY, "1");
      return { error: null };
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      return { error: getAuthErrorMessage(error?.message) };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado ao autenticar";
      return { error: getAuthErrorMessage(message) ?? "Não foi possível realizar o login agora." };
    }
  };

  const signOut = async () => {
    setLocalAuthed(false);
    window.localStorage.removeItem(LOCAL_AUTH_KEY);
    await supabase.auth.signOut();
  };

  const value = useMemo(
    () => ({
      session,
      user: localAuthed ? buildLocalUser() : session?.user ?? null,
      loading,
      signIn,
      signOut,
    }),
    [session, loading, localAuthed],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
