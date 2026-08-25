import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  hint,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-surface-gradient shadow-card rounded-lg border border-border p-4",
        className,
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{label}</p>
          <p className="tabular mt-2 truncate text-2xl font-black text-foreground">{value}</p>
        </div>
        {icon ? <span className="shrink-0 text-brand">{icon}</span> : null}
      </div>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
