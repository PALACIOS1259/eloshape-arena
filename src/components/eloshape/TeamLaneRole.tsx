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
          "inline-flex items-center rounded-md border border-dashed border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground",
          className,
        )}
      >
        Unassigned
      </span>
    );
  }

  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-foreground",
        className,
      )}
    >
      <Icon className="size-3.5 text-primary" />
      {compact ? meta.short : meta.label}
    </span>
  );
}

export function TeamLaneIcon({
  role,
  className,
}: {
  role: TeamLaneRole;
  className?: string;
}) {
  const meta = laneMeta(role)!;
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary",
        className,
      )}
      title={meta.label}
    >
      <Icon className="size-4" />
    </span>
  );
}
