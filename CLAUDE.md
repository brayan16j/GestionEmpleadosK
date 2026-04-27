# CLAUDE.md — EmployeeK monorepo

This file is loaded automatically by Claude Code at the start of every session in this repository. It is the contract between the codebase and the AI assistant.

## What this repository is

EmployeeK is a full-stack employee/task management app being rebuilt as an enterprise-grade monorepo. The rebuild happens as a sequence of small, independent OpenSpec changes; each one is self-contained and archivable.

- Language: **TypeScript strict** across all workspaces.
- Backend: **Fastify** (`rebuild-api-fastify-ajv-errors`).
- Frontend: **React 18 + Vite** (`rebuild-web-vite-tanstack-query`).
- ORM: **Prisma** (`migrate-sequelize-to-prisma`).
- Database: **PostgreSQL** via Docker Compose (`dockerize-local-postgres`).
- Monorepo: **pnpm workspaces + Turborepo**.
- Node: **20 LTS** pinned via `.nvmrc` and `engines`.
- Package scope: `@employeek/*`.

## Repository layout

```
apps/
  api/            # backend — Fastify 5 + Prisma + AJV + RFC 7807
  web/            # frontend — Vite 5 + React 18 + TanStack Query + Tailwind
packages/
  eslint-config/  # @employeek/eslint-config — shared flat config
  tsconfig/       # @employeek/tsconfig — shared TS presets
legacy/           # QUARANTINE: original Express app, do not touch
infra/            # docker, scripts (starts empty, filled in CH2)
openspec/         # change artifacts + living specs
  changes/<name>/ # proposal / design / specs / tasks for in-flight work
  specs/          # archived, canonical specs
.claude/          # slash commands and skills for Claude Code
.husky/           # git hooks (pre-commit, commit-msg, pre-push)
```

## One-command bootstrap

```bash
pnpm install
pnpm dev         # start all apps
```

## Root scripts (always run from the repo root)

| Command                  | What it does                                                                                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`               | Turbo runs `dev` in every app (persistent, streamed)                                                                                                                        |
| `pnpm build`             | Turbo runs `build` (cached by inputs)                                                                                                                                       |
| `pnpm lint`              | ESLint on every workspace                                                                                                                                                   |
| `pnpm typecheck`         | TypeScript on every workspace                                                                                                                                               |
| `pnpm test`              | Vitest in every workspace — `@employeek/api` runs integration tests against the live DB (requires `pnpm db:up`); `@employeek/web` runs jsdom component tests (no DB needed) |
| `pnpm format`            | Prettier --write on the whole repo                                                                                                                                          |
| `pnpm format:check`      | Prettier --check (used in CI)                                                                                                                                               |
| `pnpm clean`             | Remove `dist/`, `.turbo/`, `node_modules/`                                                                                                                                  |
| `pnpm db:up`             | Start the local Postgres 16 container (detached)                                                                                                                            |
| `pnpm db:down`           | Stop the local Postgres container (volume preserved)                                                                                                                        |
| `pnpm db:logs`           | Tail Postgres logs (Ctrl+C to stop, container stays)                                                                                                                        |
| `pnpm db:reset`          | **Destructive** — wipe the DB volume and restart                                                                                                                            |
| `pnpm db:migrate`        | Create/apply a dev migration (`prisma migrate dev`)                                                                                                                         |
| `pnpm db:migrate:deploy` | Apply pending migrations (CI/prod-safe)                                                                                                                                     |
| `pnpm db:generate`       | Regenerate the Prisma Client from `schema.prisma`                                                                                                                           |
| `pnpm db:seed`           | Run the seed script (idempotent; populates `estado`)                                                                                                                        |
| `pnpm db:studio`         | Open Prisma Studio (browser-based DB explorer)                                                                                                                              |

Turbo caches all non-`dev` tasks. A second run of the same task is a cache hit and completes in under 2 seconds.

## Local database

EmployeeK uses a Dockerized local Postgres 16 managed by `infra/docker-compose.yml`. The container is the only supported local DB — do not install Postgres on the host for this project.

**Prerequisite:** Docker ≥ 24 with the v2 compose plugin (`docker compose version`).

**One-time setup:**

```bash
cp .env.example .env   # creates your local, gitignored env file
pnpm db:up             # pulls postgres:16-alpine and starts the container
```

Data persists between `db:down` and `db:up` in a named volume (`employeek_pgdata`). `db:reset` drops that volume and restarts with an empty database — use it when you need a clean slate.

If host port `5432` is already taken, set `POSTGRES_PORT=5433` in your `.env` and re-run `pnpm db:up`.

### Schema & migrations

Prisma 7 owns the schema. The source of truth is `apps/api/prisma/schema.prisma`; the datasource URL comes from `apps/api/prisma.config.ts`, which loads the repo-root `.env` via `process.loadEnvFile()`.

- **Edit the schema** at `apps/api/prisma/schema.prisma`, then run `pnpm db:migrate` — Prisma will prompt for a migration name and apply it against the local DB.
- **Seed data** is in `apps/api/prisma/seed.ts` (idempotent upsert of the `estado` catalogue). Run `pnpm db:seed` any time after a migration.
- **Fresh start:** `pnpm db:reset` drops the volume. You must re-run `pnpm db:migrate:deploy` and `pnpm db:seed` afterwards — there are no prompts, just the two commands.
- **Runtime client:** app code imports `prisma` from `apps/api/src/db/client.ts` (singleton with `PrismaPg` driver adapter). Do not import `@prisma/client` directly anywhere else — it would create duplicate connection pools on `tsx watch` reloads.

## HTTP API

The backend is a Fastify 5 app with AJV validation, Zod-generated JSON schemas, and RFC 7807 `application/problem+json` error envelopes. Route modules live in `apps/api/src/routes/`, shared JSON schemas in `apps/api/src/schemas/`, and the env contract in `apps/api/src/config/env.ts`.

**Scripts (from the repo root unless noted):**

| Command                                   | What it does                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| `pnpm --filter @employeek/api dev`        | `tsx watch src/index.ts` — hot-reload dev server on `$PORT` (default `4000`) |
| `pnpm --filter @employeek/api build`      | `tsc --build` — emit `dist/` for production                                  |
| `pnpm --filter @employeek/api test`       | `vitest run` — integration tests using `fastify.inject()` against live DB    |
| `pnpm --filter @employeek/api test:watch` | `vitest` in watch mode                                                       |
| `node apps/api/dist/server.js`            | Production start (after `build`); reads env from `.env`                      |

**Required env vars (set in `.env`):**

- `DATABASE_URL` — Postgres connection string (the Docker default works as-is).
- `PORT` — HTTP port (default `4000`).
- `HOST` — bind address (default `0.0.0.0`).
- `CORS_ORIGINS` — comma-separated allowlist (default `http://localhost:5173` for the Vite dev server).
- `LOG_LEVEL` — Pino level (`debug` / `info` / `warn` / `error`; default `info`).

