## 1. Prerequisites

- [x] 1.1 Create and switch to branch `feat/rebuild-api-fastify-ajv-errors` (working tree must be clean)
- [x] 1.2 Verify the stack from CH1–CH3 is healthy: `pnpm install`, `pnpm db:up`, `pnpm db:migrate:deploy`, `pnpm db:seed`
- [x] 1.3 Read `openspec/changes/rebuild-api-fastify-ajv-errors/{proposal,design}.md` and `specs/api-rest/spec.md` end-to-end before writing code
- [x] 1.4 Skim `legacy/src/{routes,controllers,validators,helpers,dto}/` to refresh memory on the 18-endpoint surface we are porting

## 2. Install dependencies

- [x] 2.1 Add Fastify runtime deps to `apps/api`: `pnpm --filter @employeek/api add fastify @fastify/env @fastify/cors @fastify/sensible zod` (Zod 4 ships `z.toJSONSchema()` natively; the `zod-to-json-schema` bridge was removed after install)
- [x] 2.2 Add Fastify dev deps: `pnpm --filter @employeek/api add -D vitest @vitest/coverage-v8 pino-pretty`
- [x] 2.3 Verified actual majors: `fastify@^5.8`, `@fastify/env@^6`, `@fastify/cors@^11`, `@fastify/sensible@^6`, `zod@^4`, `vitest@^4`, `pino-pretty@^13` — all newer than the proposal's initial guesses; proposal updated to reflect reality
- [x] 2.4 Run `pnpm install` at the repo root — lockfile refreshed and `postinstall` regenerated Prisma Client

## 3. Environment config (`src/config/env.ts`)

- [x] 3.1 Create `apps/api/src/config/env.ts` exporting `envZ` (Zod schema) with fields `NODE_ENV`, `DATABASE_URL`, `PORT`, `HOST`, `CORS_ORIGINS`, `LOG_LEVEL` and the defaults listed in the proposal
- [x] 3.2 Export `envJsonSchema` using `z.toJSONSchema(envZ)` so `@fastify/env` can consume it at runtime
- [x] 3.3 Export the `Env = z.infer<typeof envZ>` type and augment Fastify's module declaration in `src/types/fastify.d.ts` so `app.config` and `app.prisma` are typed
- [x] 3.4 Add `.env.example` entries for `PORT=4000`, `HOST=0.0.0.0`, `CORS_ORIGINS=http://localhost:5173`, `LOG_LEVEL=info`, each with a one-line comment — existing `POSTGRES_*`/`DATABASE_URL` entries untouched
- [x] 3.5 Copy the new lines into the local `.env` so the running Docker DB and the new API agree

## 4. Error handling (`src/errors/problem.ts`)

- [x] 4.1 Create `apps/api/src/errors/problem.ts` with `Problem` type and a `mapError(err, req)` helper that returns the RFC 7807 envelope `{ type, title, status, detail, instance, traceId, errors? }`
- [x] 4.2 Implement the central `problemErrorHandler` (consumed by `app.setErrorHandler`):
  - Fastify validation errors (`err.validation`) → `400 Validation failed` with `errors[]` from AJV
  - `httpErrors.*` (statusCode-bearing) → pass through, 5xx sanitized to generic detail
  - Prisma known errors: `P2025` → `404`, `P2002` → `409 Conflict`, `P2003` → `422 Unprocessable Entity`
  - Anything else → `500` with generic detail `An unexpected error occurred`, full error logged at `error` level
- [x] 4.3 `problemErrorHandler` sets `reply.type('application/problem+json')` on every response
- [x] 4.4 `traceId` taken from `req.id` (Fastify-generated) so log and response correlate; `req.log.warn`/`req.log.error` use the same reqId

## 5. App factory (`src/app.ts`) and server bootstrap (`src/server.ts`)

