## 1. Prerequisites

- [x] 1.1 Confirm current branch is `feat/dockerize-local-postgres` and working tree is clean
- [x] 1.2 Verify Docker is installed and v2 compose plugin is available: `docker --version` (≥ 24) and `docker compose version` (v2.x)
- [x] 1.3 Read `openspec/changes/dockerize-local-postgres/proposal.md`, `design.md`, and `specs/db-local-postgres/spec.md` end-to-end before writing code

## 2. Compose file

- [x] 2.1 Create `infra/` directory at the repo root (if it does not already exist)
- [x] 2.2 Create `infra/docker-compose.yml` with a single `postgres` service using image `postgres:16-alpine`, port mapping `"${POSTGRES_PORT:-5432}:5432"`, `env_file: ../.env`, named volume `employeek_pgdata` mounted at `/var/lib/postgresql/data`, and a `pg_isready` healthcheck (5s interval, 5s timeout, 10 retries, 10s start_period)
- [x] 2.3 Declare the top-level `volumes: employeek_pgdata:` block so Docker manages the volume
- [x] 2.4 Lint the compose file: `docker compose -f infra/docker-compose.yml config` must succeed with no warnings

## 3. Environment template

- [x] 3.1 Create `.env.example` at the repo root documenting `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, and `DATABASE_URL`, each with a safe placeholder and a brief inline comment
- [x] 3.2 Ensure `DATABASE_URL` placeholder is of the form `postgresql://<user>:<password>@localhost:<port>/<db>?schema=public` and matches the other placeholders
- [x] 3.3 Verify `.env` (and variants like `.env.local`) is already covered by `.gitignore`; if not, add the pattern and commit that change first
- [x] 3.4 Do NOT commit a real `.env` — only `.env.example` is tracked

## 4. Root scripts

- [x] 4.1 Add `db:up`, `db:down`, `db:logs`, `db:reset` scripts to the root `package.json`, each invoking `docker compose -f infra/docker-compose.yml ...`
- [x] 4.2 Chain `db:reset` with `&&` so the restart only runs if `down -v` succeeded
- [x] 4.3 Run `pnpm install` if needed so the new scripts are reachable via `pnpm db:<x>`

## 5. Documentation

- [x] 5.1 Add a "Local database" section to `CLAUDE.md` covering: Docker ≥ 24 prerequisite, one-time `cp .env.example .env` setup, the four `db:*` scripts, the destructive nature of `db:reset`, and a note that schema management moves to Prisma in CH3
- [x] 5.2 Keep the wording short (≤ 20 lines); link to `infra/docker-compose.yml` for the source of truth

## 6. Smoke test — golden path

- [x] 6.1 Create a local `.env` from `.env.example` (not tracked)
- [x] 6.2 Run `pnpm db:up` and confirm the container starts: `docker compose -f infra/docker-compose.yml ps` shows the service `healthy` within 30s
- [x] 6.3 Connect with `docker compose -f infra/docker-compose.yml exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT version();"` and see the Postgres 16 version string
- [x] 6.4 Run `pnpm db:down` and confirm the container is removed but `docker volume ls` still shows `employeek_pgdata`

## 7. Smoke test — edge cases

- [x] 7.1 **Data persistence:** start the DB, create a throwaway table (`CREATE TABLE _ping (id int);` via psql), run `pnpm db:down` then `pnpm db:up`, verify the table still exists
- [x] 7.2 **Port override:** set `POSTGRES_PORT=5433` in `.env`, run `pnpm db:up`, confirm the container binds to 5433 on the host (`docker compose ps` or `netstat`)
- [x] 7.3 **Reset wipes data:** with the `_ping` table still present from 7.1, run `pnpm db:reset`, reconnect, confirm the table is gone and the volume was recreated
- [x] 7.4 **Logs stream:** run `pnpm db:logs` in a second terminal while the service is up, confirm log lines appear and Ctrl+C does not stop the service

## 8. Quality gates

- [x] 8.1 `pnpm typecheck` passes (no new TS files added, but confirm nothing broke)
- [x] 8.2 `pnpm lint` passes (checks `package.json` indirectly via Prettier if staged)
- [x] 8.3 `pnpm format:check` passes on all modified files (`package.json`, `.env.example`, `CLAUDE.md`, `infra/docker-compose.yml`)
- [x] 8.4 Run `openspec validate dockerize-local-postgres --strict` — must pass

## 9. Commits

- [x] 9.1 Commit `infra/docker-compose.yml` as `feat(infra): add local postgres 16 compose service`
- [x] 9.2 Commit `.env.example` + any `.gitignore` tweak as `chore(infra): document env variables and ignore real .env`
- [x] 9.3 Commit root `package.json` script additions as `feat(infra): add db:up/down/logs/reset root scripts`
- [x] 9.4 Commit `CLAUDE.md` update as `docs(infra): document local database workflow`
- [x] 9.5 Commit an updated `tasks.md` (this file) with the boxes ticked as `chore(openspec): mark dockerize-local-postgres tasks complete`

## 10. Archive handoff

- [x] 10.1 Verify via `openspec status --change dockerize-local-postgres --json` that all 4 artifacts are `done` and `isComplete: true`
- [x] 10.2 Run `/opsx:archive` to move the change into `openspec/changes/archive/` and sync the `db-local-postgres` spec into `openspec/specs/` (user-triggered — separate slash command)
- [x] 10.3 Merge branch `feat/dockerize-local-postgres` into `main` (user-authorized — shared-state action, pause per safety protocol)
