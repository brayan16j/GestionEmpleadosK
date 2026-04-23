## ADDED Requirements

### Requirement: Prisma is the sole ORM for `apps/api`

The `apps/api` workspace SHALL use Prisma 7.x as its only ORM. `apps/api/package.json` SHALL declare `prisma` as a devDependency and `@prisma/client` as a runtime dependency, both pinned to the same `^7` major version. No other ORM (Sequelize, Drizzle, TypeORM, Knex) SHALL be present in `apps/api`.

#### Scenario: Prisma packages are installed in `apps/api`

- **WHEN** a developer runs `pnpm install` on a fresh clone
- **THEN** `apps/api/node_modules/prisma/` and `apps/api/node_modules/@prisma/client/` both exist, and `pnpm --filter @employeek/api list prisma @prisma/client` reports matching `^7.x` versions

#### Scenario: No legacy ORM leaks into `apps/api`

- **WHEN** inspecting `apps/api/package.json` and `apps/api/src/`
- **THEN** no entry or import references `sequelize`, `typeorm`, `drizzle-orm`, or `knex`

### Requirement: Schema file lives at `apps/api/prisma/schema.prisma`

The repository SHALL contain a single Prisma schema at `apps/api/prisma/schema.prisma` with a `postgresql` datasource (no inline `url` — Prisma 7 moved that into `prisma.config.ts`) and a `client` generator set to `provider = "prisma-client-js"`. The repository SHALL also contain `apps/api/prisma.config.ts` that loads the repo-root `.env` via `process.loadEnvFile()` and exports a `defineConfig` object with `datasource.url = process.env.DATABASE_URL`.

#### Scenario: Schema validates against the CLI

- **WHEN** a developer runs `pnpm --filter @employeek/api exec prisma validate`
- **THEN** the command exits with code 0 and no warnings

#### Scenario: Datasource URL comes from the repo-root `.env`

- **WHEN** a developer runs any `prisma` command from inside `apps/api/`
- **THEN** `prisma.config.ts` loads `../../.env` and Prisma connects using the `DATABASE_URL` from that file (no `--env-file` flag, no duplicated `.env` inside `apps/api/`)

#### Scenario: Missing `DATABASE_URL` surfaces a clear error

- **WHEN** a developer runs a Prisma command with no `.env` present at the repo root
- **THEN** `prisma.config.ts` throws a descriptive error referencing `DATABASE_URL` and `.env.example`, rather than a cryptic connection failure

### Requirement: `Empleado` model matches the legacy `empleado` table

The schema SHALL define a model `Empleado` mapped to table `empleado` with these columns: `id` (auto-increment primary key), `nombre` (non-null string), `fecha_ingreso` (non-null date, no time component), `salario` (non-null `Decimal(12, 2)`), `created_at` (non-null timestamp, defaults to `now()`), `updated_at` (non-null timestamp, updated on every write). TypeScript fields SHALL be camelCase (`fechaIngreso`, `createdAt`, `updatedAt`); DB columns SHALL be snake_case via `@map`.

#### Scenario: Columns exist with the correct Postgres types

- **WHEN** the `<timestamp>_init` migration has been applied to the local database
- **THEN** `psql` reports `empleado` has columns `id serial`, `nombre text`, `fecha_ingreso date`, `salario numeric(12,2)`, `created_at timestamp`, `updated_at timestamp`, all non-null

#### Scenario: Generated TypeScript type uses camelCase

- **WHEN** a developer imports `Empleado` from `@prisma/client` after `prisma generate`
- **THEN** the type exposes fields `id`, `nombre`, `fechaIngreso`, `salario`, `createdAt`, `updatedAt` (camelCase) — not snake_case

#### Scenario: `updatedAt` moves forward on every write

- **WHEN** an `Empleado` row is updated via `prisma.empleado.update`
- **THEN** the `updated_at` column in Postgres reflects the write time, greater than the previous value

### Requirement: `Estado` model matches the legacy `estado` table with a unique `nombre`

The schema SHALL define a model `Estado` mapped to table `estado` with columns: `id` (auto-increment primary key), `nombre` (non-null string, **UNIQUE** — added in this change to enforce catalogue integrity and enable idempotent seed upserts), `categoria` (non-null string), `cambios_permitidos` (nullable string). No `created_at`/`updated_at` columns — the legacy model had `timestamps: false`.

#### Scenario: Estado has no timestamp columns

- **WHEN** inspecting the `estado` table in Postgres after migration
- **THEN** the only columns present are `id`, `nombre`, `categoria`, `cambios_permitidos` — no `created_at`, `updated_at`, or any other audit field

#### Scenario: Nullable `cambiosPermitidos`

