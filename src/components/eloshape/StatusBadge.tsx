import { cn } from "@/lib/utils";
import { TOURNAMENT_STATUS_LABEL } from "@/lib/format";

const STATUS_CLASS: Record<string, string> = {
  registration_open: "border-success/40 bg-success/10 text-success",
  registration_closed: "border-warning/40 bg-warning/10 text-warning",
  live: "border-live/50 bg-live/15 text-live",
  completed: "border-border-strong bg-surface-raised text-muted-foreground",
  cancelled: "border-destructive/40 bg-destructive/10 text-destructive",
  draft: "border-border bg-muted text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-[0.14em]",
        STATUS_CLASS[status] ?? STATUS_CLASS["draft"],
        className,
      )}
    >
      {status === "live" ? (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-current" />
        </span>
      ) : null}
      {TOURNAMENT_STATUS_LABEL[status] ?? status}
    </span>
  );
}
