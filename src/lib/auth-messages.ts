const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: "El correo o la contraseña son incorrectos.",
  email_not_confirmed: "Confirmá tu correo electrónico antes de iniciar sesión.",
  user_already_exists: "Ya existe una cuenta con ese correo electrónico.",
  email_exists: "Ya existe una cuenta con ese correo electrónico.",
  signup_disabled: "El registro está cerrado por el momento.",
  over_email_send_rate_limit:
    "Se enviaron demasiados correos. Esperá unos minutos y volvé a intentar.",
  over_request_rate_limit: "Demasiados intentos. Esperá unos minutos y volvé a intentar.",
  weak_password: "La contraseña no cumple los requisitos de seguridad.",
  same_password: "Elegí una contraseña distinta de la actual.",
  otp_expired: "El enlace venció. Pedí uno nuevo para continuar.",
  session_not_found: "Tu sesión venció. Volvé a iniciar sesión.",
  user_banned: "Esta cuenta está suspendida. Contactá al soporte.",
};

export function authErrorMessage(
  error: unknown,
  fallback = "No se pudo completar la autenticación. Volvé a intentar.",
) {
  if (error && typeof error === "object" && "code" in error) {
    const label = AUTH_ERRORS[String(error.code)];
    if (label) return label;
  }
  // Local validation messages are already in Spanish; external errors use a translated fallback.
  return error instanceof Error && /[áéíóúñ¿]/i.test(error.message) ? error.message : fallback;
}
