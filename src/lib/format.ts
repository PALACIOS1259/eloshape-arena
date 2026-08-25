export const TOURNAMENT_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  registration_open: "Registration open",
  registration_closed: "Registration closed",
  live: "Live",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function formatDate(value: string | null | undefined) {
  if (!value) return "TBD";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "TBD";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPoints(value: number | null | undefined) {
  return (value ?? 0).toLocaleString("en-US");
}

export function winRate(wins: number, losses: number) {
  const total = wins + losses;
  if (!total) return "—";
  return `${Math.round((wins / total) * 100)}%`;
}

export function riotRankLabel(tier: string | null, rank: string | null) {
  if (!tier) return "Unranked";
  const pretty = tier.charAt(0) + tier.slice(1).toLowerCase();
  return rank ? `${pretty} ${rank}` : pretty;
}

export function placementLabel(placement: number | null | undefined) {
  if (!placement) return "—";
  if (placement === 1) return "1st";
  if (placement === 2) return "2nd";
  if (placement === 3) return "3rd";
  return `${placement}th`;
}

export function initials(name: string) {
  return name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