- **WHEN** a developer inserts an `Estado` with `cambiosPermitidos: null` via Prisma
- **THEN** the insert succeeds and the stored row has a SQL `NULL` in `cambios_permitidos`

#### Scenario: Unique constraint on nombre is enforced

- **WHEN** a developer attempts to insert a second `Estado` row with a `nombre` that already exists
- **THEN** Postgres rejects the insert with a unique constraint violation, and `prisma.estado.findUnique({ where: { nombre } })` is a valid typed query

### Requirement: `Tarea` model matches the legacy `tareas` table and its foreign keys

The schema SHALL define a model `Tarea` mapped to table `tareas` with columns: `id` (auto-increment primary key), `nombre` (non-null string), `fecha_creacion`, `fecha_inicio_tarea`, `fecha_finalizacion` (all non-null date, no time component), `id_empleado` (non-null integer FK to `empleado.id`), `id_estado` (non-null integer FK to `estado.id`). Both foreign keys SHALL use `onDelete: Restrict` and `onUpdate: Cascade`. No `created_at`/`updated_at` columns — the legacy model had `timestamps: false`.

#### Scenario: Foreign keys are enforced in Postgres

- **WHEN** a developer attempts to insert a `Tarea` row with `idEmpleado` pointing to a non-existent empleado
- **THEN** Postgres rejects the insert with a foreign key violation error

#### Scenario: Deleting an empleado with tareas is restricted

- **WHEN** a developer attempts to `DELETE FROM empleado WHERE id = <id with tareas>`
- **THEN** Postgres rejects the delete with a foreign key restrict error, and the empleado and its tareas remain

#### Scenario: Relation fields on both sides

- **WHEN** a developer queries `prisma.empleado.findFirst({ include: { tareas: true } })`
- **THEN** the returned object includes a `tareas` array; likewise `prisma.tarea.findFirst({ include: { empleado: true, estado: true } })` returns a single `empleado` and a single `estado`

### Requirement: Initial migration is committed and reproducible

