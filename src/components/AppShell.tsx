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
  X,
  LayoutTemplate,
  Sparkles,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { goatAIService } from "@/services/goat-ai/goat-ai-service";
import logo from "@/assets/goatbar-logo.png";

const nav: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}[] = [
  { to: "/gia", label: "GIA", icon: Sparkles, exact: true },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/vendas", label: "Vendas", icon: ShoppingBag },
  { to: "/drinks", label: "Drinks", icon: Wine },
  { to: "/inventario", label: "Inventário", icon: Package },
  { to: "/eventos", label: "Eventos", icon: CalendarRange },
  { to: "/controladoria", label: "Controladoria", icon: BarChart3 },
  { to: "/contratos", label: "Contratos", icon: FileText },
  { to: "/modelos", label: "Modelos de Proposta", icon: LayoutTemplate },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export function AppShell({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const { loading, user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingAiCount, setPendingAiCount] = useState<number>(0);
  const visibleNav = nav;

  useEffect(() => {
    if (!user) return;
    goatAIService.getPendingCount().then((cnt) => setPendingAiCount(cnt)).catch(() => {});
  }, [user, location.pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  const initials = (user?.email ?? "GB").slice(0, 2).toUpperCase();
  const displayName = user?.email?.split("@")[0] ?? "Gestor";
  return (
    <div className="flex h-screen w-full min-w-0 max-w-[100vw] flex-col overflow-hidden bg-background text-foreground md:flex-row">
      {/* MOBILE TOPBAR */}
      <div className="shrink-0 flex items-center justify-between border-b border-border bg-surface p-4 md:hidden">
        <Link to="/gia" className="flex items-center gap-3">
          <img src={logo} alt="GOAT BAR" className="h-8 w-auto" />
          <div className="font-display text-[11px] font-semibold tracking-[0.18em] leading-none">
            GOAT BAR
          </div>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 text-muted-foreground hover:text-foreground"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* MOBILE MENU DRAWER */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[80vw] h-full bg-sidebar border-r border-sidebar-border shadow-2xl flex flex-col animate-in slide-in-from-left">
            <div className="flex items-center justify-between px-6 pt-7 pb-8 shrink-0">
              <Link
                to="/gia"
                className="flex items-center gap-3"
                onClick={() => setMobileMenuOpen(false)}
              >
                <img src={logo} alt="GOAT BAR" className="h-10 w-auto" />
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-3 mb-2 label-eyebrow shrink-0">Operação</div>
            <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
              {nav.map((item) => {
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
                    <span className="font-medium text-base flex-1">{item.label}</span>
                    {item.to === "/gia" && pendingAiCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-black">
                        {pendingAiCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="m-3 p-3 rounded-xl bg-sidebar-accent border border-sidebar-border shrink-0">
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
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-sidebar border-r border-sidebar-border h-screen overflow-y-auto">
        <div className="px-6 pt-7 pb-8 shrink-0">
          <Link to="/gia" className="flex items-center gap-3">
            <img src={logo} alt="GOAT BAR" className="h-12 w-auto" />
            <div>
              <div className="font-display text-[13px] font-semibold tracking-[0.18em] leading-none">
                GOAT BAR
              </div>
              <div className="label-eyebrow mt-1.5 leading-none">Management</div>
            </div>
          </Link>
        </div>

        <div className="px-3 mb-2 label-eyebrow shrink-0">Operação</div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto min-h-0">
          {nav.map((item) => {
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
                <span className="font-medium flex-1">{item.label}</span>
                {item.to === "/gia" && pendingAiCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-black">
                    {pendingAiCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User card */}
        <div className="m-3 p-3 rounded-xl bg-sidebar-accent border border-sidebar-border shrink-0">
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
      <main className="flex w-full min-w-0 max-w-[100vw] flex-1 flex-col overflow-y-auto overflow-x-hidden pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-0">
        {children ?? <Outlet />}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="grid grid-cols-5 px-2 py-2">
          {nav.slice(0, 5).map((item) => {
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
  title: ReactNode;
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
            <h1 className="font-display text-xl lg:text-2xl font-semibold leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs lg:text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className="lg:hidden">{action}</div>
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
  const [items, setItems] = useState<any[]>([]);

  const loadNotifications = async () => {
    try {
      const list = await goatAIService.listBudgetNotifications();
      setItems(list);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const pendingCount = items.filter((i) => i.approval_status === "pending").length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) loadNotifications();
        }}
        className="relative h-10 w-10 inline-flex items-center justify-center rounded-lg border border-border bg-surface hover:border-border-strong transition-colors cursor-pointer"
        aria-label="Abrir notificações"
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center animate-pulse">
            {pendingCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full right-0 mt-2 w-84 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-top-2 fade-in">
            <div className="p-4 border-b border-border bg-background/50 flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                Notificações
                {pendingCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary">
                    {pendingCount} nova{pendingCount > 1 ? "s" : ""}
                  </span>
                )}
              </h3>
              <button
                type="button"
                onClick={loadNotifications}
                className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Atualizar
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-border/40">
              {items.length === 0 ? (
                <div className="p-8 flex flex-col items-center justify-center text-center">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Inbox className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium">Nenhuma notificação</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Você ainda não possui notificações pendentes.
                  </p>
                </div>
              ) : (
                items.map((item) => {
                  const data = item.structured_data || {};
                  const eventId = item.matched_event_id || data.event_id;
                  const clientName = data.client_name || item.source_sender_name || "Cliente";
                  const eventType = data.event_type || data.event_name || "Orçamento";
                  const guests = data.guests;
                  const date = data.date;
                  const phone = data.phone || item.source_sender_id;

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 hover:bg-surface-hover/80 transition-colors flex flex-col gap-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-foreground truncate flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                          {clientName}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
                          {eventType}
                        </span>
                      </div>

                      <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                        {date && <span>📅 {date}</span>}
                        {guests && <span>👥 {guests} pax</span>}
                        {phone && <span>📞 {phone}</span>}
                      </div>

                      {eventId && (
                        <Link
                          to={`/eventos/${eventId}` as any}
                          onClick={() => setOpen(false)}
                          className="mt-1 text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 w-fit"
                        >
                          Abrir solicitação no sistema →
                        </Link>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
