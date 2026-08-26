import { createServerFn } from "@tanstack/react-start";

/**
 * Public (unauthenticated) reads for EloShape. Thin wrappers only: every
 * runtime helper lives in `eloshape.server.ts`, loaded inside the handler.
 */

export const getDirectory = createServerFn({ method: "GET" }).handler(async () => {
  const { loadDirectory } = await import("./eloshape.server");
  return loadDirectory();
});

export const getHomeSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  const { loadHomeSnapshot } = await import("./eloshape.server");
  return loadHomeSnapshot();
});

export const getTournaments = createServerFn({ method: "GET" })
  .validator((input: { status?: string; divisionCode?: string; mode?: string }) => input)
  .handler(async ({ data }) => {
    const { loadTournaments } = await import("./eloshape.server");
    return loadTournaments(data ?? {});
  });

export const getTournamentDetail = createServerFn({ method: "GET" })
  .validator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const { loadTournamentDetail } = await import("./eloshape.server");
    return loadTournamentDetail(data.slug);
  });

export const getRankings = createServerFn({ method: "GET" })
  .validator(
    (input: {
      period: "season" | "month";
      divisionCode?: string;
      regionSlug?: string;
      limit?: number;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { loadRankings } = await import("./eloshape.server");
    return loadRankings(data);
  });

export const getPlayer = createServerFn({ method: "GET" })
  .validator((input: { handle: string }) => input)
  .handler(async ({ data }) => {
    const { loadPlayer } = await import("./eloshape.server");
    return loadPlayer(data.handle);
  });

export const getTeam = createServerFn({ method: "GET" })
  .validator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const { loadTeam } = await import("./eloshape.server");
    return loadTeam(data.slug);
  });

export const getTeams = createServerFn({ method: "GET" }).handler(async () => {
  const { loadTeams } = await import("./eloshape.server");
  return loadTeams();
});