- [x] 5.1 Create `apps/api/src/app.ts` exporting `async function buildApp(opts?: BuildAppOptions): Promise<FastifyInstance>`
- [x] 5.2 Inside `buildApp`: register `@fastify/env` with `{ schema: envJsonSchema, dotenv: false, confKey: 'config' }`, then `@fastify/sensible`, then `@fastify/cors` reading `app.config.CORS_ORIGINS.split(',')`
- [x] 5.3 Decorate `app.prisma = prisma` (singleton from `src/db/client.ts`); typings in `src/types/fastify.d.ts` augment the `FastifyInstance` interface for both `config` and `prisma`
- [x] 5.4 Call `app.setErrorHandler(problemErrorHandler)` before registering routes
- [x] 5.5 Register the three resource route modules (`empleados`, `estados`, `tareas`) with their prefixes, plus the `/health` and `/health/ready` routes
- [x] 5.6 Install an `onRoute` hook that throws if any registered route lacks a `response[2xx]` entry (skips HEAD/OPTIONS auto-routes) — dev/CI guardrail
- [x] 5.7 Create `apps/api/src/server.ts` that calls `buildApp()` then `app.listen({ port: app.config.PORT, host: app.config.HOST })` and handles `SIGINT`/`SIGTERM` for graceful shutdown
- [x] 5.8 Update `apps/api/src/index.ts` to be `import './server.js';` so `tsx watch src/index.ts` boots the full app
- [x] 5.9 Confirm `apps/api/package.json`'s `dev` script (`tsx watch src/index.ts`) still boots the server

## 6. Schemas (`src/schemas/*.ts`)

- [x] 6.1 Create `apps/api/src/schemas/problem.ts` with a shared `problemSchema` AJV/JSON schema matching the RFC 7807 shape
- [x] 6.2 Create `apps/api/src/schemas/empleado.ts`: `empleadoSchema`, `createEmpleadoBodySchema`, `updateEmpleadoBodySchema`, `empleadoIdParamsSchema` + matching TS types
- [x] 6.3 Create `apps/api/src/schemas/estado.ts`: `estadoSchema`, `createEstadoBodySchema`, `updateEstadoBodySchema`, `estadoIdParamsSchema` + matching TS types
- [x] 6.4 Create `apps/api/src/schemas/tarea.ts`: `tareaSchema` (with `empleadoNombre`/`estadoNombre`), `createTareaBodySchema`, `updateTareaBodySchema`, `cambiarEstadoBodySchema`, `tareaIdParamsSchema`, `categoriaParamsSchema` + matching TS types
- [x] 6.5 Create `apps/api/src/schemas/health.ts` with `{ status: string }` response schema

## 7. Routes — Empleados (`src/routes/empleados.ts`)

- [x] 7.1 `GET /empleados` with `response[200] = { type: 'array', items: empleadoSchema }`
- [x] 7.2 `GET /empleados/:id` — `404` via `httpErrors.notFound()` when `findUnique` returns null
- [x] 7.3 `POST /empleados` — `201`, body `createEmpleadoBodySchema`, date string parsed with `new Date()` before Prisma insert
- [x] 7.4 `PUT /empleados/:id` — same body shape as POST, `200`, `404` when record absent (via Prisma `P2025`)
- [x] 7.5 `DELETE /empleados/:id` — `204`, `404` when absent; FK-restrict handled as `422` by the central error handler
- [x] 7.6 `GET /empleados/:id/tareas` — returns `[]` for existing empleado with no tareas, `404` for an unknown empleado

## 8. Routes — Estados (`src/routes/estados.ts`)

- [x] 8.1 `GET /estados` with response array schema
- [x] 8.2 `GET /estados/:id` — `404` if absent
- [x] 8.3 `POST /estados` — body `{ nombre, categoria, cambiosPermitidos? }`, `409` via central handler on unique violation of `nombre`
- [x] 8.4 `PUT /estados/:id` — same body shape, `200`, `404` if absent, `409` on rename clash
- [x] 8.5 `DELETE /estados/:id` — `204`, `404` if absent, `422` via central handler if referenced by a tarea

## 9. Routes — Tareas (`src/routes/tareas.ts`)

