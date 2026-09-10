# EloShape Arena

EloShape is a free League of Legends competition platform for amateur Iron-to-Gold players, initially focused on LAS. Players form five-player teams, enter traditional single-elimination qualifiers, confirm results, resolve disputes, and earn EloShape points exclusively from EloShape tournament placements.

EloShape is an independent project and is not endorsed by Riot Games. It does not calculate MMR or replace Riot's ranked system.

## Current status

The application is a working closed-beta prototype. Production remains in maintenance mode while Riot reviews the Production API application. The `staging` branch is the reviewer and QA environment.

Implemented flows include:

- email/password authentication with branded EloShape transactional email;
- player profiles, locations, Riot ID lookup, Solo Queue rank and account-level sync;
- staff eligibility review;
- five-player teams, invitations, roster management and safe team archival;
- team registration, check-in and immutable roster locking;
- single-elimination bracket generation and winner advancement;
- player result confirmation, disputes and staff resolution;
- tournament finalization, configurable point awards, rankings and Semi-Split qualification;
- authenticated support and account-deletion requests;
- public Terms and Privacy pages.

## Stack

- TanStack Start, TanStack Router and React 19
- TypeScript and Vite
- Tailwind CSS and shadcn/ui
- Supabase Postgres, Auth and Edge Functions
- Vercel deployment and GitHub Actions CI

## Local development

Requirements: Bun and access to the EloShape staging project.

```sh
bun install
cp .env.example .env.local
bun run dev
```

Fill `.env.local` with the public connection values for **staging**. Never use the production project for routine development or QA. `RIOT_API_KEY` must remain an encrypted Supabase Edge Function secret and must never appear in a `VITE_*` variable, browser bundle or repository file.

## Verification

```sh
bun run lint
bun run build
bunx tsc --noEmit
bunx vitest run
```

Database integration tests are in `supabase/tests/`. The full 16-team prelaunch simulation is transactional and rolls back its fixture data.

## Environments and operations

- `staging`: development, automated QA, Riot review and closed-beta validation.
- `main`: production code; the public domain remains in maintenance mode until launch approval.
- Database changes must be committed as ordered files in `supabase/migrations/` and validated on staging before production promotion.
- Never force-push or rewrite published history because the repository is connected to Lovable.

Operational references:

- [`docs/ENVIRONMENTS.md`](docs/ENVIRONMENTS.md)
- [`docs/TOURNAMENT_ZERO_RUNBOOK.md`](docs/TOURNAMENT_ZERO_RUNBOOK.md)
- [`docs/RIOT-PRODUCTION-APPLICATION.md`](docs/RIOT-PRODUCTION-APPLICATION.md)
- [`docs/AUTH_EMAIL_SETUP.md`](docs/AUTH_EMAIL_SETUP.md)
- [`docs/DOCUMENTACION.md`](docs/DOCUMENTACION.md)

## Remaining launch work

1. Receive Riot Production API approval and replace the temporary development key.
2. Add Riot Sign On only after Riot grants RSO access; current Riot ID lookup does not prove ownership.
3. Run the tournament-zero rehearsal and a small invite-only closed beta.
4. Enable production monitoring and leaked-password protection where the Supabase plan supports it.
5. Finalize the minors/guardian policy before opening registration broadly.
