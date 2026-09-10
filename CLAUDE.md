# EloShape repository instructions

Read and follow [`AGENTS.md`](AGENTS.md) before editing this repository.

## Environment safety

- Use the `staging` branch and staging Supabase project for development, QA and synthetic data.
- Do not run destructive tests, fixtures or ad-hoc migrations against production.
- Database changes belong in ordered `supabase/migrations/` files and must be verified on staging first.
- Keep Riot and service-role credentials server-side. Never add them to `VITE_*`, source files, logs or browser responses.
- Public Supabase keys are environment-specific; do not point CI or local development at production.

## Git safety

- The repository is connected to Lovable. Do not force-push, rebase, amend or squash published commits.
- Preserve unrelated user changes and keep every pushed commit buildable.

## Required checks

Before publishing application changes, run:

```sh
bun run lint
bun run build
bunx tsc --noEmit
bunx vitest run
git diff --check
```
