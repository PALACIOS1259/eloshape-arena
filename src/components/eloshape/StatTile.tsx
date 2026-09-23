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
        "relative overflow-hidden rounded-xl border border-border/70 bg-gradient-to-br from-card/80 to-background/50 p-4",
        className,
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{label}</p>
          <p className="tabular mt-2 truncate text-2xl font-black text-foreground">{value}</p>
        </div>
        {icon ? (
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary">
            {icon}
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
