import { Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShoppingBag,
  Wine,
  CalendarRange,
  FileText,
  Settings,
  Bell,
  Search,
  ChevronDown,
} from "lucide-react";
import type { ReactNode } from "react";

const nav: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/vendas", label: "Vendas", icon: ShoppingBag },
  { to: "/drinks", label: "Drinks", icon: Wine },
  { to: "/eventos", label: "Eventos", icon: CalendarRange },
  { to: "/contratos", label: "Contratos", icon: FileText },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export function AppShell() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* SIDEBAR */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-sidebar border-r border-sidebar-border">
        <div className="px-6 pt-7 pb-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-primary text-primary-foreground font-display font-bold text-lg">
              G
            </div>
            <div>
              <div className="font-display text-[15px] font-semibold tracking-tight leading-none">
                GOAT BAR
              </div>
              <div className="label-eyebrow mt-1.5 leading-none">Management</div>
            </div>
          </Link>
        </div>

        <div className="px-3 mb-2 label-eyebrow">Operação</div>
        <nav className="flex-1 px-3 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
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
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-primary-foreground font-display font-semibold">
              MR
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">Marina Rocha</div>
              <div className="text-[11px] text-muted-foreground truncate">Gestora · Goat Bar</div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 min-w-0 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: string;
  action?: ReactNode;
  periodo?: ReactNode;
}

export function PageHeader({ title, subtitle, breadcrumb, action, periodo }: PageHeaderProps) {
  return (
    <header className="topbar-glass sticky top-0 z-30">
      <div className="flex items-center gap-6 px-8 py-5">
        <div className="flex-1 min-w-0">
          {breadcrumb && <div className="label-eyebrow mb-2">{breadcrumb}</div>}
          <h1 className="font-display text-2xl font-semibold leading-tight">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>

        <div className="hidden md:flex items-center gap-3">
          {periodo ?? (
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface text-sm hover:border-border-strong transition-colors">
              <span className="label-eyebrow !text-foreground">Últimos 30 dias</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}

          <button className="hidden md:inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface hover:border-border-strong transition-colors">
            <Search className="h-4 w-4 text-muted-foreground" />
          </button>

          <button className="relative h-10 w-10 inline-flex items-center justify-center rounded-lg border border-border bg-surface hover:border-border-strong transition-colors">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
          </button>

          {action}
        </div>
      </div>
    </header>
  );
}