- [x] 9.1 `GET /tareas` — `include` empleado + estado selects; flatten into `empleadoNombre` / `estadoNombre`
- [x] 9.2 `GET /tareas/:id` — `404` if absent
- [x] 9.3 `GET /tareas/categoria/:categoria` — parameterized `where: { estado: { categoria } }` (Prisma-safe), returns empty array when no matches
- [x] 9.4 `POST /tareas` — resolve `estadoNombre` (default `'pendiente'`) via `findUnique({ where: { nombre } })`; `404` if unknown
- [x] 9.5 `PUT /tareas/:id` — update non-estado fields only
- [x] 9.6 `PUT /tareas/:id/estado` — validate transition via `currentEstado.cambiosPermitidos` CSV; `400` on disallowed moves (including terminal `null` case)
- [x] 9.7 `DELETE /tareas/:id` — `204`, `404` if absent

## 10. Routes — Health (`src/routes/health.ts`)

- [x] 10.1 `GET /health` — `200 { status: 'ok' }`, no DB touch
- [x] 10.2 `GET /health/ready` — `SELECT 1` via `app.prisma.$queryRaw`; `200` on success, `503` via problem envelope on failure

## 11. Vitest setup and integration tests

- [x] 11.1 Create `apps/api/vitest.config.ts` with `pool: 'forks'`, `poolOptions.forks.singleFork: true`, `include: ['test/**/*.test.ts']`, `globals: true`, and a `globalSetup` pointing at `test/setup/global.ts`
- [x] 11.2 Create `apps/api/test/setup/global.ts` that runs `execSync('pnpm --filter @employeek/api exec prisma migrate deploy')` and `pnpm --filter @employeek/api exec prisma db seed` once per run
- [x] 11.3 Create `apps/api/test/helpers/app.ts` exporting `createTestApp()` (wraps `buildApp({ logger: false })`) and `resetDb(app)` (truncates `tarea` then `empleado`)
- [x] 11.4 Write `test/empleados.test.ts` covering all 6 endpoints with at least one success + one error path each (include 422 FK-restrict on DELETE)
- [x] 11.5 Write `test/estados.test.ts` covering all 5 endpoints including the 409 on duplicate `nombre` and 422 on delete-while-referenced
- [x] 11.6 Write `test/tareas.test.ts` covering all 7 endpoints, specifically: default-`pendiente` on POST, categoria filter with the SQL-injection-safe payload `' OR 1=1 --`, valid transition (pendiente→en-progreso), invalid transition (finalizada→pendiente)
- [x] 11.7 Write `test/health.test.ts` covering `/health` and `/health/ready` (ready with DB up; leave the "DB down" scenario as a commented TODO — exercising it kills the worker)
- [x] 11.8 Write `test/error-handler.test.ts` asserting the RFC 7807 envelope shape (type, title, status, detail, instance, traceId fields present) for 400/404/409/422/500
- [x] 11.9 Add `"test": "vitest run"` and `"test:watch": "vitest"` scripts to `apps/api/package.json`; remove the legacy `"echo (no tests yet)"` placeholder
- [x] 11.10 Run `pnpm --filter @employeek/api test` — every test must pass

## 12. Turbo wiring (minor)

- [x] 12.1 Confirm `turbo.json`'s `test` task already lists `^build` and `db:generate` in `dependsOn`; no change expected but verify
- [x] 12.2 Run `pnpm test` from the repo root to confirm the root task invokes the new Vitest run

## 13. Documentation

- [x] 13.1 Add an "HTTP API" section to `CLAUDE.md` (after "Local database") covering: dev/test/prod scripts, env vars, RFC 7807 envelope shape, `app.prisma` decorator rule
- [x] 13.2 Update the root-scripts table in `CLAUDE.md` — `pnpm test` is no longer a placeholder; note that it runs Vitest against the live DB
- [x] 13.3 Note in `CLAUDE.md` that Fastify and legacy both default to port 4000 and cannot run simultaneously without overriding `PORT` in `.env`

## 14. Smoke test — golden path

