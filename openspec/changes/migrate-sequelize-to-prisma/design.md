## Context

CH1 gave us a TS-strict pnpm+Turbo monorepo; CH2 gave us a one-command Dockerized Postgres 16 with a working `DATABASE_URL` in `.env`. The backend workspace (`apps/api`) still only has a `console.log` skeleton and no DB connectivity.

The legacy `legacy/src/modelos/` tree defines three Sequelize models (`empleado`, `estado`, `tareas`) against a DB literally named `actividad1k` with hardcoded creds in `legacy/src/database/database.js`. That DB is **not** the source of truth we migrate from — the refoundation plan (ADR-0 decision 8) states "el esquema se recrea con Prisma migrations (no hay dump previo que preservar)". We are recreating the shape, not the bytes.

Stakeholders on this change:

- **CH4 (`rebuild-api-fastify-ajv-errors`)** depends on a stable `PrismaClient` singleton and typed model shapes to write route handlers.
- **CH6 (`openapi-contract-and-typed-client`)** will derive OpenAPI schemas from the same Prisma models (directly or via a Zod bridge).
- **CH7 (CI)** needs `prisma migrate deploy` to be runnable from the monorepo root in a Docker-less environment (GitHub Actions uses a service container).
- **CH8 (`retire-legacy-express-stack`)** deletes the Sequelize models once parity is verified in CH4.

Windows is the primary developer OS (Brayan + Konecta laptops). Any tool we pick must work under PowerShell/Git Bash without shell hacks.

## Goals / Non-Goals

**Goals:**

