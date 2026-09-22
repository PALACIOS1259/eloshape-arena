# EloShape documentation

This folder is the technical source of truth for EloShape. It describes the code that exists on the `staging` branch and the schema deployed to the staging Supabase project.

## Read this first

- [DOCUMENTACION.md](./DOCUMENTACION.md) — Spanish master overview and product rules.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — application architecture, request paths and route map.
- [DATABASE.md](./DATABASE.md) — database model, ERD and security explanation.
- [SCHEMA_REFERENCE.md](./SCHEMA_REFERENCE.md) — field-level reference for all 28 staging tables, constraints, indexes, policies and triggers.
- [RPC_REFERENCE.md](./RPC_REFERENCE.md) — all public/private database functions, signatures, return types, security mode and purpose.
- [MIGRATIONS.md](./MIGRATIONS.md) — ordered migration history and staging-only migration notes.
- [COMPETITION_ENGINE.md](./COMPETITION_ENGINE.md) — tournament engine, brackets, scoring, qualifiers and Semi-Splits.
- [TEAMS_AND_SCRIMS.md](./TEAMS_AND_SCRIMS.md) — team lifecycle, roles, invitations and scrim system.
- [OPERATIONS.md](./OPERATIONS.md) — staff/admin operational runbook.
- [DEVELOPMENT.md](./DEVELOPMENT.md) — local development, migrations, testing and deployment.
- [CODE_MAP.md](./CODE_MAP.md) — file-by-file map of the application.
- [FILE_INVENTORY.md](./FILE_INVENTORY.md) — inventory and purpose of every file under `src/`.
- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) — intentional staging fixtures, external dependencies and launch blockers.

Existing focused runbooks remain authoritative for their specific subject:

- [ENVIRONMENTS.md](./ENVIRONMENTS.md)
- [TOURNAMENT_ZERO_RUNBOOK.md](./TOURNAMENT_ZERO_RUNBOOK.md)
- [RIOT-PRODUCTION-APPLICATION.md](./RIOT-PRODUCTION-APPLICATION.md)
- [AUTH_EMAIL_SETUP.md](./AUTH_EMAIL_SETUP.md)
- [VIDEO_LAUNCH_PLAN.md](./VIDEO_LAUNCH_PLAN.md)

## Documentation maintenance rule

Any change to one of these areas should update the corresponding document in the same pull request/commit series:

1. database schema or RPC;
2. tournament/scoring behavior;
3. auth/security boundary;
4. user-visible route or major workflow;
5. deployment/environment contract.

The documentation describes behavior, not secrets. Never add service-role keys, Riot API keys, passwords or private user data.