- [x] 14.1 `pnpm db:reset && pnpm db:migrate:deploy && pnpm db:seed` — clean slate
- [x] 14.2 Start the API: `pnpm --filter @employeek/api dev` (foreground in one terminal)
- [x] 14.3 In another terminal, `curl http://localhost:4000/health` — expect `200 {"status":"ok"}`
- [x] 14.4 `curl http://localhost:4000/estados` — expect the 3 seeded rows
- [x] 14.5 `POST` a new empleado via `curl`, then `GET /empleados` and see it
- [x] 14.6 `POST` a tarea without `estadoNombre` — verify it lands in `pendiente`
- [x] 14.7 `PUT /tareas/:id/estado` with `en-progreso` id — `200`
- [x] 14.8 `PUT /tareas/:id/estado` with `pendiente` id after it is in `finalizada` — `400 Invalid state transition`

## 15. Smoke test — error envelope

- [x] 15.1 Validation: `POST /empleados` with `{ "salario": -1 }` — verify `400` + problem envelope with `errors[0].path = "body/salario"`
- [x] 15.2 Not found: `GET /empleados/999999` — verify `404` + problem envelope
- [x] 15.3 Conflict: `POST /estados` with `nombre: "pendiente"` — verify `409`
- [x] 15.4 FK restrict: `POST` an empleado, `POST` a tarea for them, `DELETE /empleados/:id` — verify `422`
- [x] 15.5 SQL injection guard: `GET /tareas/categoria/%27%20OR%201%3D1%20--` — verify `200 []` (empty), no Postgres error in logs
- [x] 15.6 CORS: from a browser tab at `http://localhost:5173` (open `index.html` with `<script>fetch('http://localhost:4000/empleados')</script>`), verify no CORS error

## 16. Quality gates

- [x] 16.1 `pnpm typecheck` passes (Fastify types + Prisma decorator resolved)
- [x] 16.2 `pnpm lint` passes
- [x] 16.3 `pnpm format:check` passes
- [x] 16.4 `pnpm build` passes
- [x] 16.5 `pnpm test` passes
- [x] 16.6 `openspec validate rebuild-api-fastify-ajv-errors --strict` passes

## 17. Commits

- [x] 17.1 Commit Fastify install + env config as `feat(api): add fastify 5 skeleton with @fastify/env + zod schema`
- [x] 17.2 Commit error handler + problem schema as `feat(api): add rfc 7807 problem details error handler`
- [x] 17.3 Commit app factory + server bootstrap as `feat(api): add buildApp factory and server bootstrap`
- [x] 17.4 Commit schemas as `feat(api): add ajv schemas for empleado/estado/tarea resources`
- [x] 17.5 Commit empleados routes as `feat(api): port empleados endpoints to fastify`
- [x] 17.6 Commit estados routes as `feat(api): port estados endpoints to fastify`
- [x] 17.7 Commit tareas routes + state transition logic as `feat(api): port tareas endpoints with data-driven state transitions`
- [x] 17.8 Commit health routes as `feat(api): add /health and /health/ready endpoints`
- [x] 17.9 Commit vitest config + tests as `test(api): add vitest integration tests with fastify.inject`
- [x] 17.10 Commit `.env.example` additions as `chore(infra): add API env defaults (PORT, HOST, CORS_ORIGINS, LOG_LEVEL)`
- [x] 17.11 Commit `CLAUDE.md` updates as `docs(api): document fastify http api workflow`
- [x] 17.12 Commit ticked `tasks.md` as `chore(openspec): mark rebuild-api-fastify-ajv-errors tasks complete`

## 18. Archive handoff

- [x] 18.1 Verify `openspec status --change rebuild-api-fastify-ajv-errors --json` reports all 4 artifacts `done` and `isComplete: true`
- [x] 18.2 Run `/opsx:archive` to promote `api-rest` into `openspec/specs/` and move the change into `openspec/changes/archive/` (user-triggered)
- [x] 18.3 Merge branch `feat/rebuild-api-fastify-ajv-errors` into `main` (user-authorized — pause per safety protocol)