- One initial migration (`<timestamp>_init`, Prisma's default naming) that creates `empleado`, `estado`, `tareas` with the same columns and FKs the legacy app relied on, plus the typed improvements (`Decimal`, `Date`) noted in the proposal.
- `PrismaClient` is importable from `apps/api/src/db/client.ts` as a singleton; no one imports `@prisma/client` directly in app code (enforced by lint rule in a later change, documented here).
- `pnpm db:migrate` (inside `apps/api` and via root script) creates migrations against the running Docker Postgres with zero manual env plumbing — reads `DATABASE_URL` from repo-root `.env`.
- `pnpm db:seed` populates a minimal `estado` catalogue so CH4 can build tareas endpoints against non-empty reference data from day 1.
- Turbo regenerates `@prisma/client` automatically when `schema.prisma` changes, and caches the output so `pnpm typecheck` on unchanged schemas does not re-run generation.
- The workflow is documented in `CLAUDE.md` in ≤ 30 lines so a new contributor can edit the schema, create a migration, and seed the DB without asking.

**Non-Goals:**

- No HTTP server, no routes, no controllers — all CH4.
- No request validation, no DTO layer, no Zod integration with Prisma — all CH4.
- No production deployment story. `migrate deploy` is wired for future CI use but not exercised here.
- No data backfill from the legacy `actividad1k` DB. Per ADR-0, we start empty.
- No shared `@employeek/db` package. The client lives inside `apps/api` until we have a second consumer (unlikely before CH6).
- No row-level security, no multi-tenancy, no soft deletes. The legacy app had none of those.

## Decisions

### Prisma 7 (not Drizzle, not TypeORM, not keep-Sequelize)

Pick `prisma@^7` + `@prisma/client@^7`. This is already locked by ADR-0 decision 2, but we document the rationale here so future reviewers see the tradeoffs.

**Rationale:**

- **Migration ergonomics beat everything else on this project.** `prisma migrate dev` produces a reviewable `migration.sql` file per change, diff-friendly, zero glue code. Drizzle's `drizzle-kit generate` is close but still maturing around squash/rename flows. TypeORM's CLI is historically unreliable on Windows.
- **Generated client is fully typed from the schema**, including relations — no decorators, no code generation we have to maintain. Model shapes flow straight into Fastify handlers in CH4 without a mapping layer.
- **Prisma 7.x fully supports Postgres 16** (CH2's image) and `node:20` (pinned in `engines`).
- The team is new to TypeScript ORMs; Prisma has the shallowest learning curve and the best error messages.

**Alternatives considered:**

- **Drizzle** — rejected for CH3 because its migration workflow still requires hand-written post-processing for column renames, and we want a zero-ceremony baseline. Revisit later if query-builder flexibility becomes a pain point.
- **TypeORM** — rejected: decorators violate our no-experimental-decorators stance, and Windows CLI reliability is historically poor.
- **Keep Sequelize** — rejected by ADR-0; also: no TS types worth the name, hand-written migrations, and the legacy code already has a SQL injection via `sequelize.literal` in `tareasController.js:203`.

### Schema lives at `apps/api/prisma/schema.prisma`

Not at the repo root, not in a `packages/db` workspace.

**Rationale:**

- Prisma's CLI defaults assume `prisma/schema.prisma` relative to the working directory; keeping it inside `apps/api` means `cd apps/api && pnpm prisma …` Just Works for anyone who reads the Prisma docs.
- `apps/api` is the only consumer in this change. A shared `packages/db` introduces workspace boundaries (peer-dep hell between `@prisma/client` versions across packages) that we do not need yet.
- When CH6 needs schema-derived types elsewhere, we extract — YAGNI until then.

**Trade-off:** the root `pnpm db:*` scripts have to `cd` into `apps/api` (or use `pnpm --filter`) to invoke Prisma. We accept the indirection because it keeps the schema owned by its only consumer.

### Snake-case column names, camelCase TS fields

Prisma models use camelCase (idiomatic TS), DB columns use snake_case (idiomatic SQL) via `@map` and `@@map`:

```prisma
model Empleado {
  id           Int      @id @default(autoincrement())
  nombre       String
  fechaIngreso DateTime @map("fecha_ingreso") @db.Date
  salario      Decimal  @db.Decimal(12, 2)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt        @map("updated_at")
  tareas       Tarea[]
  @@map("empleado")
}
```

**Rationale:**

- Legacy Sequelize auto-camelCased DB columns on read, which is a source of subtle bugs when you hit the DB with `psql` (`SELECT "fechaIngreso" …` vs `SELECT fecha_ingreso …`). Snake_case in the DB is the standard Postgres convention and survives quoting.
- CH4 handlers and CH6 OpenAPI schemas will expose camelCase JSON — keeping the TS type camelCase means no remapping in the handler.
- `@@map("empleado")` (singular lowercase) matches the legacy table names exactly, so anyone pointing a DB GUI at the new DB sees the same table names they know from the old one.

**Trade-off:** dual naming is one extra line per column. That cost pays back the first time a dev reads an explain plan.

### Decimal for money, Date (date-only) for fechas, DateTime for audit timestamps

- `salario Decimal @db.Decimal(12, 2)` — legacy used `FLOAT`, which is wrong for money (precision loss at scale). `Decimal(12,2)` covers up to 999,999,999.99 — more than any realistic salary.
- `fechaIngreso`, `fechaCreacion`, `fechaInicioTarea`, `fechaFinalizacion` → `DateTime @db.Date`. Legacy stored `DATE` but Sequelize's JS getter did `new Date(...).toISOString().substring(0,10)` to strip the time component, which is a smell. `@db.Date` makes "no time component" enforced at the DB level.
- `createdAt`, `updatedAt` on `Empleado` → `DateTime` (timestamp with timezone is Prisma's default on Postgres). These are audit fields, not business dates.

**Rationale:** match the legacy behaviour as users see it, but fix the type choices so CH4 does not inherit the `FLOAT` salary bug.

### Foreign keys with `onDelete: Restrict`

`Tarea.empleado` → `Empleado` and `Tarea.estado` → `Estado` both use `onDelete: Restrict`.

**Rationale:**

- Legacy Sequelize default is `NO ACTION` (same semantics as `RESTRICT` in Postgres), so behaviour is preserved.
- Explicit `Restrict` makes the intent visible in the schema: "do not let me orphan tareas by deleting an empleado".
- `Cascade` would be surprising — nobody expects deleting an empleado to wipe their task history. If we later want soft-delete semantics, we introduce them deliberately.

### Single `@default(now())` + `@updatedAt` on `Empleado` only

Only `Empleado` gets `createdAt`/`updatedAt` because that is the only legacy model with `timestamps: true`. `Estado` and `Tarea` are timestamp-free — matching the legacy shape exactly so CH8 can retire the Sequelize models without surprises.

**Rationale:** we recreate the contract, not improve it speculatively. If audit columns are later wanted on `Tarea`, that is its own change with a named migration.

### `prisma/seed.ts` for the `estado` catalogue, run via `prisma db seed`

Seed data: three rows in `estado` (pendiente / en-progreso / finalizada), matching the controller hints in `legacy/src/controllers/estadoController.js`.

```ts
// prisma/seed.ts (sketch)
const prisma = new PrismaClient();
await prisma.estado.createMany({
  data: [
    { nombre: 'pendiente',    categoria: 'activa',    cambiosPermitidos: 'en-progreso,finalizada' },
    { nombre: 'en-progreso',  categoria: 'activa',    cambiosPermitidos: 'finalizada' },
    { nombre: 'finalizada',   categoria: 'cerrada',   cambiosPermitidos: null },
  ],
  skipDuplicates: true,
});
```

Wired via the `prisma` block in `apps/api/package.json`:

```json
"prisma": { "seed": "tsx prisma/seed.ts" }
```

**Rationale:**

- `estado` is reference data, not user data — CH4 will assume it exists. Shipping the seed alongside the migration means `pnpm db:reset && pnpm db:migrate && pnpm db:seed` is a complete happy path.
- `skipDuplicates: true` keeps the seed idempotent so developers can re-run it without errors.
- Use `tsx` (already pulled by `apps/api` for `dev`) to run the seed without a build step.

**Alternative:** inline the seed as a plain SQL file in the migration. Rejected — we lose type safety on the enum-like `categoria` field and future seed additions become harder to review.

### `PrismaClient` singleton at `apps/api/src/db/client.ts`

```ts
// apps/api/src/db/client.ts
import path from 'node:path';
import process from 'node:process';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

process.loadEnvFile(path.resolve(import.meta.dirname, '..', '..', '..', '..', '.env'));

declare global { var __prisma: PrismaClient | undefined; }

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
export const prisma = globalThis.__prisma ?? new PrismaClient({ adapter });
if (process.env.NODE_ENV !== 'production') globalThis.__prisma = prisma;
```

**Rationale:**

- Canonical Prisma 7 recipe: driver adapter + `globalThis` cache. The adapter supplies the DATABASE_URL at runtime (schema.prisma no longer does); the global cache prevents connection-pool exhaustion when `tsx watch` reloads the module in dev.
- One import path (`src/db/client.ts`) makes it trivial to mock in CH4 tests.
- `process.loadEnvFile()` is called inside the client module so any consumer that imports `prisma` gets the env loaded even if the caller did not load it (e.g. a test runner).

**Trade-off:** the `globalThis` augmentation is mildly ugly. We accept it because the Prisma docs endorse this pattern and every TS+Prisma codebase does it this way.

### Turbo: `db:generate` is an input-aware task, `build` and `typecheck` depend on it

Add to `turbo.json`:

```jsonc
"tasks": {
  "db:generate": {
    "cache": true,
    "inputs": ["prisma/schema.prisma"],
    "outputs": ["node_modules/.prisma/**", "node_modules/@prisma/client/**"]
  },
  "build":     { "dependsOn": ["^build", "db:generate"] },
  "typecheck": { "dependsOn": ["^typecheck", "db:generate"] }
}
```

**Rationale:**

- Without this, CI and cold clones hit `Cannot find module '@prisma/client'` because the client is generated on `postinstall`, and Turbo's cache can stale-hit. Making `db:generate` explicit and input-scoped to `schema.prisma` fixes both.
- Caching it saves ~4s on every `typecheck` run where the schema is unchanged.

**Alternative:** rely on Prisma's `postinstall` hook (`"postinstall": "prisma generate"`). We keep that as a safety net but do not rely on it — Turbo's task graph is the source of truth.

### Root scripts proxy into `apps/api`

```json
"db:migrate":        "pnpm --filter @employeek/api exec prisma migrate dev",
"db:migrate:deploy": "pnpm --filter @employeek/api exec prisma migrate deploy",
"db:generate":       "pnpm --filter @employeek/api exec prisma generate",
"db:seed":           "pnpm --filter @employeek/api exec prisma db seed",
"db:studio":         "pnpm --filter @employeek/api exec prisma studio"
```

**Rationale:**

- Mirrors the CH2 pattern: all DB lifecycle commands run from the repo root. The developer never has to remember which workspace owns Prisma.
- `pnpm --filter … exec` runs the command with the workspace as cwd, so Prisma finds `prisma/schema.prisma` without a `--schema` flag.
- `migrate:deploy` is intentionally namespaced (not `db:deploy`) so nobody confuses it with a full app deploy.

### `prisma.config.ts` loads the repo-root `.env` explicitly

Prisma 7 removed the `url = env("DATABASE_URL")` syntax from `schema.prisma`; datasource URLs now live in `apps/api/prisma.config.ts` (required for migrations) and are passed into the runtime client via a driver adapter. The config file explicitly loads `.env` from the repo root:

```ts
// apps/api/prisma.config.ts
process.loadEnvFile(path.resolve(import.meta.dirname, '..', '..', '.env'));

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: { url: process.env.DATABASE_URL! },
  migrations: { seed: 'tsx prisma/seed.ts' },
});
```

**Rationale:**

- Prisma 7 no longer walks up from `cwd` to find `.env` — it requires an explicit hand-off inside `prisma.config.ts`. Using Node 20's built-in `process.loadEnvFile()` avoids pulling in `dotenv` as another dep.
- Single source of truth is preserved: the repo-root `.env` from CH2 stays canonical, no duplicate in `apps/api/`.
- The `seed` command also lives in `prisma.config.ts` (Prisma 7 moved it out of `package.json`'s `prisma` block), keeping all Prisma lifecycle config in one place.

**Trade-off:** the hard-coded relative path `../../.env` couples `prisma.config.ts` to the current monorepo layout. If `apps/api/` ever moves, this path needs updating. We accept the coupling because the path is short, visible, and produces a clear error if `.env` is missing.

### Runtime client uses `@prisma/adapter-pg`

Since Prisma 7 decouples the schema from the connection URL, the runtime `PrismaClient` needs an explicit way to reach Postgres. We use `@prisma/adapter-pg` (the Node-Postgres driver adapter):

```ts
// apps/api/src/db/client.ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
export const prisma = globalThis.__prisma ?? new PrismaClient({ adapter });
```

**Rationale:**

- Driver adapters are Prisma's documented forward-compatible path for runtime connections (introduced in 5.x, required in 7.x).
- `@prisma/adapter-pg` wraps the well-understood `pg` package, keeping the connection stack boring.
- Using the adapter means the CI/prod deploy story (CH7) can swap in a different adapter without touching app code — e.g. Neon's `@prisma/adapter-neon` for serverless Postgres.

**Alternative:** `PrismaClient({ datasourceUrl: process.env.DATABASE_URL })` — works but is the legacy path; the Prisma 7 release notes mark it as deprecated in favour of adapters.

## Risks / Trade-offs

- **[`prisma generate` fails on Windows long paths]** → Mitigation: the monorepo already enables long paths (husky hooks, ESLint flat config require it). If a contributor hits `ENOENT` on a deeply nested path, `git config --system core.longpaths true` is the fix, documented in `CLAUDE.md`.
- **[Migration written against local DB disagrees with CI Postgres]** → Mitigation: pin Postgres 16 everywhere (CH2 compose + CH7 service container image). Prisma uses the running DB as the shadow DB for `migrate dev`, so what you reviewed locally is what runs in CI.
- **[Generated client accidentally committed]** → Mitigation: `.gitignore` covers `apps/api/node_modules/.prisma/` (inside `node_modules/` which is already ignored, but we call it out explicitly). `prisma generate` writes only to `node_modules/.prisma/` — never into `src/` — so the "accidentally commit generated code" failure mode is impossible in practice.
- **[Seed script grows into uncontrolled fixture data]** → Mitigation: the seed is scoped to reference data (`estado` catalogue). Any future test fixtures go in a separate CH4 test-setup, not in `prisma/seed.ts`.
- **[`Decimal` serialization surprises in JSON]** → Mitigation: Prisma returns `Decimal` as `Decimal.js` instances, not numbers. CH4 will handle JSON serialization when Fastify lands; we flag it here so the first handler author does not waste an hour on `[object Object]`. Not CH3's problem to solve — but CH3's problem to warn about.
- **[Legacy DB `actividad1k` still referenced by `legacy/src/database/database.js`]** → Mitigation: out of scope. Legacy stack is quarantined and keeps its own DB wiring until CH8. No shared state.

## Migration Plan

There is no data migration — we start from an empty Postgres volume.

**Roll-forward (one-time, per developer):**

1. `pnpm install` (pulls `prisma` + `@prisma/client`, runs `postinstall` = `prisma generate`).
2. `pnpm db:up` (CH2 gives you a running Postgres).
3. `pnpm db:migrate` (creates `empleado`, `estado`, `tareas` + `_prisma_migrations` bookkeeping table).
4. `pnpm db:seed` (inserts 3 rows in `estado`).

**Rollback:** `pnpm db:reset` wipes the volume; re-run the four steps above. We do not support partial rollback in CH3 because there are no downstream consumers yet (CH4 does not exist).

**CI path (future, wired but not exercised here):** `pnpm install --frozen-lockfile && pnpm db:migrate:deploy`. No `migrate dev`, no shadow DB.

## Open Questions

None. All decisions above are implementation-ready. If CH4 discovers that the `Decimal` or snake-case choice is painful, that is a delta spec on this capability, not an open question blocking CH3.
