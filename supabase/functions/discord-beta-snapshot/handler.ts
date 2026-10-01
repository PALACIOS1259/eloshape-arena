type Snapshot = { enabled: boolean; member_ids: string[] };
type Dependencies = {
  token: string | undefined;
  readSnapshot: () => Promise<unknown>;
};

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function sameToken(a: string, b: string) {
  const digest = async (value: string) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  const [left, right] = await Promise.all([digest(a), digest(b)]);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i]! ^ right[i]!;
  return difference === 0;
}

export function createSnapshotHandler({ token, readSnapshot }: Dependencies) {
  return async (request: Request) => {
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
    if (!token || token.length < 32) return json({ error: "sync_not_configured" }, 503);
    const provided = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
    if (!provided || provided.length > 512 || !(await sameToken(provided, token))) {
      return json({ error: "unauthorized" }, 401);
    }
    try {
      const data = (await readSnapshot()) as Snapshot | null;
      if (
        !data ||
        typeof data.enabled !== "boolean" ||
        !Array.isArray(data.member_ids) ||
        data.member_ids.some((id) => typeof id !== "string" || !/^\d{17,20}$/.test(id))
      )
        return json({ error: "invalid_snapshot" }, 502);
      // Selección explícita: nunca transmitir correos ni registros de la whitelist.
      return json({ enabled: data.enabled, member_ids: [...new Set(data.member_ids)] });
    } catch {
      return json({ error: "snapshot_unavailable" }, 503);
    }
  };
}
