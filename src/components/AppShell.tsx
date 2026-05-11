import { Link, Outlet, useLocation, Navigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShoppingBag,
  Wine,
  Package,
  CalendarRange,
  FileText,
  Settings,
  Bell,
  Search,
  ChevronDown,
  LogOut,
  Inbox,
  BarChart3,
  Wallet,
  Menu,
  X
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import logo from "@/assets/goatbar-logo.png";

const nav: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean; roles?: string[] }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/vendas", label: "Vendas", icon: ShoppingBag },
  { to: "/drinks", label: "Drinks", icon: Wine },
  { to: "/inventario", label: "Inventário", icon: Package },
  { to: "/eventos", label: "Eventos", icon: CalendarRange },
  { to: "/controladoria", label: "Controladoria", icon: BarChart3, roles: ["admin", "financeiro"] },
  { to: "/contratos", label: "Contratos", icon: FileText, roles: ["admin", "comercial"] },
  { to: "/configuracoes", label: "Configurações", icon: Settings, roles: ["admin"] },
];

export function AppShell({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const { session, loading, user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const role = (user?.user_metadata?.role as string | undefined)?.toLowerCase() ?? "admin";
  const visibleNav = useMemo(
    () => nav.filter((item) => !item.roles || item.roles.includes(role)),
    [role],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" />;
  }

  const initials = (user?.email ?? "GB").slice(0, 2).toUpperCase();
  const displayName = user?.email?.split("@")[0] ?? "Gestor";
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* MOBILE TOPBAR */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-border bg-surface sticky top-0 z-40">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="GOAT BAR" className="h-8 w-auto" />
          <div className="font-display text-[11px] font-semibold tracking-[0.18em] leading-none">GOAT BAR</div>
        </Link>
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 text-muted-foreground hover:text-foreground">
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* MOBILE MENU DRAWER */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[80vw] h-full bg-sidebar border-r border-sidebar-border shadow-2xl flex flex-col animate-in slide-in-from-left">
            <div className="flex items-center justify-between px-6 pt-7 pb-8">
              <Link to="/" className="flex items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
                <img src={logo} alt="GOAT BAR" className="h-10 w-auto" />
              </Link>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="px-3 mb-2 label-eyebrow">Operação</div>
            <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const active = item.exact
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to as any}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`group flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-all ${
                      active
                        ? "bg-primary text-primary-foreground shadow-[0_4px_20px_-8px_var(--primary)]"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                    <span className="font-medium text-base">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="m-3 p-3 rounded-xl bg-sidebar-accent border border-sidebar-border">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-primary-foreground font-display font-semibold text-xs">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate capitalize">{displayName}</div>
                </div>
                <button
                  onClick={signOut}
                  className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-sidebar border-r border-sidebar-border sticky top-0 h-screen overflow-y-auto">
        <div className="px-6 pt-7 pb-8">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="GOAT BAR" className="h-12 w-auto" />
            <div>
              <div className="font-display text-[13px] font-semibold tracking-[0.18em] leading-none">
                GOAT BAR
              </div>
              <div className="label-eyebrow mt-1.5 leading-none">Management</div>
            </div>
          </Link>
        </div>

        <div className="px-3 mb-2 label-eyebrow">Operação</div>
        <nav className="flex-1 px-3 space-y-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to as any}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-[0_4px_20px_-8px_var(--primary)]"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User card */}
        <div className="m-3 p-3 rounded-xl bg-sidebar-accent border border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-primary-foreground font-display font-semibold text-xs">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate capitalize">{displayName}</div>
              <div className="text-[11px] text-muted-foreground truncate">Gestor · Goat Bar</div>
            </div>
            <button
              onClick={signOut}
              title="Sair"
              className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 min-w-0 flex flex-col pb-[calc(5.25rem+env(safe-area-inset-bottom))] lg:pb-0">
        {children ?? <Outlet />}
      </main>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="grid grid-cols-5 px-2 py-2">
          {visibleNav.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={`bottom-${item.to}`}
                to={item.to as any}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10px] ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate max-w-full">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: ReactNode;
  action?: ReactNode;
  periodo?: ReactNode;
}

export function PageHeader({ title, subtitle, breadcrumb, action, periodo }: PageHeaderProps) {
  return (
    <header className="bg-surface/50 lg:bg-transparent lg:topbar-glass lg:sticky lg:top-0 z-30 border-b border-border lg:border-none">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6 px-4 lg:px-8 py-4 lg:py-5">
        <div className="flex-1 min-w-0 flex items-center justify-between w-full lg:w-auto">
          <div>
            {breadcrumb && <div className="label-eyebrow mb-1 lg:mb-2">{breadcrumb}</div>}
            <h1 className="font-display text-xl lg:text-2xl font-semibold leading-tight">{title}</h1>
            {subtitle && (
              <p className="text-xs lg:text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className="lg:hidden">
            {action}
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-3">
          {periodo ?? (
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface text-sm hover:border-border-strong transition-colors">
              <span className="label-eyebrow !text-foreground">Últimos 30 dias</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}

          <button className="hidden md:inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface hover:border-border-strong transition-colors">
            <Search className="h-4 w-4 text-muted-foreground" />
          </button>

          <NotificationsDropdown />
          {action}
        </div>
      </div>
    </header>
  );
}

function NotificationsDropdown() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => setOpen(!open)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="relative h-10 w-10 inline-flex items-center justify-center rounded-lg border border-border bg-surface hover:border-border-strong transition-colors"
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-top-2 fade-in">
          <div className="p-4 border-b border-border bg-background/50">
            <h3 className="font-semibold text-sm">Notificações</h3>
          </div>
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Inbox className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium">Nenhuma notificação</p>
            <p className="text-xs text-muted-foreground mt-1">Você ainda não possui notificações pendentes.</p>
          </div>
        </div>
      )}
    </div>
  );
}
