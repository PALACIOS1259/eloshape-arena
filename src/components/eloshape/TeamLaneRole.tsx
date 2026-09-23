import { Crosshair, Leaf, Shield, Sparkles, Swords } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type TeamLaneRole = "top" | "jungle" | "mid" | "bot" | "support";

type LaneMeta = {
  value: TeamLaneRole;
  label: string;
  short: string;
  description: string;
  icon: LucideIcon;
};

export const TEAM_LANES: LaneMeta[] = [
  {
    value: "top",
    label: "Top",
    short: "TOP",
    description: "Solo lane · frontline",
    icon: Swords,
  },
  {
    value: "jungle",
    label: "Jungle",
    short: "JGL",
    description: "Pathing · map control",
    icon: Leaf,
  },
  {
    value: "mid",
    label: "Mid",
    short: "MID",
    description: "Central pressure · carry",
    icon: Sparkles,
  },
  {
    value: "bot",
    label: "ADC",
    short: "ADC",
    description: "Ranged damage · marksman",
    icon: Crosshair,
  },
  {
    value: "support",
    label: "Support",
    short: "SUP",
    description: "Vision · protection · setup",
    icon: Shield,
  },
];

export function laneMeta(role: TeamLaneRole | null | undefined) {
  return TEAM_LANES.find((lane) => lane.value === role) ?? null;
}

export function laneLabel(role: TeamLaneRole | null | undefined) {
  return laneMeta(role)?.label ?? "Role unassigned";
}

export function TeamLaneBadge({
  role,
  className,
  compact = false,
}: {
  role: TeamLaneRole | null | undefined;
  className?: string;
  compact?: boolean;
}) {
  const meta = laneMeta(role);

  if (!meta) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border border-dashed border-border bg-background/20 px-2.5 py-1 text-[11px] font-bold text-muted-foreground",
          className,
        )}
      >
        Role open
      </span>
    );
  }

  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-black tracking-wide text-foreground shadow-sm",
        className,
      )}
      title={meta.description}
    >
      <Icon className="size-3.5 text-primary" />
      {compact ? meta.short : meta.label}
    </span>
  );
}

export function TeamLaneIcon({ role, className }: { role: TeamLaneRole; className?: string }) {
  const meta = laneMeta(role)!;
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-br from-primary/15 to-background/20 text-primary shadow-sm",
        className,
      )}
      title={`${meta.label} — ${meta.description}`}
    >
      <span className="absolute inset-x-1 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
      <Icon className="relative size-4.5" />
    </span>
  );
}