The repository SHALL contain exactly one initial migration directory under `apps/api/prisma/migrations/` with name `<timestamp>_init` (Prisma's default timestamp-prefixed format) containing the generated `migration.sql` and `apps/api/prisma/migrations/migration_lock.toml` with `provider = "postgresql"`. Running `prisma migrate deploy` against an empty Postgres 16 SHALL produce a database schema identical to `schema.prisma`.

#### Scenario: Fresh DB comes up via `migrate deploy`

- **WHEN** a developer runs `pnpm db:reset` (empties the volume) then `pnpm db:migrate:deploy`
- **THEN** the three tables (`empleado`, `estado`, `tareas`) plus Prisma's `_prisma_migrations` bookkeeping table exist, and `pnpm --filter @employeek/api exec prisma migrate status` reports "Database schema is up to date"

#### Scenario: Generated SQL is reviewable

- **WHEN** inspecting `apps/api/prisma/migrations/<timestamp>_init/migration.sql`
- **THEN** it contains explicit `CREATE TABLE` statements for `empleado`, `estado`, `tareas`, with `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY` statements for the two FKs on `tareas`, and no lines referencing models that are not in the schema

#### Scenario: Drift detection catches manual DB edits

- **WHEN** a developer edits the `empleado` table by hand (e.g. adds a column via `psql`) and runs `pnpm --filter @employeek/api exec prisma migrate dev`
- **THEN** Prisma detects drift and refuses to apply silently, offering to reset or produce a new migration

### Requirement: Seed script populates the `estado` catalogue idempotently

The repository SHALL contain `apps/api/prisma/seed.ts` that upserts the three required `estado` rows — `pendiente`, `en-progreso`, `finalizada` — keyed on the unique `nombre` field. The seed command SHALL be registered in `apps/api/prisma.config.ts` via `migrations.seed = 'tsx prisma/seed.ts'` (Prisma 7 moved the seed config out of `package.json`'s `prisma` block into `prisma.config.ts`).

#### Scenario: Seed runs on an empty DB

- **WHEN** a developer runs `pnpm db:seed` against a freshly migrated DB
- **THEN** `SELECT nombre FROM estado ORDER BY id` returns exactly `pendiente`, `en-progreso`, `finalizada` in that order

#### Scenario: Seed is idempotent

- **WHEN** a developer runs `pnpm db:seed` a second time
- **THEN** the command succeeds with exit code 0 and `estado` still contains exactly the same three rows (no duplicates, no errors)

#### Scenario: Seed reference matches legacy controller expectations

- **WHEN** inspecting the seeded rows
- **THEN** each has the expected `categoria` (`activa` for pendiente and en-progreso, `cerrada` for finalizada) and `cambiosPermitidos` string, consistent with the transitions in `legacy/src/controllers/estadoController.js`

### Requirement: `PrismaClient` is exposed as a singleton

`apps/api/src/db/client.ts` SHALL export a singleton `prisma` instance of `PrismaClient`. The module SHALL use the `globalThis` caching pattern so that `tsx watch` reloads do not spawn duplicate clients in development.

#### Scenario: Client is importable from app code

- **WHEN** a developer imports `prisma` from `src/db/client.ts` and calls `prisma.empleado.count()`
- **THEN** TypeScript reports no errors and the query returns a number

#### Scenario: No duplicate connections in dev

- **WHEN** a developer runs `pnpm --filter @employeek/api dev` and saves the file 10 times
- **THEN** Postgres reports a single active connection for that developer (not 11), verified via `SELECT count(*) FROM pg_stat_activity WHERE usename = current_user`

#### Scenario: Client is not imported directly from `@prisma/client` in app code

- **WHEN** grepping `apps/api/src/` for `from '@prisma/client'`
- **THEN** the only match is inside `src/db/client.ts`; all other app modules import from `./db/client.js` (or the equivalent relative path)

### Requirement: Root scripts proxy Prisma lifecycle commands into `apps/api`

The root `package.json` SHALL expose these scripts, each delegating into `apps/api` via `pnpm --filter @employeek/api exec`:

- `db:migrate` — `prisma migrate dev` (dev migrations with prompt).
- `db:migrate:deploy` — `prisma migrate deploy` (non-interactive apply, safe for CI).
- `db:generate` — `prisma generate` (regenerate client).
- `db:seed` — `prisma db seed` (runs `prisma/seed.ts`).
- `db:studio` — `prisma studio` (opens the browser-based DB explorer).

#### Scenario: Running migrate from the repo root

- **WHEN** a developer runs `pnpm db:migrate` from the repo root with the DB up
- **THEN** Prisma creates/applies migrations against the same `DATABASE_URL` that CH2 configured, without requiring `cd apps/api`

#### Scenario: CI-safe deploy command exists

- **WHEN** a developer runs `pnpm db:migrate:deploy` against a DB that already has `<timestamp>_init` applied
- **THEN** the command is a no-op and exits 0, without prompting for input

#### Scenario: Studio is reachable

- **WHEN** a developer runs `pnpm db:studio`
- **THEN** Prisma Studio starts on its default port and connects to the local DB

### Requirement: Turbo regenerates the Prisma client when the schema changes

`turbo.json` SHALL define a `db:generate` task whose `inputs` include `apps/api/prisma/schema.prisma` and whose `outputs` include `apps/api/node_modules/.prisma/**` and `apps/api/node_modules/@prisma/client/**`. The `build` and `typecheck` tasks SHALL declare `db:generate` in their `dependsOn`.

#### Scenario: Schema edit invalidates the cache

- **WHEN** a developer edits `apps/api/prisma/schema.prisma` and runs `pnpm typecheck`
- **THEN** Turbo re-runs `db:generate` before `typecheck` (no cache hit for generate), and the new client is available to the type-checker

#### Scenario: Unchanged schema hits the cache

- **WHEN** a developer runs `pnpm typecheck` twice in a row with no schema changes
- **THEN** the second run reports a cache hit for `db:generate` and completes in under 2 seconds

### Requirement: Legacy stack unaffected

The `legacy/` directory SHALL NOT be modified by this change. Legacy Sequelize models, the hardcoded `actividad1k` connection, and legacy controllers SHALL remain exactly as they were at the end of CH2.

#### Scenario: Legacy app still boots

- **WHEN** a developer runs `cd legacy && npm install && npm run dev` after this change is applied
- **THEN** the legacy Express server starts on port 4000 and connects to its own DB exactly as it did before CH3

#### Scenario: No Prisma imports inside `legacy/`

- **WHEN** grepping `legacy/` for `prisma` or `@prisma/client`
- **THEN** there are zero matches

### Requirement: Developer documentation covers the Prisma workflow

`CLAUDE.md` SHALL include a "Schema & migrations" subsection under the "Local database" area, documenting:

- The location of `schema.prisma` and how to edit it.
- How to create a new migration (`pnpm db:migrate` — will prompt for a name).
- How seed data works (`pnpm db:seed`, idempotent).
- The fact that `pnpm db:reset` drops the volume — migrations and seed must be re-run afterwards.
- The singleton client at `apps/api/src/db/client.ts` and the rule that app code imports from there, not directly from `@prisma/client`.

#### Scenario: New contributor edits the schema

- **WHEN** a new contributor reads the "Schema & migrations" subsection and follows it to add a column to `Empleado`
- **THEN** they can edit `schema.prisma`, run `pnpm db:migrate`, and see the new migration appear under `apps/api/prisma/migrations/` without asking for help
