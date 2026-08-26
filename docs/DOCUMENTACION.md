# EloShape — Documentación técnica y de producto

> Plataforma competitiva de League of Legends para jugadores amateur / elo bajo.
> Idea de marca: **“No necesitás ser Challenger para competir.”**

Última actualización: 25/08/2026

---

## 1. Resumen del producto

EloShape organiza torneos por división (Iron, Bronze, Silver, Gold) y otorga
**puntos EloShape** únicamente por resultados de torneos propios. Los jugadores
suben en rankings por ciudad, provincia, país y región (LAS como región inicial).

Reglas competitivas del modelo:

1. El **rank de Solo Queue de Riot** define únicamente **para qué división es
   elegible** el jugador. No genera puntos.
2. Los **puntos EloShape** vienen solo de rendimiento en torneos EloShape.
   No existe un MMR/ELO alternativo calculado desde partidas normales de Riot.
3. Existen vistas de ranking **mensual** y **de temporada**, con filtros
   geográficos.
4. La **elegibilidad anti-smurf** se modela con estados manuales:
   `eligible`, `pending_review`, `rejected`, `suspended`.

### Sistema de puntos (configurable en `point_rules`)

| Regla | Puntos |
| --- | --- |
| Participación | +5 |
| Victoria de partida | +10 |
| Cuartos de final | +15 |
| Semifinal | +25 |
| Subcampeón | +40 |
| Campeón | +70 |

Cambiar valores = editar filas de `point_rules`; no hay números hardcodeados en la UI.

---

## 2. Stack técnico

- **Framework**: TanStack Start v1 (React 19, SSR) con Vite 7.
- **Routing**: TanStack Router, file-based en `src/routes/`.
- **Datos cliente**: TanStack Query (`src/lib/queries.ts`).
- **Estilos**: Tailwind CSS v4 vía `src/styles.css` (tokens semánticos OKLCH).
- **UI**: shadcn/ui + componentes propios en `src/components/eloshape/`.
- **Backend**: Lovable Cloud (Postgres + Auth + RLS + storage).
- **Lógica servidor**: `createServerFn` de `@tanstack/react-start`.

### Convención de archivos servidor/cliente

| Patrón | Rol |
| --- | --- |
| `*.functions.ts` | Wrappers RPC delgados (`createServerFn`), importables desde componentes |
| `*.server.ts` | Lógica privilegiada, solo servidor, nunca importada desde el cliente |
| `queries.ts` | `queryOptions` de TanStack Query para lecturas públicas |

---

## 3. Diseño / sistema visual

Definido en `src/styles.css` con tokens semánticos (nunca colores hardcodeados
en componentes):

- Fondos: casi negro / carbón.
- Metálico gris-plata para bordes y superficies.
- Acentos: naranja `#E07A2A` y dorado `#FFC140`.
- Texto primario blanco, secundario gris atenuado.
- Tipografía sans geométrica moderna estilo Inter.
- Utilidades propias: `bg-hero`, `bg-tech-grid`, `eyebrow`.

Referencia estética: FACEIT / Toornament. Sin mascotas gamer ni neón excesivo;
tarjetas limpias, buena jerarquía y densidad de datos competitiva.

Logo: `src/components/brand/EloShapeLogo.tsx` — emblema SVG geométrico
verticalmente simétrico (plata a la izquierda, naranja/dorado a la derecha).

---

## 4. Modelo de datos

Migraciones en `supabase/migrations/`. Tablas del esquema `public`:

