import { queryOptions } from "@tanstack/react-query";

import { getSplitDetail, getTournamentBracket, listSplits } from "./splits.functions";

export const splitsQuery = () =>
  queryOptions({ queryKey: ["splits"], queryFn: () => listSplits() });

export const splitDetailQuery = (slug: string) =>
  queryOptions({ queryKey: ["split", slug], queryFn: () => getSplitDetail({ data: { slug } }) });

export const bracketQuery = (slug: string) =>
  queryOptions({
    queryKey: ["bracket", slug],
    queryFn: () => getTournamentBracket({ data: { slug } }),
  });
