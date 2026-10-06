// La consulta masiva del gateway (opcode 8) tiene un límite propio. Usar REST
// paginado permite que discord.js respete las esperas de la API automáticamente.
// No devolver una lista parcial si una página falla: los roles se conservan.
async function listGuildMembers(guild) {
  const members = new Map();
  let after;
  while (true) {
    const page = await guild.members.list({ limit: 1000, ...(after ? { after } : {}) });
    for (const [id, member] of page) members.set(id, member);
    if (page.size < 1000) return members;

    let highest = after || "0";
    for (const id of page.keys()) {
      if (BigInt(id) > BigInt(highest)) highest = id;
    }
    if (highest === (after || "0"))
      throw new Error("No se pudo completar la lista de miembros; no se cambian roles");
    after = highest;
  }
}

module.exports = { listGuildMembers };
