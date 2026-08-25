import { queryOptions } from "@tanstack/react-query";

import {
  getDirectory,
  getHomeSnapshot,
  getPlayer,
  getRankings,
  getTeam,
  getTeams,
  getTournamentDetail,
  getTournaments,
} from "./eloshape.functions";

export const directoryQuery = () =>
  queryOptions({
    queryKey: ["directory"],
    queryFn: () => getDirectory(),
    staleTime: 5 * 60 * 1000,
  });

export const homeSnapshotQuery = () =>
  queryOptions({ queryKey: ["home-snapshot"], queryFn: () => getHomeSnapshot() });

export const tournamentsQuery = (filters: {
  status?: string;
  divisionCode?: string;
  mode?: string;
}) =>
  queryOptions({
    queryKey: ["tournaments", filters],
    queryFn: () => getTournaments({ data: filters }),
  });

export const tournamentDetailQuery = (slug: string) =>
  queryOptions({
    queryKey: ["tournament", slug],
    queryFn: () => getTournamentDetail({ data: { slug } }),
  });

export const rankingsQuery = (filters: {
  period: "season" | "month";
  divisionCode?: string;
  regionSlug?: string;
}) =>
  queryOptions({
    queryKey: ["rankings", filters],
    queryFn: () => getRankings({ data: filters }),
  });

export const playerQuery = (handle: string) =>
  queryOptions({ queryKey: ["player", handle], queryFn: () => getPlayer({ data: { handle } }) });

export const teamQuery = (slug: string) =>
  queryOptions({ queryKey: ["team", slug], queryFn: () => getTeam({ data: { slug } }) });

export const teamsQuery = () => queryOptions({ queryKey: ["teams"], queryFn: () => getTeams() });
