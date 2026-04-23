## 1. Prerequisites

- [x] 1.1 Create and switch to branch `feat/migrate-sequelize-to-prisma` (working tree must be clean)
- [x] 1.2 Verify Docker Postgres is up: `pnpm db:up` and `docker compose -f infra/docker-compose.yml ps` shows `healthy`
- [x] 1.3 Verify `.env` exists at repo root with a valid `DATABASE_URL` (copy from `.env.example` if missing — do NOT commit it)
- [x] 1.4 Read `openspec/changes/migrate-sequelize-to-prisma/proposal.md`, `design.md`, and `specs/db-schema-prisma/spec.md` end-to-end before writing code

## 2. Install Prisma in `apps/api`

- [x] 2.1 Add `prisma@^7` to `apps/api` devDependencies: `pnpm --filter @employeek/api add -D prisma`
- [x] 2.2 Add `@prisma/client@^7` to `apps/api` dependencies: `pnpm --filter @employeek/api add @prisma/client`
- [x] 2.3 Add `tsx` to `apps/api` devDependencies (needed for `prisma/seed.ts`) — verify it is not already pulled transitively; add explicitly: `pnpm --filter @employeek/api add -D tsx`
- [x] 2.4 Confirm `apps/api/package.json` pins both `prisma` and `@prisma/client` at matching `^7.x` versions (bump whichever is lower so they line up)
- [x] 2.5 Add a `postinstall` script to `apps/api/package.json`: `"postinstall": "prisma generate"` (safety net — Turbo is the primary path)

## 3. Initialize the schema

- [x] 3.1 Create `apps/api/prisma/` directory
- [x] 3.2 Create `apps/api/prisma/schema.prisma` with `generator client { provider = "prisma-client-js" }` and `datasource db { provider = "postgresql" }` (Prisma 7 moved `url` into the adapter config in `prisma.config.ts`)
- [x] 3.3 Run `pnpm --filter @employeek/api exec prisma validate` — must succeed before writing models

## 4. Model the three entities

- [x] 4.1 Add `model Empleado` with camelCase fields (`id`, `nombre`, `fechaIngreso`, `salario`, `createdAt`, `updatedAt`) and snake_case column mappings (`@map`/`@@map("empleado")`); use `@db.Date` for `fechaIngreso`, `@db.Decimal(12, 2)` for `salario`, `@default(now())` + `@updatedAt` for the audit columns
- [x] 4.2 Add `model Estado` with fields `id`, `nombre`, `categoria`, `cambiosPermitidos` (nullable), mapped to table `estado` with snake_case columns; NO timestamps
- [x] 4.3 Add `model Tarea` with fields `id`, `nombre`, `fechaCreacion`, `fechaInicioTarea`, `fechaFinalizacion` (all `@db.Date`), `idEmpleado`, `idEstado`, mapped to table `tareas`; NO timestamps
- [x] 4.4 Declare the relations: `Tarea.empleado → Empleado` on `idEmpleado` and `Tarea.estado → Estado` on `idEstado`, both with `onDelete: Restrict, onUpdate: Cascade`; add reverse sides `Empleado.tareas Tarea[]` and `Estado.tareas Tarea[]`
- [x] 4.5 Run `pnpm --filter @employeek/api exec prisma validate` — schema must be valid with zero warnings
- [x] 4.6 Run `pnpm --filter @employeek/api exec prisma format` so the schema is canonically formatted before commit

## 5. Generate the initial migration

- [x] 5.1 With the Docker DB up, run `pnpm --filter @employeek/api exec prisma migrate dev --name init` from the repo root — creates `apps/api/prisma/migrations/<timestamp>_init/migration.sql` and `migration_lock.toml`
- [x] 5.2 Inspect the generated SQL: confirm `CREATE TABLE empleado`, `CREATE TABLE estado`, `CREATE TABLE tareas`, the two `ADD CONSTRAINT ... FOREIGN KEY` statements on `tareas`, and `DECIMAL(12,2)` for `salario`
- [x] 5.3 Confirm `migration_lock.toml` contains `provider = "postgresql"` and commit it alongside the SQL
- [x] 5.4 Verify `.gitignore` does NOT accidentally ignore `apps/api/prisma/migrations/` (should be tracked)