| Tabla | Propósito |
| --- | --- |
| `regions` | Jerarquía Región → País → Provincia → Ciudad (LAS, Argentina, Santa Fe, Rosario…) |
| `divisions` | Iron / Bronze / Silver / Gold (código, nombre, acento visual) |
| `seasons` | Temporadas competitivas |
| `point_rules` | Configuración de puntos por evento |
| `profiles` | Perfil del jugador: handle, display name, avatar, bio, puntos temporada/mes, W/L, torneos jugados, movimiento de ranking, riot_id / riot_tier / riot_rank, elegibilidad, completitud, geografía (city/province/country/region) |
| `user_roles` | Roles separados del perfil: `admin`, `moderator`, `player` |
| `riot_accounts` | Cuenta Riot vinculada: game name, tag line, PUUID (privado), tier/rank, wins/losses, verificación, último sync |
| `teams` / `team_members` | Equipos y roster con roles (capitán, titular, suplente) |
| `tournaments` | Torneos: slug, nombre, división, región, modo, estado, fechas, cupos, `checkin_required`, `required_roster_size`, `min_account_level`, `required_platform`, hitos (`entries_locked_at`, `bracket_generated_at`, `finalized_at`) |
| `tournament_entries` | Inscripciones: estado (registrado / check-in / descalificado), seed, placement, `roster_locked_at`, puntos otorgados |
| `tournament_roster_members` | **Snapshot inmutable** del roster al cerrar inscripciones (jugador, rol, Riot ID, tier, nivel de cuenta) |
| `matches` / `match_players` | Bracket con coordenadas base cero `(round_index, bracket_slot)`, byes, resultados y estadísticas por jugador |
| `competitive_splits` | Semi-Splits: ventana, estado, `playoff_size`, `qualification_slots_per_qualifier` |
| `split_qualifications` | Clasificados por qualifier: posición, seed de playoffs, reemplazos |
| `ranking_points` / `team_ranking_points` | Ledger inmutable de puntos (jugador / equipo) con regla, torneo y `event_key` idempotente |
| `competition_audit_log` | Auditoría de toda operación de staff (locks, brackets, resultados, cierres) |
| `achievements` | Logros del jugador |
| `reports` | Reportes de usuarios |
| `eligibility_reviews` | Revisión manual anti-smurf con estados y notas del staff |

Datos demo sembrados: 24 jugadores (Argentina, Uruguay, Chile), 4 equipos,
6 torneos en distintos estados, historial completo del “Rosario Silver
Invitational”, ledger de puntos, logros y cola de moderación activa.

### Integridad competitiva (endurecimiento)

1. **El check-in define quién juega**: `lock_tournament_entries` solo procesa
   entries `checked_in` (o `registered` si `checkin_required = false`); el resto
   queda fuera del bracket y del scoring.
2. **Elegibilidad de roster completo**: cada jugador activo debe tener perfil,
   cuenta Riot vinculada y verificada, nivel ≥ `min_account_level` (30 por
   defecto), plataforma correcta, división compatible y no estar suspendido.
   Los rechazos se devuelven con motivos legibles.
3. **Snapshot inmutable**: al bloquear inscripciones se congela el roster en
   `tournament_roster_members` (triggers impiden UPDATE/DELETE). Scoring y
   elegibilidad posteriores **nunca** leen `team_members`.
4. **Playoffs atómicos**: `private.generate_split_playoffs` crea torneo,
   entries, snapshots y bracket en una sola transacción, exige el campo
   configurado (`playoff_size`, normalmente 16) y requiere motivo registrado
   para sembrar un campo corto. Es idempotente (`already_generated`).
5. **Concurrencia**: `pg_advisory_xact_lock` protege la asignación de cupos y la
   generación de playoffs; los cupos se cuentan **por qualifier**, así que
   re-ejecutar el cierre nunca reparte slots extra.
6. **Resultados de un solo disparo**: `report_match_result` bloquea la fila y
   rechaza un segundo reporte (`match_not_reportable`); el ganador avanza a
   `(round_index + 1, floor(bracket_slot / 2))`.
7. **Cierre idempotente**: `finalize_tournament` devuelve `already_finalized` y
   no duplica ledger (claves `event_key`).

### Tests de integración

`supabase/tests/competition_engine.test.sql` corre el ciclo completo
(inscripción → check-in → bracket → resultados → cierre → clasificación →
playoffs) verificando gating de check-in, inmutabilidad del snapshot,
concurrencia de resultados, byes, idempotencia y exactitud de puntos
(campeón 95, subcampeón 45). Todo se limpia al final; se ejecuta con permisos
de servicio contra la base del proyecto.

