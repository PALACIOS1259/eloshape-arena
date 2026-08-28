# EloShape environments

## Current topology

EloShape keeps synthetic development/QA data separate from the environment reserved for public traffic.

### Staging / development

- Supabase project: `PALACIOS1259's Project` (`ujlzcdmotrihwgjshdcs`).
- Purpose: local development, QA, Riot integration testing, staff workflow testing and pre-launch validation.
- The project was the existing empty project selected for staging on 2026-08-28.
- All repository migrations are applied.
- Disposable synthetic tournament fixtures are allowed here and must use unmistakable QA names.
- The repeatable full-circuit stress test lives at `supabase/tests/prelaunch_16_team_semisplit.test.sql` and ends with `ROLLBACK`.
- Rename the project to `EloShape Staging` in the Supabase dashboard when dashboard access is available.

### Production

- Supabase project: `eloshape-arena` (`hdlktzhjsswzcbgrnhql`).
- Purpose: the existing application data and the future public environment.
- Do not run synthetic tournament fixtures or destructive QA against this project.
- Promote only reviewed migrations and Edge Functions from the repository.
- Production received no QA users, teams or players during the staging validation on 2026-08-28.

## Deployment rules

Before staging receives application traffic:

1. Connect the Git branch `staging` to a separate deployment.
2. Configure all Supabase public variables with the staging project values.
3. Configure staging Auth Site URL and Redirect URLs.
4. Deploy the required Edge Functions and staging-only secrets.
5. Set `VITE_SITE_URL` and the Riot CORS allowed origin to the staging deployment origin.
6. Run browser smoke tests against the deployed application.

Before production receives public traffic:

1. Apply only reviewed repository migrations to production.
2. Deploy the required Edge Functions and production-only secrets.
3. Configure Supabase Auth Site URL and Redirect URLs for the final public domain.
4. Configure strong server-side password requirements.
5. Set `VITE_SITE_URL` and the Riot CORS allowed origin to the final domain.
6. Verify the deployed Riot API key is a persistent production key.
7. Run smoke tests without inserting fake competitive history.
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
- complete rollback when run through the repository test.

A persistent staging-only fixture was also completed successfully on 2026-08-28: four qualifiers, 60 qualifier matches, 16 unique qualifications and all 15 playoff matches. Production remained untouched.