## 6. Seed script

- [x] 6.1 Create `apps/api/prisma/seed.ts` using the adapter pattern (fresh `PrismaClient` with `PrismaPg` adapter, disconnected at end) — this file is a CLI entrypoint, not app code
- [x] 6.2 Implement idempotent upsert of three `estado` rows (`pendiente`/activa, `en-progreso`/activa, `finalizada`/cerrada) keyed on `nombre` (requires `@unique` on `Estado.nombre` in the schema)
- [x] 6.3 Register the seed command in `apps/api/prisma.config.ts` under `migrations.seed: 'tsx prisma/seed.ts'` (Prisma 7 dropped the `package.json` `prisma` block)
- [x] 6.4 Run `pnpm --filter @employeek/api exec prisma db seed` — must succeed and insert 3 rows; run it a second time — must succeed with no new rows inserted

## 7. Singleton `PrismaClient`

- [x] 7.1 Create `apps/api/src/db/client.ts` exporting a `prisma` singleton using the `globalThis.__prisma` caching pattern + `PrismaPg` adapter (Prisma 7's documented dev-reload recipe with driver adapters)
- [x] 7.2 Update `apps/api/src/index.ts` to import `prisma` from `./db/client.js`, call `await prisma.estado.count()`, log the count alongside the existing skeleton message, and `await prisma.$disconnect()` before exit (so the script terminates cleanly)
- [x] 7.3 Run `pnpm --filter @employeek/api exec tsx src/index.ts` — output should print the skeleton message plus `estado count: 3`

## 8. Root scripts

- [x] 8.1 Add to root `package.json`: `"db:migrate": "pnpm --filter @employeek/api exec prisma migrate dev"`
- [x] 8.2 Add `"db:migrate:deploy": "pnpm --filter @employeek/api exec prisma migrate deploy"`
- [x] 8.3 Add `"db:generate": "pnpm --filter @employeek/api exec prisma generate"`
- [x] 8.4 Add `"db:seed": "pnpm --filter @employeek/api exec prisma db seed"`
- [x] 8.5 Add `"db:studio": "pnpm --filter @employeek/api exec prisma studio"`
- [x] 8.6 Run `pnpm db:generate`, `pnpm db:migrate:deploy`, `pnpm db:seed` in sequence against a fresh `pnpm db:reset` — all must succeed end-to-end from the repo root

## 9. Turbo wiring

- [x] 9.1 Add a `db:generate` task to `turbo.json` with `cache: true`, `inputs: ["prisma/schema.prisma"]`, `outputs` covering the generated client directories (both `node_modules/.prisma/**` in the workspace and the pnpm virtual store). Also add a `db:generate` script to `apps/api/package.json` so Turbo can invoke it.
- [x] 9.2 Add `"db:generate"` to the `dependsOn` of the `build`, `typecheck`, and `test` tasks (keep existing `^build` entries)
- [x] 9.3 Run `pnpm typecheck` twice — first run executes `db:generate`, second run reports `FULL TURBO` in under 100ms

## 10. `.gitignore` and repo hygiene

- [x] 10.1 Confirm `apps/api/node_modules/.prisma/` is ignored (covered by top-level `node_modules/`; no explicit comment needed)
- [x] 10.2 Confirm `apps/api/prisma/migrations/` and `apps/api/prisma/schema.prisma` are tracked — verified via `git status`
- [x] 10.3 Ensure no `.env.local` or `apps/api/.env` was created — only the repo-root `.env` (gitignored) and `.env.example` (tracked) exist

## 11. Documentation

- [x] 11.1 Add a "Schema & migrations" subsection to `CLAUDE.md`'s "Local database" area (≤ 25 lines) covering: schema location, `pnpm db:migrate` workflow, seed script behaviour, `db:reset` + re-run sequence, and the singleton client rule
- [x] 11.2 Update the root-scripts table in `CLAUDE.md` to include the five new `db:*` commands

## 12. Smoke test — golden path

- [x] 12.1 `pnpm db:reset` — wipe volume
- [x] 12.2 `pnpm db:migrate:deploy` — apply the init migration; confirm `prisma migrate status` says "up to date"
- [x] 12.3 `pnpm db:seed` — insert the three `estado` rows
- [x] 12.4 `docker compose ... psql ... -c "\dt"` — lists `empleado`, `estado`, `tareas`, `_prisma_migrations`
- [x] 12.5 `docker compose ... psql ... -c "SELECT nombre FROM estado ORDER BY id"` — returns `pendiente`, `en-progreso`, `finalizada`
- [x] 12.6 `pnpm --filter @employeek/api exec tsx src/index.ts` — prints `estado count: 3` (used one-shot tsx instead of `dev`/`tsx watch` so the script exits cleanly)

## 13. Smoke test — edge cases

- [x] 13.1 **FK restrict:** via psql, inserted empleado + tarea, then `DELETE FROM empleado WHERE id=1` — failed with `violates foreign key constraint "tareas_id_empleado_fkey"`, empleado and tarea remained
- [x] 13.2 **FK missing:** via psql, `INSERT INTO tareas (..., id_empleado, id_estado, ...) VALUES (..., 99999, 1, ...)` — failed with FK violation
- [x] 13.3 **Decimal precision:** via Prisma adapter, inserted `salario: '1234567.89'`, round-tripped to `'1234567.89'` with no precision loss
- [x] 13.4 **Date only:** via Prisma, inserted `fechaIngreso: new Date('2026-04-23T15:30:00Z')` and read back `2026-04-23T00:00:00.000Z` (time component stripped)
- [x] 13.5 **Seed idempotency:** `pnpm db:seed` run twice — second run exits 0 and `estado` still has exactly 3 rows (confirmed via count query)
- [ ] 13.6 **Dev reload singleton:** `pnpm --filter @employeek/api dev` is an interactive `tsx watch` loop — skipped in this automation pass. Manual verification: save `src/index.ts` 5 times and confirm `SELECT count(*) FROM pg_stat_activity WHERE usename = 'employeek'` stays at 1.

## 14. Quality gates

- [x] 14.1 `pnpm typecheck` passes (generated Prisma types resolved)
- [x] 14.2 `pnpm lint` passes (no warnings or errors)
- [x] 14.3 `pnpm format:check` passes on all modified files
- [x] 14.4 `pnpm build` passes — confirms the generated client is valid JS and tsc can resolve it
- [x] 14.5 Run `openspec validate migrate-sequelize-to-prisma --strict` — passed

## 15. Commits

- [x] 15.1 Commit Prisma install and `schema.prisma` as `feat(api): add prisma schema for empleado/estado/tareas`
- [x] 15.2 Commit `apps/api/prisma/migrations/` as `feat(api): add initial prisma migration for empleado/estado/tareas`
- [x] 15.3 Commit `apps/api/prisma/seed.ts` as `feat(api): add estado catalogue seed` (seed config moved to `prisma.config.ts`, committed with 15.1)
- [x] 15.4 Commit `apps/api/src/db/client.ts` + updated `apps/api/src/index.ts` as `feat(api): add prisma client singleton`
- [x] 15.5 Commit root `package.json` script additions and `turbo.json` changes as `feat(infra): add db migrate/generate/seed root scripts and turbo wiring`
- [x] 15.6 Commit `CLAUDE.md` update as `docs(api): document prisma schema and migration workflow`
- [x] 15.7 Commit updated `tasks.md` (this file) with boxes ticked as `chore(openspec): mark migrate-sequelize-to-prisma tasks complete`

## 16. Archive handoff

- [x] 16.1 Verify via `openspec status --change migrate-sequelize-to-prisma --json` that all 4 artifacts are `done` and `isComplete: true`
- [ ] 16.2 Run `/opsx:archive` to move the change into `openspec/changes/archive/` and sync the `db-schema-prisma` spec into `openspec/specs/` (user-triggered — separate slash command)
- [ ] 16.3 Merge branch `feat/migrate-sequelize-to-prisma` into `main` (user-authorized — shared-state action, pause per safety protocol)