---

## 5. Modelo de seguridad

### Principios

- **Todas** las tablas públicas tienen RLS habilitado + `GRANT` explícito.
- Lecturas públicas (`anon`): torneos, rankings, perfiles, equipos, divisiones,
  regiones, matches, logros.
- Lecturas restringidas a staff: `reports`, `eligibility_reviews`, `user_roles`.
- `riot_accounts`: cada usuario ve **solo su fila** y **nunca el PUUID**.

### Roles

Los roles viven en `user_roles`, **jamás** en `profiles` (evita escalada de
privilegios). Las verificaciones usan helpers `security definer` en un esquema
**`private`** no expuesto por la API:

- `private.has_role(role)`
- `private.is_staff()`

Ambos resuelven siempre contra `auth.uid()`; no aceptan un user id del cliente.

### Escrituras

Un jugador autenticado solo puede actualizar por RLS: `handle`,
`display_name`, `avatar_url`, `bio`. Campos competitivos —puntos, W/L,
división, elegibilidad, `riot_*`, `profile_completion`— **no son editables
desde el cliente** y se escriben solo desde funciones de servidor con rol
privilegiado.

Igual criterio para `tournament_entries`, `matches`, `match_players` y
`ranking_points`: escritura exclusiva vía funciones de servidor validadas.

### Provisión automática de perfil

Un trigger sobre `auth.users` (`private.handle_new_auth_user`) crea el perfil y
el rol `player` al registrarse. `ensureProfile()` en
`src/lib/profile.server.ts` es idempotente y actúa como red de seguridad, así
que ningún usuario puede quedar sin perfil.

> Nota sobre el escáner: la ausencia de políticas INSERT/DELETE en `profiles` y
> de políticas de escritura en `riot_accounts` es **intencional** (fail-closed).
> Esos caminos existen solo del lado servidor.

---

## 6. Integración con Riot

Archivos: `src/lib/riot.server.ts` (cliente HTTP) y
`src/lib/riot-account.server.ts` (lógica de vinculación).

- La clave se lee **solo en servidor**, dentro del handler:
  `process.env["RIOT_API_KEY"]`. **Nunca** se hardcodea ni se expone al cliente.
- APIs usadas: **Account-v1** (resolver Riot ID → PUUID) y **League-v4**
  (entradas de liga / tier de Solo Queue).
- Manejo de errores: 404 (Riot ID inexistente), 429 (rate limit), 5xx
  (indisponible), con mensajes seguros para el usuario.
- **Modo mock determinístico** cuando no hay clave configurada, para desarrollo.
- Reglas de vinculación: PUUID único por plataforma, cooldown de **10 minutos**
  entre refrescos, mapeo automático de tier → división elegible.
- El PUUID nunca sale en payloads hacia el cliente (dashboard ni consola staff).

Funciones expuestas (`src/lib/riot.functions.ts`): `getRiotStatus`,
`getMyRiotAccount`, `connectRiotAccount`, `refreshRiotAccount`.

EloShape no está endorsado por Riot Games; el aviso está en `/terms` y `/privacy`.

---

## 7. Rutas de la aplicación

### Públicas

| Ruta | Contenido |
| --- | --- |
| `/` | Hero, tagline, CTA “Compete Now”, próximo torneo, preview de leaderboard, divisiones, cómo funciona |
| `/tournaments` | Listado con filtros de división / región / estado / modo, cupos y estado de inscripción |
| `/tournaments/$slug` | Overview, reglas, participantes, bracket, calendario de matches, resultados, CTA de registro/check-in |
| `/rankings` | Leaderboard con filtros mes/temporada, división y geografía (ciudad/provincia/país) |
| `/players/$handle` | Riot ID, rank actual, puntos, rankings geográficos, stats, historial, logros, ledger |
| `/teams` | Directorio de equipos |
| `/teams/$slug` | Roster, división, ranking regional, W/L, historial, campeonatos |
| `/divisions` | Explicación de divisiones y elegibilidad |
| `/rules` | Reglamento competitivo y sistema de puntos |
| `/auth` | Registro / inicio de sesión |
| `/privacy`, `/terms` | Legales + aviso de no endorsement de Riot |

