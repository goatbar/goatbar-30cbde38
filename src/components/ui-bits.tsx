import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function StatCard({
  label,
  value,
  delta,
  hint,
  icon,
}: {
  label: string;
  value: string;
  delta?: number;
  hint?: string;
  icon?: ReactNode;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="card-premium p-6 relative overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="label-eyebrow">{label}</div>
        {icon && (
          <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
            {icon}
          </div>
        )}
      </div>
      <div className="mt-4 font-display text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        {delta !== undefined && (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${
              positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            }`}
          >
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card-premium ${className}`}>
      <header className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-border">
        <div>
          <h2 className="font-display text-base font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="p-6">{children}</div>
    </section>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    confirmado: { bg: "bg-success/10", fg: "text-success", label: "Confirmado" },
    em_andamento: { bg: "bg-warning/10", fg: "text-warning", label: "Em andamento" },
    rascunho: { bg: "bg-muted", fg: "text-muted-foreground", label: "Rascunho" },
    concluido: { bg: "bg-secondary", fg: "text-foreground", label: "Concluído" },
    cancelado: { bg: "bg-destructive/10", fg: "text-destructive", label: "Cancelado" },
    ativo: { bg: "bg-success/10", fg: "text-success", label: "Ativo" },
    inativo: { bg: "bg-muted", fg: "text-muted-foreground", label: "Inativo" },
    assinado: { bg: "bg-success/10", fg: "text-success", label: "Assinado" },
    enviado: { bg: "bg-warning/10", fg: "text-warning", label: "Enviado" },
  };
  const s = map[status] || { bg: "bg-secondary", fg: "text-foreground", label: status };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider ${s.bg} ${s.fg}`}>
      {s.label}
    </span>
  );
}

export function PrimaryButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-all shadow-[0_8px_24px_-12px_var(--primary)] ${rest.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface text-sm hover:border-border-strong transition-all ${rest.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function MiniBars({ data, height = 60 }: { data: number[]; height?: number }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-gradient-to-t from-primary/70 to-primary-glow/80"
          style={{ height: `${(v / max) * 100}%`, minHeight: 3 }}
        />
      ))}
    </div>
  );
}
