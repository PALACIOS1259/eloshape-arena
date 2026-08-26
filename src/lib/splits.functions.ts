import { createServerFn } from "@tanstack/react-start";

/** Public Semi-Split reads. No auth: these power shareable public pages. */
export const listSplits = createServerFn({ method: "GET" }).handler(async () => {
  const { loadSplits } = await import("./splits.server");
  return loadSplits();
});

export const getSplitDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const { loadSplitDetail } = await import("./splits.server");
    return loadSplitDetail(data.slug);
  });

export const getTournamentBracket = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const { loadTournamentBracket } = await import("./splits.server");
    return loadTournamentBracket(data.slug);
  });
