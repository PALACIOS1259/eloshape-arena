import { cn } from "@/lib/utils";

export type DivisionLike = {
  code?: string | null;
  name?: string | null;
  accent?: string | null;
} | null;

const ACCENT_CLASS: Record<string, string> = {
  iron: "border-iron/40 text-iron bg-iron/10",
  bronze: "border-bronze/40 text-bronze bg-bronze/10",
  silver: "border-silver/40 text-silver bg-silver/10",
  gold: "border-gold-div/40 text-gold-div bg-gold-div/10",
};

export function DivisionBadge({
  division,
  className,
  size = "sm",
}: {
  division: DivisionLike;
  className?: string;
  size?: "sm" | "md";
}) {
  if (!division) return null;
  const accent = division.accent ?? division.code ?? "iron";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-[0.12em]",
        size === "sm" ? "px-2.5 py-0.5 text-[0.625rem]" : "px-3 py-1 text-xs",
        ACCENT_CLASS[accent] ?? ACCENT_CLASS["iron"],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {division.name ?? division.code}
    </span>
  );
}
