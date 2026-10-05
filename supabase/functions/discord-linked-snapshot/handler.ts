type Dependencies = { token: string | undefined; readSnapshot: () => Promise<unknown> };
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

async function sameToken(left: string, right: string) {
  const digest = async (value: string) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i]! ^ b[i]!;
  return difference === 0;
}

export function createLinkedSnapshotHandler({ token, readSnapshot }: Dependencies) {
  return async (request: Request) => {
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
    if (!token || token.length < 32) return json({ error: "sync_not_configured" }, 503);
    const provided = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
    if (!provided || provided.length > 512 || !(await sameToken(provided, token)))
      return json({ error: "unauthorized" }, 401);
    try {
      const data = (await readSnapshot()) as {
        version?: number;
        linked_member_ids?: unknown[];
      } | null;
      if (
        !data ||
        data.version !== 1 ||
        !Array.isArray(data.linked_member_ids) ||
        data.linked_member_ids.some((id) => typeof id !== "string" || !/^\d{17,20}$/.test(id))
      )
        return json({ error: "invalid_snapshot" }, 502);
      return json({ version: 1, linked_member_ids: [...new Set(data.linked_member_ids)] });
    } catch {
      return json({ error: "snapshot_unavailable" }, 503);
    }
  };
}