**Error envelope (RFC 7807):** every 4xx/5xx response is `application/problem+json` with this shape:

```json
{
  "type": "https://employeek.local/problems/<slug>",
  "title": "Not Found",
  "status": 404,
  "detail": "The requested record does not exist",
  "instance": "/empleados/999",
  "traceId": "req-42",
  "errors": [{ "path": "body/salario", "message": "must be >= 0" }]
}
```

`errors[]` is present only on validation failures (400). `traceId` equals Fastify's `req.id` — the same id that appears in the JSON logs, so you can correlate a failing response with its log line.

**Prisma decorator rule:** routes read the client via `app.prisma`, decorated inside `buildApp()` from the singleton at `apps/api/src/db/client.ts`. Do not `import { prisma }` directly from a route module — the decorator keeps test overrides possible and avoids duplicate client instances under `tsx watch`.

**Port 4000 clash:** the legacy Express app in `legacy/` also defaults to port `4000`. They cannot run simultaneously; override `PORT` in `.env` (e.g. `PORT=4001`) if you need both up at the same time.

### OpenAPI contract

The API exposes its OpenAPI 3.1 document and Swagger UI (controlled by `OPENAPI_UI_ENABLED`, default `true`):

- **Browse docs:** `http://localhost:4000/docs` (Swagger UI)
- **Raw JSON:** `http://localhost:4000/docs/json`

The contract is versionable via `packages/api-types/`:

| Command            | What it does                                                              |
| ------------------ | ------------------------------------------------------------------------- |
| `pnpm api:openapi` | Boots the API (no DB needed) and writes `packages/api-types/openapi.json` |
| `pnpm api:types`   | Runs `api:openapi` then rebuilds TypeScript types in `packages/api-types` |

**When to run `pnpm api:types`:** any time you add or modify a route, a schema `$id`, an `operationId`, or a field in `apps/api/src/schemas/`. The API tests include a snapshot test that fails if the committed `openapi.json` is out of date.

**No-drift rule:** `apps/api/test/openapi-snapshot.test.ts` compares `app.swagger()` against `packages/api-types/openapi.json`. If they differ, `pnpm test` fails with the message `Run 'pnpm api:types' to regenerate.`

**Consuming types in `apps/web`:** every feature's `api.ts` imports from `@employeek/api-types`:

```ts
import type { Schema } from "@employeek/api-types";

export type Empleado = Schema<"Empleado">;
export const listEmpleados = () => http<Empleado[]>("GET", "/empleados");
```

Available helpers: `Schema<K>`, `RequestBody<P, M>`, `ResponseBody<P, M, S>`. Never define a plain `interface` that mirrors an API response — use `Schema<K>` instead.

## Web app

The frontend is a Vite 5 SPA (`apps/web/`) with React 18, TypeScript strict, TanStack Query v5, React Hook Form + Zod v3, Tailwind CSS v3, and shadcn/ui primitives.

