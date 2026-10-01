// El bot recibe solo IDs aprobados mediante un endpoint con credencial propia.
// Nunca necesita una clave service_role de Supabase.
async function fetchBetaSnapshot({ env = process.env, fetchImpl = fetch } = {}) {
  const endpoint = env.BETA_SNAPSHOT_URL;
  const token = env.DISCORD_BETA_SYNC_TOKEN;
  if (!endpoint || !token || token.length < 32) {
    throw new Error("Falta configurar BETA_SNAPSHOT_URL y DISCORD_BETA_SYNC_TOKEN");
  }
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("El endpoint de beta debe usar HTTPS sin credenciales en la URL");
  }
  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("No se pudo consultar la whitelist; no se cambian roles");
  }
  if (!response.ok)
    throw new Error(`Endpoint de beta respondió ${response.status}; no se cambian roles`);
  let snapshot;
  try {
    snapshot = await response.json();
  } catch {
    throw new Error("Respuesta de beta inválida; no se cambian roles");
  }
  if (
    !snapshot ||
    typeof snapshot.enabled !== "boolean" ||
    !Array.isArray(snapshot.member_ids) ||
    snapshot.member_ids.some((id) => typeof id !== "string" || !/^\d{17,20}$/.test(id))
  )
    throw new Error("Snapshot de beta inválido; no se cambian roles");
  return { enabled: snapshot.enabled, member_ids: [...new Set(snapshot.member_ids)] };
}

module.exports = { fetchBetaSnapshot };
