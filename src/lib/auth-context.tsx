import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type MockUser = { email: string };

interface AuthContextValue {
  session: { user: MockUser } | null;
  user: MockUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AUTH_KEY = "goatbar_auth";
const ADMIN_EMAILS = ["drinksgoatbar@gmail.com"];
const ADMIN_PASSWORDS = ["Goatbar@1234"];

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MockUser;
        if (parsed?.email) setUser(parsed);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!ADMIN_EMAILS.includes(normalizedEmail) || !ADMIN_PASSWORDS.includes(password)) {
      return { error: "E-mail ou senha incorretos." };
    }
    const nextUser = { email: normalizedEmail };
    localStorage.setItem(AUTH_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    return { error: null };
  };

  const signOut = async () => {
    localStorage.removeItem(AUTH_KEY);
    setUser(null);
  };

  const value = useMemo(
    () => ({ session: user ? { user } : null, user, loading, signIn, signOut }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
