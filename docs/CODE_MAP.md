# EloShape code map

This file answers: "where does this behavior live?"

## Routes

| File | Responsibility |
| --- | --- |
| `src/routes/__root.tsx` | Root layout |
| `src/routes/index.tsx` | Landing |
| `src/routes/auth.tsx` | Auth |
| `src/routes/auth_.reset-password.tsx` | Password reset |
| `src/routes/tournaments.index.tsx` | Tournament directory |
| `src/routes/tournaments.$slug.tsx` | Tournament detail/participants/bracket |
| `src/routes/splits.index.tsx` | Semi-Split directory |
| `src/routes/splits.$slug.tsx` | Semi-Split detail |
| `src/routes/rankings.tsx` | Rankings |
| `src/routes/players.$handle.tsx` | Player profile |
| `src/routes/teams.index.tsx` | Teams & Practice |
| `src/routes/teams.$slug.tsx` | Team profile |
| `src/routes/divisions.tsx` | Divisions |
| `src/routes/rules.tsx` | Rules |
| `src/routes/privacy.tsx` | Privacy |
| `src/routes/terms.tsx` | Terms |
| `src/routes/maintenance.tsx` | Maintenance |
| `src/routes/_authenticated/route.tsx` | Authenticated route gate |
| `src/routes/_authenticated/dashboard.tsx` | Player dashboard |
| `src/routes/_authenticated/team.tsx` | Team HQ |
| `src/routes/_authenticated/team_.players.tsx` | Recruiting |
| `src/routes/_authenticated/team_.settings.tsx` | Team settings |
| `src/routes/_authenticated/matches.$matchId.tsx` | Match result UI |
| `src/routes/_authenticated/support.tsx` | User support |
| `src/routes/_authenticated/admin.tsx` | Admin control center |
| `src/routes/_authenticated/admin_.splits.tsx` | Split operations |
| `src/routes/_authenticated/admin_.disputes.tsx` | Disputes |
| `src/routes/_authenticated/admin_.support.tsx` | Staff support |

## Product components

| File | Responsibility |
| --- | --- |
| `BracketView.tsx` | Read-only tournament tree |
| `CompetitionOpsPanel.tsx` | Staff tournament actions |
| `DivisionBadge.tsx` | Division visual identity |
| `EmptyState.tsx` | Empty states |
| `OnboardingChecklist.tsx` | Dashboard onboarding |
| `PlayerRow.tsx` | Player list row/avatar |
| `ProfileSettingsCard.tsx` | Profile settings |
| `RiotAccountCard.tsx` | Riot connection/sync UI |
| `ScrimBoard.tsx` | Scrim discovery and lifecycle |
| `SectionHeader.tsx` | Shared section heading |
| `StatTile.tsx` | Shared metric tile |
| `StatusBadge.tsx` | Status presentation |
| `TeamCard.tsx` | Public team directory card |
| `TeamLaneRole.tsx` | Lane-role icon/badge model |
| `TeamWorkspaceNav.tsx` | Team HQ navigation |
| `TournamentCard.tsx` | Tournament directory card |
| `TournamentRegisterButton.tsx` | Registration/check-in state/action |

## Server/data modules

| File | Responsibility |
| --- | --- |
| `eloshape.functions.ts` | Public server-function wrappers |
| `eloshape.server.ts` | Public data loaders |
| `queries.ts` | TanStack Query definitions |
| `competition.functions.ts` | Staff competition actions |
| `competition.server.ts` | Staff competition server implementation |
| `bracket.ts` | Bracket utility logic |
| `split-queries.ts` | Split query options |
| `splits.functions.ts` | Public split wrappers |
| `splits.server.ts` | Split loaders |
| `split-ops.functions.ts` | Staff split RPC wrapper |
| `tournament.functions.ts` | Tournament self-service wrappers |
| `tournament-entry.server.ts` | Tournament registration/check-in logic |
| `match-result.functions.ts` | Player/captain result workflow |
| `team.functions.ts` | Team/invite self-service |
| `team-management.functions.ts` | Captain/member/lane management |
| `team-search.functions.ts` | Recruiting candidate search |
| `scrim.functions.ts` | Scrim server functions |
| `riot.functions.ts` | Riot action wrappers |
| `riot.server.ts` | Riot HTTP integration |
| `riot-account.server.ts` | Riot-account persistence/validation |
| `support.functions.ts` | Support requests |
| `admin.functions.ts` | Admin wrappers |
| `admin.server.ts` | Admin read models |
| `profile.functions.ts` / `profile.server.ts` | Profile actions |
| `me.functions.ts` / `me.server.ts` | Current-user data |
| `supabase-public.server.ts` | Public server Supabase client |
| `format.ts` | Formatting helpers |
| `site-metadata.ts` | SEO/canonical metadata |
| `utils.ts` | Shared utility helpers |

## Supabase

- `supabase/migrations/`: ordered schema/behavior changes.
- `supabase/tests/`: transactional Postgres regression tests.
- `supabase/functions/riot-sync/`: Riot synchronization Edge Function.
- `src/integrations/supabase/types.ts`: generated TypeScript database contract.
- `src/integrations/supabase/auth-middleware.ts`: authenticated server-function boundary.

## Tests

Vitest:
- `src/lib/bracket.test.ts`
- `src/lib/format.test.ts`
- `src/lib/riot.server.test.ts`
- `src/lib/site-metadata.test.ts`

Postgres:
- `security_boundaries.test.sql`
- `competition_engine.test.sql`
- `prelaunch_16_team_semisplit.test.sql`
- `scrims_and_priority.test.sql`
