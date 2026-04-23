## Why

The monorepo still has no schema owner. `apps/api` is a bare TypeScript stub, the legacy Sequelize models in `legacy/src/modelos/` are quarantined, and CH2 left us with an empty Postgres 16 container. Before CH4 can stand up Fastify endpoints, we need a typed, migration-versioned schema that matches the three legacy tables (`empleado`, `estado`, `tareas`) and produces a generated Prisma client every workspace can import.

## What Changes

- Add Prisma 7 to `apps/api` as the single ORM: `prisma` (dev) + `@prisma/client` (runtime), both at `^7`, with the schema living at `apps/api/prisma/schema.prisma`.
- Model the three legacy entities — `Empleado`, `Estado`, `Tarea` — as Prisma models, snake_casing DB columns via `@map`/`@@map` while keeping idiomatic camelCase fields in TypeScript.
- Replace the legacy `FLOAT` salary and `STRING` date columns with typed equivalents: `salario Decimal(12, 2)` and `fechaIngreso` / `fechaCreacion` / `fechaInicioTarea` / `fechaFinalizacion` as `@db.Date` (date-only, no time component).
- Keep Sequelize's `createdAt`/`updatedAt` on `empleado` (the only legacy model with `timestamps: true`) via Prisma's `@default(now())` + `@updatedAt`; `estado` and `tareas` remain timestamp-free to preserve legacy behaviour.
- Add foreign keys `Tarea.idEmpleado → Empleado.id` and `Tarea.idEstado → Estado.id`, both with `onDelete: Restrict` (safer default than Sequelize's implicit `NO ACTION`).
- Generate the initial migration (`the initial `init` migration`) against the CH2 Dockerized Postgres, commit the generated SQL, and seed a small `estado` catalogue (pendiente/en-progreso/finalizada) via `prisma/seed.ts`.
- Add root-level scripts that proxy into `apps/api`: `pnpm db:migrate` (dev migrations), `pnpm db:migrate:deploy` (CI/prod apply), `pnpm db:generate` (regenerate client), `pnpm db:seed`, `pnpm db:studio`.
- Wire Prisma Client generation into Turbo so `pnpm build` and `pnpm typecheck` regenerate the client when `schema.prisma` changes, and cache the generated artefact under `apps/api/node_modules/.prisma/`.
- Document the Prisma workflow in `CLAUDE.md` (how to edit the schema, how to create a migration, how `db:reset` interacts with migrations).

## Capabilities

### New Capabilities

- `db-schema-prisma`: Prisma-owned schema for EmployeeK (models, migrations, generated client, seed data, developer scripts). This is the contract CH4 (`rebuild-api-fastify-ajv-errors`) consumes.

### Modified Capabilities

<!-- None. `db-local-postgres` keeps its contract — this change adds a schema on top, it does not change how Postgres is provisioned. `monorepo-foundation` is untouched. -->

## Impact

- **New files**: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/<timestamp>_init/migration.sql`, `apps/api/prisma/migrations/migration_lock.toml`, `apps/api/prisma/seed.ts`, `apps/api/src/db/client.ts` (exports a singleton `PrismaClient`).
- **Modified files**: `apps/api/package.json` (adds Prisma deps + `prisma` block with `seed`), root `package.json` (adds 5 db scripts), `turbo.json` (adds `db:generate` + input globs on `schema.prisma`), `.gitignore` (covers `apps/api/node_modules/.prisma/`), `CLAUDE.md` (adds a "Schema & migrations" subsection).
- **Dependencies**: `prisma@^7`, `@prisma/client@^7`, `tsx` (for running `seed.ts`) — all inside `apps/api`. No root dep additions.
- **Runtime surface**: `apps/api` gains a working DB client but still has no HTTP server — that is CH4's scope. The skeleton `console.log` stays until Fastify lands.
- **Downstream**: unblocks CH4 (Fastify will import `PrismaClient` from `apps/api/src/db/client.ts`) and CH6 (OpenAPI types can reference Prisma-generated model shapes). CH7 (CI) will later wire `prisma migrate deploy` into the deploy job.
- **Legacy**: `legacy/` is untouched. Its Sequelize models remain the reference for what the schema must represent, but no code is copied — Prisma models are written from scratch to match the DB shape, not the JS API.
