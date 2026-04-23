## ADDED Requirements

### Requirement: Local Postgres 16 service via Docker Compose

The repository SHALL provide `infra/docker-compose.yml` that defines a single service named `postgres` using the pinned image `postgres:16-alpine`, exposing Postgres on the host via the mapping `"${POSTGRES_PORT:-5432}:5432"`.

#### Scenario: Starting the database on a fresh clone

- **WHEN** a developer runs `pnpm db:up` from the repo root on a machine that has Docker ≥ 24 installed but no prior Postgres data volume
- **THEN** the `postgres:16-alpine` image is pulled (if not cached), a container named after the compose project starts in the background, and `docker ps` shows it running with port `5432` (or the overridden `POSTGRES_PORT`) mapped to the host

#### Scenario: Image version is pinned

- **WHEN** two developers on different machines start the database for the first time
- **THEN** both pull the exact same image tag (`postgres:16-alpine`) and run the same major.minor.patch version of Postgres

### Requirement: Data persistence via named volume

The Postgres service SHALL persist its data directory in a named Docker volume called `employeek_pgdata`, mounted at `/var/lib/postgresql/data`.

#### Scenario: Data survives container restarts

- **WHEN** a developer creates a table, runs `pnpm db:down`, then runs `pnpm db:up`
- **THEN** the table and its rows are still present after the service comes back up

#### Scenario: Volume is namespaced to avoid collisions

- **WHEN** a developer runs `docker volume ls` after starting the service
- **THEN** the volume is listed with the name `employeek_pgdata` (prefixed to avoid collision with other local Postgres setups)

### Requirement: Healthcheck signals connection readiness

The Postgres service SHALL define a healthcheck that uses `pg_isready` against the configured user and database, so downstream services and scripts can wait for the DB to actually accept connections.

#### Scenario: Service reports healthy only when accepting connections

- **WHEN** a developer runs `pnpm db:up` and immediately runs `docker compose -f infra/docker-compose.yml ps`
- **THEN** the service status transitions from `starting` to `healthy` within 30 seconds, and only once healthy does `psql` successfully connect

#### Scenario: Healthcheck configuration

- **WHEN** inspecting the compose file
- **THEN** the healthcheck uses `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` with an interval of 5s, timeout of 5s, 10 retries, and a 10s start period

### Requirement: Configuration driven by `.env` at repo root

The compose file SHALL read Postgres credentials, database name, and port from a `.env` file at the repository root via `env_file`. The compose file SHALL NOT contain hardcoded credentials.

#### Scenario: Missing `.env` surfaces a clear error

- **WHEN** a developer runs `pnpm db:up` without creating a `.env` from `.env.example`
- **THEN** the command fails with a message referencing the missing `.env` file or the unset required variable, so the fix is obvious

#### Scenario: Host port is overridable

- **WHEN** a developer sets `POSTGRES_PORT=5433` in `.env` (because 5432 is taken by a host Postgres) and runs `pnpm db:up`
- **THEN** the container binds to host port 5433 and the service starts without a port-conflict error

### Requirement: `.env.example` documents every required variable

The repository SHALL contain a tracked `.env.example` at the root listing every variable the compose file and the application consume: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, and `DATABASE_URL`. Each variable SHALL have a safe placeholder value and a brief inline comment.

#### Scenario: New contributor bootstraps their env

- **WHEN** a new contributor runs `cp .env.example .env` and then `pnpm db:up`
- **THEN** the database starts successfully using the placeholder values without any additional editing

#### Scenario: `DATABASE_URL` is consistent with the individual vars

- **WHEN** a developer reads `.env.example`
- **THEN** the `DATABASE_URL` value is of the form `postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@localhost:<POSTGRES_PORT>/<POSTGRES_DB>?schema=public` and the placeholder substitutions line up with the other variables

### Requirement: `.env` file is gitignored

The repository SHALL treat `.env` (and any variant like `.env.local`) as untracked. Only `.env.example` is committed.

#### Scenario: `.env` cannot be accidentally committed

- **WHEN** a developer creates `.env` from `.env.example` and runs `git status`
- **THEN** `.env` does not appear as untracked — it is ignored — and `git add .env` (if attempted) produces a warning or is silently skipped

### Requirement: Root scripts for database lifecycle

The root `package.json` SHALL expose these scripts, each delegating to `docker compose -f infra/docker-compose.yml`:

- `db:up` — start the Postgres service in detached mode.
- `db:down` — stop and remove the container (preserves the volume).
- `db:logs` — tail the Postgres service logs.
- `db:reset` — stop the service, remove the volume, and restart with a clean data directory.

#### Scenario: Starting and stopping the database

- **WHEN** a developer runs `pnpm db:up` followed by `pnpm db:down`
- **THEN** the container is created and removed respectively, while the `employeek_pgdata` volume remains intact

#### Scenario: Following logs

- **WHEN** a developer runs `pnpm db:logs`
- **THEN** the terminal streams the Postgres service logs until interrupted with Ctrl+C, without stopping the service

#### Scenario: Resetting the database wipes data and reboots

- **WHEN** a developer runs `pnpm db:reset`
- **THEN** the service is stopped, the `employeek_pgdata` volume is deleted, and a new empty Postgres instance is started — all in one command, with teardown succeeding before the restart is attempted

### Requirement: Legacy stack unaffected

The `legacy/` directory and its existing Express + Sequelize configuration SHALL NOT be modified by this change. The legacy app's database connection SHALL continue to work exactly as it did before CH2.

#### Scenario: Legacy still runs against its own DB

- **WHEN** a developer runs `cd legacy && npm install && npm run dev` before or after `pnpm db:up`
- **THEN** the legacy server starts and behaves identically to how it did at the end of CH1 — unaware of the new compose-managed Postgres

### Requirement: Developer documentation covers local database workflow

`CLAUDE.md` SHALL include a "Local database" section documenting:

- The Docker ≥ 24 prerequisite.
- The one-time setup: `cp .env.example .env`.
- The four `db:*` scripts and what each does.
- The destructive nature of `db:reset`.
- The fact that schema management is handled by Prisma in CH3, not here.

#### Scenario: New contributor onboards the database

- **WHEN** a new contributor reads the "Local database" section of `CLAUDE.md`
- **THEN** they can start the database, connect with an external client, and know that data will persist between `db:down` and `db:up`, and that `db:reset` will destroy it
