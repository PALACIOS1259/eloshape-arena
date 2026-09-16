import { Link } from "@tanstack/react-router";
import { Search, Settings, ShieldCheck, Users } from "lucide-react";

import { cn } from "@/lib/utils";

type TeamWorkspaceTab = "overview" | "players" | "settings";

const tabs = [
  { key: "overview" as const, label: "Team HQ", to: "/team" as const, icon: ShieldCheck },
  { key: "players" as const, label: "Find players", to: "/team/players" as const, icon: Search },
  { key: "settings" as const, label: "Settings", to: "/team/settings" as const, icon: Settings },
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
      className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-background/35 p-1"
    >
      {tabs.map((tab) => {
        const disabled = !hasTeam && tab.key !== "overview";
        const captainOnly = tab.key === "players" || tab.key === "settings";
        const unavailable = disabled || (captainOnly && hasTeam && !isCaptain);
        const Icon = tab.icon;

        if (unavailable) {
          return (
            <span
              key={tab.key}
              className="inline-flex shrink-0 cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/45"
            >
              <Icon className="size-4" />
              {tab.label}
            </span>
          );
        }

        return (
          <Link
            key={tab.key}
            to={tab.to}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              active === tab.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {tab.label}
          </Link>
        );
      })}

      <Link
        to="/teams"
        className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
      >
        <Users className="size-4" />
        Browse teams
      </Link>
    </nav>
  );
}
