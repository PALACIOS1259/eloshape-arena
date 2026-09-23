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
        "relative min-w-0 border-l border-border/60 pl-4 first:border-l-0 first:pl-0",
        className,
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{label}</p>
          <p className="tabular mt-1.5 truncate text-xl font-black text-foreground">{value}</p>
        </div>
        {icon ? (
          <span className="grid size-7 shrink-0 place-items-center text-primary">
            {icon}
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
