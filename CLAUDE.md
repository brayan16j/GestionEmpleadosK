# CLAUDE.md — EmployeeK monorepo

This file is loaded automatically by Claude Code at the start of every session in this repository. It is the contract between the codebase and the AI assistant.

## What this repository is

EmployeeK is a full-stack employee/task management app being rebuilt as an enterprise-grade monorepo. The rebuild happens as a sequence of small, independent OpenSpec changes; each one is self-contained and archivable.

- Language: **TypeScript strict** across all workspaces.
- Backend: **Fastify** (planned in `rebuild-api-fastify-ajv-errors`).
- Frontend: **React 18 + Vite** (planned in `rebuild-web-vite-tanstack-query`).
- ORM: **Prisma** (planned in `migrate-sequelize-to-prisma`).
- Database: **PostgreSQL** via Docker Compose (planned in `dockerize-local-postgres`).
- Monorepo: **pnpm workspaces + Turborepo**.
- Node: **20 LTS** pinned via `.nvmrc` and `engines`.
- Package scope: `@employeek/*`.

## Repository layout

```
apps/
  api/            # backend — TS skeleton now, Fastify later
  web/            # frontend — TS skeleton now, Vite+React later
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

| Command             | What it does                                         |
| ------------------- | ---------------------------------------------------- |
| `pnpm dev`          | Turbo runs `dev` in every app (persistent, streamed) |
| `pnpm build`        | Turbo runs `build` (cached by inputs)                |
| `pnpm lint`         | ESLint on every workspace                            |
| `pnpm typecheck`    | TypeScript on every workspace                        |
| `pnpm test`         | Vitest in every workspace (placeholder for now)      |
| `pnpm format`       | Prettier --write on the whole repo                   |
| `pnpm format:check` | Prettier --check (used in CI)                        |
| `pnpm clean`        | Remove `dist/`, `.turbo/`, `node_modules/`           |
| `pnpm db:up`        | Start the local Postgres 16 container (detached)     |
| `pnpm db:down`      | Stop the local Postgres container (volume preserved) |
| `pnpm db:logs`      | Tail Postgres logs (Ctrl+C to stop, container stays) |
| `pnpm db:reset`     | **Destructive** — wipe the DB volume and restart     |

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

Schema and migrations are **not** managed here — those land with Prisma in the `migrate-sequelize-to-prisma` change (CH3). Right now the DB is empty by design.

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

## Legacy code is quarantined

**`legacy/` contains the original Express + Sequelize app.** Do not modify files inside it. Do not add it to `pnpm-workspace.yaml` or Turbo pipelines. It exists to prove the previous system still works; it is removed in the `retire-legacy-express-stack` change when the new API has reached parity.

If you need to reference legacy behaviour, read the files — do not refactor in place.

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
