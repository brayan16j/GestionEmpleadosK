## Context

The monorepo is TypeScript-strict on pnpm + Turborepo (CH1 archived). There is no database yet: `apps/api` is a stub and `legacy/` has its own hardcoded Sequelize connection that we explicitly will not touch until CH8.

CH3 (`migrate-sequelize-to-prisma`) needs a running Postgres to run `prisma migrate dev` and shape the first schema. CH4 (`rebuild-api-fastify-ajv-errors`) will connect to the same DB via `@fastify/env`. This change provides the shared dependency both of them consume: a one-command local Postgres.

The developers are on Windows, Mac, and Linux. Konecta laptops have Docker Desktop (Windows/Mac) or native Docker Engine (Linux). No one has raw Postgres installed in the standard image, and enforcing that would hurt onboarding.

## Goals / Non-Goals

**Goals:**

- One command brings up a working Postgres 16 instance: `pnpm db:up`.
- The instance is reproducible — same image tag, same config, same volume layout on every machine.
- Schema and data persist between `db:down` and `db:up`.
- `db:reset` gives a clean slate in seconds (wipes volume, reboots).
- Credentials and connection string live in `.env` (gitignored), with a tracked `.env.example` that documents every variable.
- Healthcheck marks the service healthy only when Postgres actually accepts connections, so later changes can depend on it (`depends_on: condition: service_healthy`).
- Host port is overridable so developers with a local Postgres installation can coexist.

**Non-Goals:**

- No schema, no tables, no seed data — that is CH3 (Prisma).
- No pgAdmin / Adminer / any DB UI container. Developers use their own tool (DBeaver, TablePlus, psql).
- No production or staging compose file. This is strictly local dev.
- No integration with `apps/api` beyond defining `DATABASE_URL` in `.env.example`. The API does not yet read it.
- No automated backup/restore. Data is ephemeral per-developer.

## Decisions

### Postgres 16 (official image)

Use `postgres:16-alpine`. Pin the exact image tag in compose so everyone gets the same version.

**Rationale:** 16 is the current mainstream/supported major (until Nov 2028), matches what Konecta production clusters typically run, and Prisma 5.x lists 16 as fully supported. Alpine variant reduces image size by ~70%, which matters on slow corporate networks.

**Alternatives considered:**

- `postgres:15` — older; no reason to start behind the curve.
- `postgres:17` — too new; Prisma 5.x adds support incrementally; pick a boring default.
- Full `postgres:16` (Debian) — bigger, no features we need.

### Docker Compose v2 (plugin, not standalone binary)

Compose file is `infra/docker-compose.yml`, invoked via `docker compose -f infra/docker-compose.yml …`. No legacy `docker-compose` (with hyphen).

**Rationale:** v2 has been the default since Docker Desktop 3.4 (2021) and is actively maintained. The legacy v1 binary was EOL in mid-2023. Scripts that assume v1 will silently break on newer Docker installs.

### Named volume `employeek_pgdata` (not bind mount)

`volumes: employeek_pgdata:` declared at the top level, mounted at `/var/lib/postgresql/data`.

**Rationale:**

- Bind mounts on Windows hosts cause permission pain (`chown`/`chmod` surprises, path translation issues) and slow I/O.
- A named volume is portable, fast, and trivial to drop with `docker volume rm` (what `db:reset` does).
- Prefix `employeek_` avoids collision if the developer has other Postgres compose setups on the same machine.

**Alternative:** bind-mount `./data` — rejected; not needed for any dev workflow and Windows-hostile.

### Healthcheck with `pg_isready`

```yaml
healthcheck:
  test: ['CMD-SHELL', 'pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB']
  interval: 5s
  timeout: 5s
  retries: 10
  start_period: 10s
```

**Rationale:** Without a healthcheck, `depends_on` only waits for the container to *start*, not for Postgres to *accept connections*. Prisma migrate (CH3) and CI (CH7) will race and get `ECONNREFUSED`. `pg_isready` is the standard, idiomatic check.

### Single `.env` at repo root, compose reads it via `env_file`

Compose does not reference variables inline (`${POSTGRES_USER}`); instead `env_file: ../.env` passes the whole file into the container. The app (from CH4 onward) reads the same file via `dotenv` / `@fastify/env`.

**Rationale:**

- One source of truth. No drift between "compose env" and "app env".
- `DATABASE_URL` lives in `.env` too, so the app does not have to re-assemble it from parts.
- Compose's own interpolation (`${VAR}` in compose.yml itself, e.g. for port mapping) needs the same `.env`. Compose auto-loads `.env` from the project directory (which defaults to the compose file's folder, `infra/`), so the scripts pass `--env-file .env` explicitly to force the repo-root `.env` to be used for interpolation.

**Alternative:** per-service `environment:` hardcoded values — rejected; impossible to override per-developer without editing the tracked compose file.

### Host port overridable via `POSTGRES_PORT`

Port mapping is `"${POSTGRES_PORT:-5432}:5432"`.

**Rationale:** A developer who already runs Postgres natively on 5432 can set `POSTGRES_PORT=5433` in their `.env` and the container binds to the free port. Without this, compose fails with `bind: address already in use` and forces them to stop their host Postgres every time.

### Scripts at the **root** `package.json`, not per-workspace

```json
"db:up":    "docker compose --env-file .env -f infra/docker-compose.yml up -d",
"db:down":  "docker compose --env-file .env -f infra/docker-compose.yml down",
"db:logs":  "docker compose --env-file .env -f infra/docker-compose.yml logs -f postgres",
"db:reset": "docker compose --env-file .env -f infra/docker-compose.yml down -v && docker compose --env-file .env -f infra/docker-compose.yml up -d"
```

**Rationale:**

- The database is a cross-workspace concern; it is not owned by `apps/api`.
- Turborepo's task graph is for code build/lint/typecheck/test — infra lifecycle does not belong there (no cache benefit, no per-workspace fanout).
- `db:reset` chains with `&&` so it only restarts if the teardown succeeded.

**Trade-off:** these scripts are shell-portable enough for Windows PowerShell, Git Bash, macOS, and Linux because `docker compose` normalizes paths. No separate `db:reset.sh` needed.

## Risks / Trade-offs

- **[Port 5432 already in use on host]** → Mitigation: `POSTGRES_PORT` override documented in `.env.example` and CLAUDE.md.
- **[`db:reset` is destructive and unlabeled]** → Mitigation: document explicitly in CLAUDE.md that `db:reset` wipes all local data. No confirmation prompt (developer pain > safety here, and the command name is explicit). If needed, later we can add a confirm step; for now trust the name.
- **[Developer does not have Docker installed]** → Mitigation: document the Docker ≥ 24 requirement in CLAUDE.md's "Local database" section. Scripts fail loud with the real Docker error message (no custom pre-check — diagnosis is already clear).
- **[`.env` accidentally committed]** → Mitigation: `.gitignore` already covers `.env*` (CH1), plus `.env.example` lives side-by-side as the template. Pre-commit hook runs on staged files, so a committed `.env` would surface in code review.
- **[Alpine + locale weirdness]** → Mitigation: Postgres alpine image ships with `en_US.UTF-8` and we do not set LANG env vars. If later we hit collation issues, revisit by switching to the Debian tag — tracked as a known fallback, not a blocker.

## Migration Plan

Not applicable — no existing local Postgres setup to migrate from. Developers currently either (a) use no DB at all for the rebuild, or (b) have `legacy/` connected to some external DB that this change does not touch.

## Open Questions

None. All decisions above are implementation-ready.
