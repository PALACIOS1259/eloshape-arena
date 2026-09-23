import { Link } from "@tanstack/react-router";
import { Compass, Search, Settings, ShieldCheck, Users } from "lucide-react";

import { cn } from "@/lib/utils";

type TeamWorkspaceTab = "overview" | "players" | "settings";

const tabs = [
  {
    key: "overview" as const,
    label: "Team HQ",
    description: "Roster & readiness",
    to: "/team" as const,
    icon: ShieldCheck,
  },
  {
    key: "players" as const,
    label: "Recruit",
    description: "Find free agents",
    to: "/team/players" as const,
    icon: Search,
  },
  {
    key: "settings" as const,
    label: "Settings",
    description: "Identity & controls",
    to: "/team/settings" as const,
    icon: Settings,
  },
];

export function TeamWorkspaceNav({
  active,
  hasTeam = true,
  isCaptain = false,
}: {
  active: TeamWorkspaceTab;
  hasTeam?: boolean;
  isCaptain?: boolean;
}) {
  return (
    <nav
      aria-label="Team workspace"
      className="border-b border-border/60 pb-3"
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
        <div className="grid flex-1 gap-2 sm:grid-cols-3">
          {tabs.map((tab) => {
            const disabled = !hasTeam && tab.key !== "overview";
            const captainOnly = tab.key === "players" || tab.key === "settings";
            const unavailable = disabled || (captainOnly && hasTeam && !isCaptain);
            const Icon = tab.icon;

            const content = (
              <>
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-xl border",
                    active === tab.key && !unavailable
                      ? "border-primary/30 bg-primary/15 text-primary"
                      : "border-border/70 bg-background/30 text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block truncate text-sm font-black">{tab.label}</span>
                  <span className="mt-0.5 block truncate text-[11px] font-medium text-muted-foreground">
                    {unavailable
                      ? disabled
                        ? "Create a team first"
                        : "Captain only"
                      : tab.description}
                  </span>
                </span>
              </>
            );

            if (unavailable) {
              return (
                <span
                  key={tab.key}
                  aria-disabled="true"
                  className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-muted-foreground/50"
                >
                  {content}
                </span>
              );
            }

            return (
              <Link
                key={tab.key}
                to={tab.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all",
                  active === tab.key
                    ? "border-primary/25 bg-primary/10 text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-background/30 hover:text-foreground",
                )}
              >
                {content}
              </Link>
            );
          })}
        </div>

        <div className="hidden w-px bg-border lg:block" />

        <Link
          to="/teams"
          className="flex shrink-0 items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-muted-foreground transition-all hover:border-border/70 hover:bg-background/30 hover:text-foreground lg:min-w-44"
        >
          <span className="grid size-9 place-items-center rounded-xl border border-border bg-background/45">
            <Compass className="size-4" />
          </span>
          <span className="text-left">
            <span className="block text-sm font-black">Team directory</span>
            <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">
              Browse the circuit
            </span>
          </span>
        </Link>
      </div>
      <div className="mt-2 flex items-center gap-2 px-1 text-[11px] font-medium text-muted-foreground">
        <Users className="size-3.5" />
        {hasTeam
          ? isCaptain
            ? "Captain workspace · roster changes are server validated"
            : "Member workspace · captain-only controls are locked"
          : "Start by creating or joining a team"}
      </div>
    </nav>
  );
}
