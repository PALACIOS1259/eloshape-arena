# EloShape environments

## Current policy

EloShape must keep development/QA data separate from the future public production environment.

### Staging / development

- Supabase project: `eloshape-arena`
- Purpose: local development, QA, Riot integration testing, staff workflow testing and pre-launch validation.
- Synthetic tournament fixtures are allowed only when they are transaction-scoped and rolled back, or explicitly marked as disposable staging data.
- The repeatable full-circuit stress test lives at `supabase/tests/prelaunch_16_team_semisplit.test.sql` and ends with `ROLLBACK`.

### Production reserved

- The second currently empty Supabase project in the same organization is reserved for the public production environment.
- It currently has no application migrations, no public application tables and no auth users.
- Do not point local development or QA tooling at this project.
- Do not populate it until the migration history/bootstrap has been reconciled and the production promotion checklist is complete.

## Promotion rules

Before production receives application traffic:

1. Reconcile repository migration history against the working staging schema. Do not blindly run `supabase db push` while migration history differs.
2. Apply a reviewed production bootstrap/migration sequence to the empty production project.
3. Deploy the required Edge Functions and production-only secrets there.
4. Configure Supabase Auth Site URL and Redirect URLs for the final public domain.
5. Configure strong server-side password requirements.
6. Set the public site URL and allowed Riot CORS origins to the final domain.
7. Run smoke tests against production without inserting fake competitive history.
8. Open closed beta only after the latest GitHub CI and database QA checks are green.

## Pre-launch competition QA

The full 16-team Semi-Split stress test verifies:

- four 16-team Open Qualifiers;
- five-player roster snapshots for every team;
- 15-match single-elimination qualifier brackets;
- Top 4 qualification per qualifier;
- pass-down when an already-qualified team finishes in a qualifying position again;
- exactly 16 unique qualified teams;
- a 16-team playoff with zero byes and 15 matches;
- full playoff completion;
- expected 16-team champion scoring of 115 EloShape points;
- complete rollback with zero QA fixtures left behind.

The test was successfully executed against staging on 2026-08-27 before this document was added.
