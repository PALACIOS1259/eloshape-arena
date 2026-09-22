# EloShape development guide

## 1. Local setup

Requirements:
- Bun
- Node-compatible local tooling
- Supabase CLI for database integration tests

```sh
bun install
cp .env.example .env.local
bun run dev
```

Use staging public connection values for local development. Never use production as a routine development database.

## 2. Environment variables

Public/server connection variables:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- corresponding Vite public values where the browser requires them

Secret values:
- Riot API key and similar credentials must remain server/secret-store only;
- never put secrets in `VITE_*`;
- never commit service-role credentials.

## 3. Branch policy

- `staging`: development and QA.
- `main`: production.
- Changes are validated on staging before promotion.
- Do not rewrite published history.

## 4. Code conventions

### Public reads

Use thin `createServerFn` wrappers and server-only loaders.

### Authenticated mutations

Use `requireSupabaseAuth`, create an authenticated Supabase client from the verified access token, call a constrained RPC/server operation, and translate raw database errors into user-safe errors.

### Database changes

DDL goes in a new ordered file under `supabase/migrations/`.

Do not edit an old applied migration to change production behavior; add a forward migration.

### Security-definer functions

- keep `search_path` restricted;
- revoke PUBLIC execution;
- grant only the roles that need the RPC;
- validate `auth.uid()` and staff/captain/participant relationship in the database;
- add security regression coverage.

## 5. App verification

```sh
bun run lint
bun run build
bunx tsc --noEmit
bunx vitest run
```

## 6. Database verification

CI boots a local Supabase database and runs:

```text
supabase/tests/security_boundaries.test.sql
supabase/tests/competition_engine.test.sql
supabase/tests/prelaunch_16_team_semisplit.test.sql
supabase/tests/scrims_and_priority.test.sql
```

Tests that create competition fixture data must run in a transaction and roll back.

## 7. GitHub Actions

`.github/workflows/ci.yml` runs two jobs:

### verify
- install dependencies;
- ESLint;
- production build;
- verify generated route tree is committed;
- TypeScript;
- Vitest.

### Database integration tests
- start local Supabase;
- security boundary test;
- competition engine test;
- 16-team Semi-Split test;
- scrim/qualifier-priority test;
- stop local Supabase.

## 8. Adding a feature

Recommended sequence:

1. identify data ownership/security boundary;
2. add migration/RPC if needed;
3. add server function wrapper;
4. add query/mutation;
5. add UI;
6. add unit/integration coverage;
7. update docs;
8. run CI;
9. inspect Vercel preview;
10. only then consider promotion.

## 9. Adding a route

TanStack Router is file-based. After adding/changing route files, build once and commit the generated route tree when it changes. CI verifies this.

## 10. Bracket UI rule

Bracket geometry is coordinate-driven. Match-card height and slot pitch are deliberately explicit. A visual change that changes card height must update layout geometry and be checked on:
- 16-team Round of 16;
- empty/pending bracket;
- completed bracket;
- mobile horizontal scroll.

## 11. Database debugging

When a public screen looks wrong:
1. verify the route/query key;
2. verify the server loader filters by the expected entity ID/slug;
3. compare raw rows in staging;
4. distinguish deterministic demo fixture behavior from a query bug;
5. avoid altering production rules merely to make fixture data look varied.
