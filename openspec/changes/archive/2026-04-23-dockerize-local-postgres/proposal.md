## Why

The monorepo has no local database infrastructure. Without a reproducible Postgres instance every developer has to install, configure, and run Postgres on their host, which drifts between machines and blocks onboarding. CH3 (`migrate-sequelize-to-prisma`) needs a running database to generate the first migration, so this change unblocks it.

## What Changes

- Add `infra/docker-compose.yml` that runs **Postgres 16** with a named volume, a healthcheck, and credentials/DB name pulled from `.env`.
- Add `.env.example` at the repo root documenting `DATABASE_URL` plus the compose variables (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`).
- Add root scripts to `package.json`: `db:up`, `db:down`, `db:logs`, `db:reset` — each delegating to `docker compose` against `infra/docker-compose.yml`.
- Update `.gitignore` to cover compose state (`.env`) and make `infra/` a tracked directory with its files.
- Update `CLAUDE.md` with a short "Local database" section (how to start the DB, what the scripts do, where the data volume lives).

## Capabilities

### New Capabilities

- `db-local-postgres`: reproducible local Postgres 16 instance managed via Docker Compose, plus root scripts and env conventions so every developer has the same database with one command.

### Modified Capabilities

<!-- None. `monorepo-foundation` remains untouched; this change adds infra, not changes the foundation contract. -->

## Impact

- **New files**: `infra/docker-compose.yml`, `.env.example`.
- **Modified files**: root `package.json` (adds 4 scripts), `.gitignore` (adds `.env`), `CLAUDE.md` (adds a section).
- **Dependencies**: no new npm dependencies. Relies on **Docker Desktop / Docker Engine ≥ 24** with the v2 compose plugin (already required in Konecta developer setup — documented in CLAUDE.md).
- **Downstream**: unblocks CH3 (`migrate-sequelize-to-prisma`), which will consume `DATABASE_URL` from `.env` to run `prisma migrate dev`. CH4 (`rebuild-api-fastify-ajv-errors`) will load the same `DATABASE_URL` via `@fastify/env`.
- **Legacy**: `legacy/` is untouched. The quarantined Express app keeps its own hardcoded DB config until it is retired in CH8.
