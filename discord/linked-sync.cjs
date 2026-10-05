// Solo identidades OAuth verificadas por el backend; nunca nombres ni IDs escritos por jugadores.
async function fetchLinkedSnapshot({ env = process.env, fetchImpl = fetch } = {}) {
  const endpoint = env.DISCORD_LINKED_SNAPSHOT_URL;
  const token = env.DISCORD_BETA_SYNC_TOKEN;
  if (!endpoint || !token || token.length < 32)
    throw new Error("Falta configurar DISCORD_LINKED_SNAPSHOT_URL y DISCORD_BETA_SYNC_TOKEN");
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("El endpoint debe usar HTTPS sin credenciales en la URL");
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("No se pudo consultar la vinculación; no se cambian roles");
  }
  if (!response.ok) throw new Error(`Endpoint respondió ${response.status}; no se cambian roles`);
  const snapshot = await response.json();
  if (
    !snapshot ||
    snapshot.version !== 1 ||
    !Array.isArray(snapshot.linked_member_ids) ||
    snapshot.linked_member_ids.some((id) => typeof id !== "string" || !/^\d{17,20}$/.test(id))
  )
    throw new Error("Snapshot de vinculación inválido; no se cambian roles");
  return [...new Set(snapshot.linked_member_ids)];
}

async function syncLinkedMembers({ guild, ids, linkedDiscordIds }) {
  if (
    !Array.isArray(linkedDiscordIds) ||
    linkedDiscordIds.some((id) => typeof id !== "string" || !/^\d{17,20}$/.test(id))
  )
    throw new Error("IDs de vinculación inválidos");
  // IDs exportados por !adaptar/!ids, sin copiar roles a mano ni resolver por nombres.
  const roleId = ids.roles?.cuentaVinculada?.id;
  if (!roleId) throw new Error("Falta Cuenta vinculada en ids.json; ejecutá !ids");
  const role = await guild.roles.fetch(roleId);
  if (!role || role.managed || !role.editable)
    throw new Error("El bot debe poder gestionar Cuenta vinculada y estar por encima de ese rol");
  const members = await guild.members.fetch();
  const linked = new Set(linkedDiscordIds);
  let added = 0,
    removed = 0;
  for (const member of members.values()) {
    if (member.user.bot) continue;
    const hasRole = member.roles.cache.has(role.id);
    if (linked.has(member.id) && !hasRole) {
      await member.roles.add(role);
      added++;
    }
    if (!linked.has(member.id) && hasRole) {
      await member.roles.remove(role);
      removed++;
    }
  }
  return { linked: linked.size, added, removed };
}

module.exports = { fetchLinkedSnapshot, syncLinkedMembers };
