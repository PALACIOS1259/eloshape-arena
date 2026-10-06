export const TOURNAMENT_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  registration_open: "Inscripción abierta",
  registration_closed: "Inscripción cerrada",
  live: "En vivo",
  completed: "Completado",
  cancelled: "Cancelado",
};

const STATUS_LABEL: Record<string, string> = {
  ...TOURNAMENT_STATUS_LABEL,
  upcoming: "Próximamente",
  qualifiers: "Clasificatorios",
  seeding: "Ordenamiento",
  playoffs: "Eliminatorias",
  semifinals: "Semifinales",
  final: "Final",
  scheduled: "Programado",
  registered: "Inscrito",
  checked_in: "Asistencia confirmada",
  withdrawn: "Retirado",
  disqualified: "Descalificado",
  eligible: "Habilitado",
  pending_review: "En revisión",
  rejected: "Rechazado",
  suspended: "Suspendido",
  pending: "Pendiente",
  pending_confirmation: "Pendiente de confirmación",
  confirmed: "Confirmado",
  disputed: "En disputa",
  resolved: "Resuelto",
  open: "Abierto",
  closed: "Cerrado",
  in_progress: "En curso",
  reviewing: "En revisión",
  in_review: "En revisión",
  dismissed: "Descartado",
  matched: "Emparejado",
  qualified: "Clasificado",
  replaced: "Reemplazado",
  player: "Titular",
  substitute: "Suplente",
  captain: "Capitán",
  admin: "Administrador",
  moderator: "Moderador",
  accepted: "Aceptado",
  declined: "Rechazado",
  expired: "Vencido",
  revoked: "Revocado",
  match_result_reported: "Resultado informado",
  match_result_confirmed: "Resultado confirmado",
  match_result_resolved: "Resultado resuelto",
  match_result_dispute: "Disputa de resultado",
  match_walkover_recorded: "Victoria administrativa registrada",
  match_result_corrected: "Resultado corregido",
  bracket_generated: "Cuadro generado",
  entries_locked: "Inscripciones bloqueadas",
  tournament_finalized: "Torneo finalizado",
  split_status_changed: "Fase del split actualizada",
  playoffs_generated: "Eliminatorias generadas",
  qualification_assigned: "Clasificación asignada",
  qualification_replaced: "Equipo clasificado reemplazado",
  entry_rejected: "Inscripción rechazada",
  playoff_field_override: "Cupo de eliminatorias ajustado",
  match_result_claim_submitted: "Informe de resultado enviado",
  match_result_claim_confirmed: "Informe de resultado confirmado",
  match_result_claim_disputed: "Informe de resultado disputado",
  match_result_staff_resolved: "Resultado resuelto por la organización",
  match_result_claim_staff_resolved: "Disputa resuelta por la organización",
  match_result_claim_staff_dismissed: "Informe descartado por la organización",
};

export function statusLabel(value: string) {
  return STATUS_LABEL[value] ?? "Sin especificar";
}

const RANK_LABEL: Record<string, string> = {
  IRON: "Hierro",
  BRONZE: "Bronce",
  SILVER: "Plata",
  GOLD: "Oro",
  PLATINUM: "Platino",
  EMERALD: "Esmeralda",
  DIAMOND: "Diamante",
  MASTER: "Maestro",
  GRANDMASTER: "Gran maestro",
  CHALLENGER: "Retador",
  UNRANKED: "Sin rango",
};

export function divisionLabel(
  division: { code?: string | null; name?: string | null } | null | undefined,
) {
  return (
    RANK_LABEL[(division?.code ?? division?.name ?? "").toUpperCase()] ??
    division?.name ??
    "Sin división"
  );
}

export function roundName(value: string) {
  const labels: Record<string, string> = {
    Quarterfinal: "Cuartos de final",
    Quarterfinals: "Cuartos de final",
    Semifinal: "Semifinales",
    Semifinals: "Semifinales",
    "Grand Final": "Gran final",
    "Round of 16": "Octavos de final",
    "Round of 8": "Cuartos de final",
  };
  return labels[value] ?? value.replace(/^Round of /, "Ronda de ").replace(/^Round /, "Ronda ");
}