### Autenticadas (`src/routes/_authenticated/`)

| Ruta | Contenido |
| --- | --- |
| `/dashboard` | Checklist de onboarding, tarjeta de cuenta Riot, ajustes de perfil y ubicación, torneos inscriptos, próximos matches, puntos y movimiento |
| `/admin` | Consola de staff: torneos, usuarios, reportes y cola de revisión de elegibilidad con acciones manuales |

El gate `_authenticated/route.tsx` redirige a `/auth` antes de que corran los
loaders, por lo que ninguna función protegida se ejecuta sin sesión.

---

## 8. Componentes reutilizables

`src/components/eloshape/`: `DivisionBadge`, `StatusBadge`, `StatTile`,
`SectionHeader`, `TournamentCard`, `PlayerRow` (con flechas de movimiento),
`TeamCard`, `EmptyState`, `OnboardingChecklist`, `RiotAccountCard`,
`ProfileSettingsCard`, `TournamentRegisterButton`.

`src/components/layout/`: `SiteHeader` (nav + drawer mobile + estado de sesión),
`SiteFooter`, `PageShell` / `PageHeading`.

`src/lib/format.ts`: helpers de fechas, puntos, winrate y etiquetas de rank.

---

## 9. Flujos clave

### Registro de jugador
1. Sign up en `/auth` → trigger crea perfil + rol `player`.
2. `/dashboard` muestra checklist: handle, ubicación, cuenta Riot, rank
   detectado, elegibilidad.
3. Al vincular Riot, se detecta tier → se asigna división elegible.
4. Elegibilidad arranca en `pending_review`; el staff confirma en `/admin`.

### Inscripción a torneo
1. `TournamentRegisterButton` llama a `registerForTournament`.
2. `src/lib/tournament-entry.server.ts` valida en servidor: elegibilidad,
   división correcta, geografía, cupo y estado del torneo.
3. Check-in es una segunda función con su propia ventana de validación.

### Otorgamiento de puntos
Solo desde servidor: se inserta en `ranking_points` con `rule_code` de
`point_rules` y referencia al torneo; los agregados del perfil se recalculan.

---

## 10. Qué está mockeado / pendiente

- **Riot API** funciona real si hay `RIOT_API_KEY`; sin clave usa mock
  determinístico. No hay OAuth RSO (login con Riot) todavía.
- **Bracket**: se renderiza desde `matches`, pero no hay generador automático de
  bracket ni avance automático de ganadores.
- **Puntuación automática**: la asignación tras un torneo es manual/servidor,
  sin job de cierre de torneo.
- **Equipos**: alta y gestión de roster desde la UI aún no está expuesta.
- **Datos demo** conviven con datos reales (flag `is_demo` en `profiles`).

---

## 11. Próximos 5 pasos recomendados

1. **Motor de brackets**: generación de single elimination, seeding por puntos y
   avance automático al reportar resultado.
2. **Cierre de torneo automatizado**: función de servidor que calcula placements
   y escribe el ledger de `ranking_points` según `point_rules`.
3. **Gestión de equipos en UI**: crear equipo, invitar/aceptar miembros, roles.
4. **Reporte de resultados con evidencia**: subida de screenshot a storage +
   flujo de disputa hacia `reports`.
5. **Login con Riot (RSO)** y verificación automática anti-smurf usando historial
   de rank, reduciendo la revisión manual.

---

## 12. Operación

- Secretos: se administran desde el backend de Lovable Cloud
  (`RIOT_API_KEY`). Nunca en el repo ni en variables `VITE_*`.
- Variables `VITE_*` son públicas por definición: solo URL y clave publicable.
- Migraciones: siempre `CREATE TABLE` → `GRANT` → `ENABLE RLS` → `CREATE POLICY`.
- Endpoints externos (webhooks/cron) van bajo `src/routes/api/public/*` con
  verificación de firma en el handler.
