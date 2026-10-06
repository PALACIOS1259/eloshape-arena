const RIOT_ERRORS: Record<string, string> = {
  invalid_riot_id: "Revisá tu nombre de Riot y la etiqueta después de #.",
  not_found: "No se encontró esa cuenta de Riot.",
  not_configured: "La integración de Riot todavía no está configurada.",
  rate_limited: "Riot está limitando las consultas. Volvé a intentar en unos minutos.",
  riot_unauthorized: "La integración de Riot no está disponible temporalmente.",
  riot_unavailable:
    "El servicio de Riot no está disponible temporalmente. Volvé a intentar en unos minutos.",
  riot_timeout: "Riot no respondió a tiempo. Volvé a intentar.",
  unauthorized: "Iniciá sesión para continuar.",
  backend_not_configured: "La vinculación segura de Riot no está disponible temporalmente.",
  beta_check_unavailable: "No se pudo verificar el acceso a la beta.",
  beta_access_required: "Necesitás una invitación para acceder a la beta.",
  profile_error: "No se pudo actualizar tu perfil de EloShape. Volvé a intentar.",
  not_linked: "Todavía no hay una cuenta de Riot vinculada.",
  already_linked: "Esa cuenta de Riot ya está vinculada a otro jugador de EloShape.",
};

export function riotErrorMessage(code?: string) {
  return RIOT_ERRORS[code ?? ""] ?? "La sincronización de Riot no está disponible temporalmente.";
}

export function riotNotice(message: string | null) {
  if (!message) return null;
  const cooldown = message.match(/^Riot data was just synced\. Try again in (\d+) min\.$/);
  if (cooldown)
    return `Los datos de Riot se sincronizaron recién. Volvé a intentar en ${cooldown[1]} min.`;
  const level = message.match(
    /^Riot account level (\d+) is required to compete\. Your current level is (\d+)\.$/,
  );
  if (level)
    return `Se requiere nivel de cuenta de Riot ${level[1]} para competir. Tu nivel actual es ${level[2]}.`;
  if (message.startsWith("Riot reports no Solo Queue rank")) {
    return "Riot todavía no informa un rango en la cola clasificatoria individual. Jugá tus partidas de posicionamiento para habilitar una división.";
  }
  if (message.startsWith("Your Riot rank is currently outside")) {
    return "Tu rango de Riot está fuera de las divisiones competitivas disponibles en EloShape.";
  }
  return /[áéíóúñ¿]/i.test(message)
    ? message
    : "Revisá los requisitos de elegibilidad de tu cuenta de Riot.";
}
