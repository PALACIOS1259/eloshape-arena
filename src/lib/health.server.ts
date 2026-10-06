// Public health check: performs only an anonymous read and exposes no user data.
export async function healthResponse(
  env: { SUPABASE_URL?: string; SUPABASE_PUBLISHABLE_KEY?: string } = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  let ok = false;
  try {
    if (env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY) {
      const result = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/rpc/get_beta_access`, {
        method: "POST",
        headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(5000),
        redirect: "error",
      });
      const data = result.ok ? await result.json() : null;
      ok = typeof data?.enabled === "boolean" && typeof data?.allowed === "boolean";
    }
  } catch {
    ok = false;
  }
  return Response.json(
    { ok },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