export function seasonLabel(value: string | null | undefined) {
  return (
    value?.replace(/^Season\b/, "Temporada").replace(/^Preseason\b/, "Pretemporada") ?? "Temporada"
  );
}

export function pointRuleLabel(code: string | null | undefined, fallback?: string | null) {
  const labels: Record<string, string> = {
    participation: "Participación",
    match_win: "Victoria de partida",
    quarterfinal: "Llegar a cuartos de final",
    semifinal: "Llegar a semifinales",
    runner_up: "Subcampeón",
    champion: "Campeón",
  };
  return labels[code ?? ""] ?? fallback ?? "Puntos del circuito";
}

export function divisionDescription(code: string, fallback?: string | null) {
  const descriptions: Record<string, string> = {
    iron: "División de entrada para jugadores de Hierro. Aprendé organización, comunicación y las bases del juego competitivo.",
    bronze: "Para jugadores de Bronce listos para sus primeros cuadros organizados.",
    silver: "Una división muy disputada: la consistencia en los fundamentos decide los cuadros.",
    gold: "Jugadores de Oro que compiten por títulos regionales.",
  };
  return descriptions[code] ?? fallback;
}

export function supportCategoryLabel(value: string) {
  const labels: Record<string, string> = {
    support: "Soporte general",
    bug: "Error",
    privacy: "Privacidad",
    account_deletion: "Eliminación de cuenta",
  };
  return labels[value] ?? "Soporte";
}

export function tournamentFormat(value: string | null | undefined) {
  return (
    value
      ?.replace(/Team /gi, "Equipos · ")
      .replace(/Single[ -]elimination/gi, "Eliminación directa")
      .replace(/Double[ -]elimination/gi, "Doble eliminación")
      .replace(/Round robin/gi, "Todos contra todos")
      .replace(/Best of (\d+)|Bo(\d+)/gi, (_, bestOf, bo) => `al mejor de ${bestOf ?? bo}`)
      .replace(/finals/gi, "en finales") ?? "A confirmar"
  );
}

export function achievementLabel(code: string, fallback: string) {
  const labels: Record<string, string> = {
    city_champion: "Campeón local",
    first_blood_title: "Primer título",
    finalist: "Finalista",
    streak_5: "Cinco victorias seguidas",
    province_leader: "Líder provincial",
    first_tournament: "Primer torneo",
    quarterfinalist: "Cuartofinalista",
  };
  return labels[code] ?? fallback;
}

export function achievementDescription(code: string, fallback?: string | null) {
  const descriptions: Record<string, string> = {
    city_champion: "Ganó un campeonato de su ciudad.",
    first_blood_title: "Ganó su primer torneo de EloShape.",
    finalist: "Llegó a una final de EloShape.",
    streak_5: "Ganó cinco partidas consecutivas de torneo.",
    province_leader: "Lideró la clasificación provincial durante un mes.",
    first_tournament: "Completó su primer torneo de EloShape.",
    quarterfinalist: "Llegó a cuartos de final.",
  };
  return descriptions[code] ?? fallback;
}

const CIRCUIT_TIME_ZONE = "America/Argentina/Buenos_Aires";

export function formatDate(value: string | null | undefined) {
  if (!value) return "A confirmar";
  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: CIRCUIT_TIME_ZONE,
  });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "A confirmar";
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CIRCUIT_TIME_ZONE,
  });
}

export function formatPoints(value: number | null | undefined) {
  return (value ?? 0).toLocaleString("es-AR");
}

export function winRate(wins: number, losses: number) {
  const total = wins + losses;
  if (!total) return "—";
  return `${Math.round((wins / total) * 100)}%`;
}

export function riotRankLabel(tier: string | null, rank: string | null) {
  if (!tier) return "Sin rango";
  const pretty = RANK_LABEL[tier.toUpperCase()] ?? "Sin rango";
  return rank ? `${pretty} ${rank}` : pretty;
}

export function placementLabel(placement: number | null | undefined) {
  if (!placement) return "—";
  return `${placement}.º`;
}

export function initials(name: string) {
  return name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
