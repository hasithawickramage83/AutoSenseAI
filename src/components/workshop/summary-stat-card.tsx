import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const accentMap = {
  blue: "from-[var(--workshop-primary)]/8 to-white border-[var(--workshop-primary)]/15 text-[var(--workshop-primary)]",
  orange: "from-orange-50 to-white border-orange-200 text-orange-600",
  green: "from-emerald-50 to-white border-emerald-200 text-emerald-600",
  slate: "from-slate-50 to-white border-slate-200 text-slate-600",
} as const;

export function SummaryStatCard({
  label,
  value,
  icon: Icon,
  accent = "blue",
  className,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  accent?: keyof typeof accentMap;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group rounded-xl border bg-gradient-to-br p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5",
        accentMap[accent],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wider opacity-80">{label}</div>
        {Icon && (
          <div className="rounded-lg bg-white/80 p-2 shadow-sm">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{value}</div>
    </div>
  );
}