**Scripts (from the repo root unless noted):**

| Command                                   | What it does                                                 |
| ----------------------------------------- | ------------------------------------------------------------ |
| `pnpm --filter @employeek/web dev`        | `vite` — hot-reload dev server on port `5173`                |
| `pnpm --filter @employeek/web build`      | `tsc && vite build` — type-check then emit `dist/`           |
| `pnpm --filter @employeek/web preview`    | `vite preview --port 5173` — serve the built `dist/` locally |
| `pnpm --filter @employeek/web test`       | `vitest run` — jsdom component tests (no DB required)        |
| `pnpm --filter @employeek/web test:watch` | `vitest` in watch mode                                       |

**Required env var (set in `.env`):**

- `VITE_API_URL` — base URL of the Fastify API (default `http://localhost:4000`). Only variables prefixed `VITE_` are exposed to the browser bundle.

**HTTP client:** every network call goes through `apps/web/src/lib/http.ts`. Do not call `fetch()` directly elsewhere — the `no-restricted-globals` ESLint rule enforces this. The helper reads `VITE_API_URL`, sets `Content-Type: application/json` when a body is present, and throws `ApiProblem` on any non-2xx response.

**Error model (RFC 7807):** `ApiProblem extends Error` lives in `src/lib/problem.ts`. It hydrates from the same `application/problem+json` envelope the API emits (type / title / status / detail / traceId / errors[]). `src/lib/applyProblemToForm.ts` maps `body/<field>` paths from `errors[]` onto React Hook Form field errors; anything unmapped falls back to a Sonner toast.

## Conventional Commits (enforced)

Commits are validated by **commitlint** via the `commit-msg` husky hook. The format is:

```
type(scope): short description

Longer body explaining why, wrapped at 100 chars.
```

Allowed types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `revert`.

Examples:

- `feat(api): add empleados GET endpoint with AJV schema`
- `fix(web): handle 404 from empleados list`
- `chore(scaffold): initialize pnpm workspace with turborepo`

Commits with non-conforming messages are **rejected**. No exceptions — use `--no-verify` only in true emergencies and open a follow-up task.

## Git hooks (enforced)

| Hook         | Runs                                                   |
| ------------ | ------------------------------------------------------ |
| `pre-commit` | `pnpm lint-staged` (ESLint + Prettier on staged files) |
| `commit-msg` | `pnpm commitlint --edit "$1"`                          |
| `pre-push`   | `pnpm typecheck`                                       |

If a hook fails, investigate the root cause — do not bypass with `--no-verify` unless you are fixing the hook itself in the next commit.

## OpenSpec workflow

All non-trivial work goes through OpenSpec. Workflow:

```
/opsx:explore  — think before building (allowed to create artifacts, not code)
/opsx:propose  — formalize a change with proposal/design/specs/tasks
/opsx:apply    — implement tasks, marking them [x] as you go
/opsx:archive  — close change, move specs to openspec/specs/
```

Each change lives in `openspec/changes/<kebab-name>/` with:

- `proposal.md` — why
- `design.md` — how (key decisions + alternatives)
- `specs/<capability>/spec.md` — what (SHALL/WHEN/THEN requirements)
- `tasks.md` — ordered implementation checklist

## Quarantined code — do not modify

Two directories are read-only reference material:

- **`legacy/`** — the original Express + Sequelize app. Not wired into `pnpm-workspace.yaml` or Turbo. Removed in `retire-legacy-express-stack` once the Fastify API reaches parity. Read for reference; never refactor in place.
- **`D:\Proyectos Konecta\FRONTK1\`** — the original React frontend (outside this repo). Serves as a reference for screens being ported to `apps/web`. Do not modify anything there.

## Stack details and gotchas

- **Node globals and DOM**: `apps/web` extends `@employeek/tsconfig/react.json` which includes DOM lib. Avoid local identifiers that shadow browser globals (`name`, `status`, `top`, `close`, `focus`, `event`). Use domain-prefixed names (`appName`, `statusCode`).
- **ESM everywhere**: root, apps, and packages are all `"type": "module"`. Use `import`/`export`, not `require`. Use `.js` in TS import paths when `module` is `NodeNext`.
- **Line endings**: `.gitattributes` enforces LF on all text files. `.husky/*` scripts MUST be LF on Windows or the hooks will fail to execute.
- **Environment variables**: never commit `.env` files. Only `.env.example` is tracked.

## When Claude is asked to do work

- For anything beyond a trivial fix, check `openspec list --json` first. If an active change covers the work, read its artifacts before touching code.
- If the work does not match any active change, propose a new one with `/opsx:propose` before implementing.
- Follow commit conventions. One commit per logical task; keep diffs scoped.
- Never touch `legacy/`.
- Never commit without explicit user consent unless the task being executed explicitly includes a commit step (as OpenSpec `tasks.md` entries do).
- If tests exist, run them locally before reporting work as done.
