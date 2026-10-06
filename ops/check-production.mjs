// No login, API secret or player data is needed for availability monitoring.
const origin = "https://eloshape.com.ar";
let failed = false;
for (const pathname of ["/api/health", "/maintenance"]) {
  try {
    const response = await fetch(`${origin}${pathname}`, {
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
      headers: { "User-Agent": "EloShape-Availability-Check" },
    });
    const valid =
      response.ok &&
      (pathname === "/api/health"
        ? (await response.json()).ok === true
        : (await response.text()).includes("EloShape"));
    console.log(`${valid ? "OK" : "FAIL"} ${pathname}: HTTP ${response.status}`);
    if (!valid) failed = true;
  } catch {
    console.error(`FAIL ${pathname}: servicio no disponible o respuesta inválida`);
    failed = true;
  }
}
if (failed) process.exitCode = 1;
