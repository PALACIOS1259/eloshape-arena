export type InfrastructureState = {
  discordOAuth: boolean | null;
  linkedSnapshot: "protected" | "unavailable";
  betaSnapshot: "protected" | "unavailable";
};

export async function readInfrastructureState(): Promise<InfrastructureState> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const defaults: InfrastructureState = {
    discordOAuth: null,
    linkedSnapshot: "unavailable",
    betaSnapshot: "unavailable",
  };
  if (!url || !key) return defaults;
  const results = await Promise.allSettled([
    fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(5000),
    }).then(async (response) => {
      if (!response.ok) throw new Error("unavailable");
      const data = await response.json();
      return typeof data?.external?.discord === "boolean"
        ? (data.external.discord as boolean)
        : null;
    }),
    ...["discord-linked-snapshot", "discord-beta-snapshot"].map((name) =>
      fetch(`${url}/functions/v1/${name}`, {
        signal: AbortSignal.timeout(5000),
        redirect: "error",
      }).then((response) =>
        response.status === 401 ? ("protected" as const) : ("unavailable" as const),
      ),
    ),
  ]);
  const [oauth, linked, beta] = results;
  return {
    discordOAuth: oauth?.status === "fulfilled" ? (oauth.value as boolean | null) : null,
    linkedSnapshot:
      linked?.status === "fulfilled"
        ? (linked.value as "protected" | "unavailable")
        : "unavailable",
    betaSnapshot:
      beta?.status === "fulfilled" ? (beta.value as "protected" | "unavailable") : "unavailable",
  };
}
