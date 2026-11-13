import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

const TONES = {
  neutral: "bg-ink-100 text-ink-600",
  brand: "bg-brand-50 text-brand-600",
  success: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: IconName;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className="rounded-xl2 border border-ink-200/80 bg-white px-4 py-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-ink-400">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink-900">{value}</p>
          {hint ? <p className="mt-0.5 text-xs text-ink-500">{hint}</p> : null}
        </div>
        {icon ? (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>
            <Icon name={icon} size={18} />
          </span>
        ) : null}
      </div>
    </div>
  );
}
