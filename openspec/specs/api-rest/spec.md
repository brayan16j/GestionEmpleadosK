# HTTP REST API Specification

## Purpose

This capability defines the HTTP/REST surface of EmployeeK — the Fastify 5 application under `apps/api`, its boot lifecycle, env-driven configuration, AJV schema-validated routes, RFC 7807 Problem Details error envelope, Pino-based logging, and the typed endpoints across the `empleados`, `tareas`, and `estados` resources. It consumes `db-schema-prisma` (typed Prisma client) and `db-local-postgres` (local database) as stable contracts, and provides the HTTP surface that downstream capabilities (the Vite frontend, OpenAPI derivation, CI) build on top of.

## Requirements

### Requirement: Fastify 5 owns the HTTP surface of `apps/api`

The `apps/api` workspace SHALL use Fastify 5.x as its only HTTP framework. `apps/api/package.json` SHALL declare `fastify` (`^5`) as a runtime dependency. No other HTTP framework (Express, Koa, Hono, NestJS) SHALL be present.

#### Scenario: Fastify is installed and importable

- **WHEN** a developer runs `pnpm install` on a fresh clone
- **THEN** `apps/api/node_modules/fastify/` exists and `pnpm --filter @employeek/api list fastify` reports a `^5.x` version

#### Scenario: No legacy HTTP framework leaks into `apps/api`

- **WHEN** inspecting `apps/api/package.json` and `apps/api/src/`
- **THEN** there is no dependency on or import of `express`, `koa`, `hapi`, `hono`, or `@nestjs/*`

### Requirement: App factory separates building from listening

The repository SHALL expose `buildApp(opts?: AppOpts): Promise<FastifyInstance>` at `apps/api/src/app.ts` that returns a fully-wired Fastify instance without calling `.listen()`. A separate `apps/api/src/server.ts` SHALL call `buildApp` and then `app.listen({ port, host })` using values from `app.config`. Tests SHALL import `buildApp` directly and use `app.inject()` rather than binding to a port.

#### Scenario: Tests boot the app without a listening socket

- **WHEN** a Vitest test file calls `await buildApp({ logger: false })` and then `app.inject({ method: 'GET', url: '/health' })`
- **THEN** the request returns `200` with `{ status: 'ok' }`, and no port is bound on the host

#### Scenario: Production boot binds the configured port

- **WHEN** a developer runs `pnpm --filter @employeek/api dev` with `PORT=4000` in `.env`
- **THEN** Fastify logs that it is listening on `0.0.0.0:4000` and `curl http://localhost:4000/health` returns `200 { "status": "ok" }`

### Requirement: Environment config via `@fastify/env` with a Zod-derived schema

`apps/api/src/config/env.ts` SHALL define a Zod schema `envZ` for `NODE_ENV`, `DATABASE_URL`, `PORT`, `HOST`, `CORS_ORIGINS`, and `LOG_LEVEL`, with sensible defaults. The schema SHALL be converted to JSON Schema and passed to `@fastify/env` at registration time. The decorated `app.config` SHALL be typed as `z.infer<typeof envZ>`. Missing or malformed required vars SHALL abort boot with a descriptive error.

#### Scenario: Missing DATABASE_URL aborts boot

- **WHEN** a developer removes `DATABASE_URL` from `.env` and runs `pnpm --filter @employeek/api dev`
- **THEN** the server exits non-zero during boot with an error message that names `DATABASE_URL` as the missing variable

#### Scenario: Defaults apply when optional vars are omitted

- **WHEN** `.env` contains only `DATABASE_URL` (no `PORT`, `HOST`, `CORS_ORIGINS`, `LOG_LEVEL`)
- **THEN** the app boots with `PORT=4000`, `HOST=0.0.0.0`, `CORS_ORIGINS='http://localhost:5173'`, `LOG_LEVEL='info'`, all accessible via `app.config`

#### Scenario: `app.config` is typed

- **WHEN** a TypeScript route handler reads `app.config.PORT`
- **THEN** the type of `app.config.PORT` is `number` (not `string`) and the compiler rejects reading an undeclared key like `app.config.FOO`

### Requirement: CORS is env-driven with a Vite-compatible default

The app SHALL register `@fastify/cors` with `origin` sourced from `CORS_ORIGINS` (comma-separated list). The default value SHALL allow `http://localhost:5173` so the CH5 Vite frontend works out of the box.

#### Scenario: Default CORS allows the Vite dev origin

- **WHEN** the frontend served on `http://localhost:5173` issues `fetch('http://localhost:4000/empleados')`
- **THEN** the response includes `Access-Control-Allow-Origin: http://localhost:5173` and no CORS console error appears

#### Scenario: Disallowed origin is blocked

- **WHEN** a request from `Origin: http://evil.example` hits a CORS-protected route
- **THEN** the response omits `Access-Control-Allow-Origin` and the browser rejects the cross-origin read

### Requirement: Every error response uses RFC 7807 Problem Details

The app SHALL install a single `setErrorHandler` that maps all thrown errors to `application/problem+json` with the shape `{ type, title, status, detail, instance, traceId, errors? }`. Raw `error.message` values SHALL NOT reach the client on `5xx` responses.

#### Scenario: Validation failure returns 400 with problem envelope

- **WHEN** a client `POST`s to `/empleados` with body `{ "salario": "not-a-number" }`
- **THEN** the response is `HTTP/1.1 400 Bad Request`, `content-type: application/problem+json`, and the body contains `type`, `title: "Validation failed"`, `status: 400`, `instance: "/empleados"`, a `traceId`, and an `errors` array listing the offending field

#### Scenario: Unknown record returns 404

- **WHEN** a client `GET`s `/empleados/999999` and no empleado with that id exists
- **THEN** the response is `404 Not Found` in the same problem envelope, with `title: "Not Found"`

#### Scenario: Unique violation returns 409

- **WHEN** a client `POST`s two `/estados` with the same `nombre`
- **THEN** the second request returns `409 Conflict` with a problem envelope whose `title` is `"Conflict"` and `detail` references the `nombre` field

#### Scenario: Foreign-key violation returns 422

- **WHEN** a client `POST`s to `/tareas` with an `idEmpleado` that does not exist in `empleado`
- **THEN** the response is `422 Unprocessable Entity` with a problem envelope naming the failed reference

#### Scenario: Unexpected errors do not leak internals

- **WHEN** an uncaught exception occurs inside a handler
- **THEN** the response is `500 Internal Server Error` with a generic `detail` (e.g. "An unexpected error occurred") and a `traceId`, and the original exception message is logged server-side but not sent to the client

#### Scenario: Validation never returns 403

- **WHEN** any validation failure occurs
- **THEN** the response status is `400`, never `403` — the legacy `validateHelper.js` bug is not reintroduced

### Requirement: Every route declares AJV schemas for validation and serialization

Every route registered in the app SHALL declare a `schema` object with AJV JSON schemas for each of `params`, `querystring`, and `body` that the route accepts, plus at least a `response[2xx]` schema. Routes SHALL NOT ship without a `response` schema.

#### Scenario: Missing response schema is rejected at boot

- **WHEN** a developer adds a route without a `response[2xx]` schema and starts the app
- **THEN** boot fails with a clear error pointing at the offending route, before any request is served

#### Scenario: Response fields outside the schema are stripped

- **WHEN** a handler returns `{ id: 1, nombre: 'Ana', secretoInterno: 'x' }` but the `response[200]` schema only declares `id` and `nombre`
- **THEN** the serialized response body is `{ "id": 1, "nombre": "Ana" }` — `secretoInterno` is not leaked to the client

### Requirement: Health endpoints for liveness and readiness

The app SHALL expose `GET /health` (liveness, always `200 { status: 'ok' }`, no DB touch) and `GET /health/ready` (readiness, `200` if `SELECT 1` on the DB succeeds, `503` otherwise). Both SHALL have `response` schemas and be reachable without authentication.

#### Scenario: Liveness works without the DB

- **WHEN** Postgres is down and a client calls `GET /health`
- **THEN** the response is `200 { status: 'ok' }`

#### Scenario: Readiness reflects DB connectivity

- **WHEN** Postgres is up and a client calls `GET /health/ready`
- **THEN** the response is `200 { status: 'ok' }`
- **WHEN** Postgres is down and a client calls `GET /health/ready`
- **THEN** the response is `503 Service Unavailable` in the RFC 7807 envelope

### Requirement: Prisma client is exposed as a Fastify decorator

The app SHALL decorate the Fastify instance with `prisma: PrismaClient` (sourced from `apps/api/src/db/client.ts`). Routes SHALL access the client via `app.prisma` or `request.server.prisma`, not via top-level imports of `@prisma/client`.

#### Scenario: Routes reach Prisma via the decorator

- **WHEN** inspecting the route handlers under `apps/api/src/routes/`
- **THEN** none of them import `PrismaClient` directly; all data access goes through `request.server.prisma` or `app.prisma`

#### Scenario: TypeScript knows about the decorator

- **WHEN** a developer writes `app.prisma.empleado.count()` in a route handler
- **THEN** the compiler reports no error and autocomplete lists Prisma models on `app.prisma`

### Requirement: Empleados resource exposes six endpoints

The app SHALL expose these routes under `/empleados` with schema-validated input and RFC 7807 errors:

- `GET /empleados` — list all empleados, `200` with an array.
- `GET /empleados/:id` — return one empleado, `404` if not found.
- `POST /empleados` — create, `201` with the new row, body `{ nombre, fechaIngreso (YYYY-MM-DD), salario (number ≥ 0) }`.
- `PUT /empleados/:id` — update, body identical to POST, `200` with the updated row, `404` if not found.
- `DELETE /empleados/:id` — delete, `204` empty body, `404` if not found.
- `GET /empleados/:id/tareas` — list tareas owned by the empleado, `200` with an array (empty array if no tareas), `404` if empleado not found.

#### Scenario: Creating an empleado returns 201 with the saved row

- **WHEN** a client `POST`s `/empleados` with `{ "nombre": "Ana", "fechaIngreso": "2026-01-15", "salario": 3500.5 }`
- **THEN** the response is `201 Created` with body containing `id: <int>`, `nombre: "Ana"`, `fechaIngreso: "2026-01-15"`, `salario: "3500.50"`, `createdAt`, `updatedAt`

#### Scenario: Validation rejects a negative salary

- **WHEN** a client `POST`s `/empleados` with `salario: -10`
- **THEN** the response is `400` with a problem envelope naming `body/salario` as the offending field

#### Scenario: PUT requires the same body as POST

- **WHEN** a client `PUT`s `/empleados/:id` with a missing `nombre`
- **THEN** the response is `400` — PUT validation is as strict as POST (the legacy `updateEmpleado` accepted anything)

#### Scenario: Deleting an empleado that owns tareas is rejected

- **WHEN** a client `DELETE`s `/empleados/:id` and the empleado has rows in `tareas`
- **THEN** the response is `422 Unprocessable Entity` from the FK-restrict handler (consistent with CH3's `onDelete: Restrict`)

#### Scenario: Listing tareas for an unknown empleado

- **WHEN** a client `GET`s `/empleados/999999/tareas` and no such empleado exists
- **THEN** the response is `404`, not an empty array

### Requirement: Estados resource exposes five endpoints with a fixed body shape

The app SHALL expose these routes under `/estados` (plural):

- `GET /estados` — list all estados, `200` with an array.
- `GET /estados/:id` — return one estado, `404` if not found.
- `POST /estados` — create, `201`, body `{ nombre (unique string), categoria (string), cambiosPermitidos?: string | null }`.
- `PUT /estados/:id` — update, body identical to POST, `200`, `404` if not found.
- `DELETE /estados/:id` — delete, `204`, `404` if not found, `422` if referenced by any tarea (FK restrict).

#### Scenario: POST body uses `nombre` (not legacy's `estado`)

- **WHEN** a client `POST`s `/estados` with `{ "nombre": "cancelada", "categoria": "cerrada" }`
- **THEN** the response is `201` and the created row has `nombre: "cancelada"`, not a hidden `estado` column

#### Scenario: POST with a duplicate nombre returns 409

- **WHEN** a client `POST`s `/estados` with `{ "nombre": "pendiente" }` (already seeded)
- **THEN** the response is `409 Conflict` via the problem envelope

#### Scenario: Legacy singular path is not served

- **WHEN** a client `GET`s the legacy path `/estado`
- **THEN** the response is `404` — only `/estados` exists

### Requirement: Tareas resource exposes seven endpoints with data-driven state transitions

The app SHALL expose these routes under `/tareas`:

- `GET /tareas` — list all tareas, `200` with an array including the related empleado `nombre` and estado `nombre`.
- `GET /tareas/:id` — return one tarea, `404` if not found.
- `GET /tareas/categoria/:categoria` — list tareas whose estado's `categoria` matches the path param, via a parameterized Prisma `where` (no string interpolation), `200` with an array.
- `POST /tareas` — create, `201`, body `{ nombre, fechaCreacion, fechaInicioTarea, fechaFinalizacion, idEmpleado, estadoNombre?: string }`. If `estadoNombre` is omitted, default to `'pendiente'` (resolved by `findUnique` on the unique `nombre`).
- `PUT /tareas/:id` — update, body identical to POST (minus `estadoNombre`), `200`, `404` if not found.
- `PUT /tareas/:id/estado` — change the tarea's estado, body `{ idEstado: number }`, `200` with the updated tarea. Validates the transition against the **current** estado's `cambiosPermitidos` CSV.
- `DELETE /tareas/:id` — delete, `204`, `404` if not found.

#### Scenario: POST /tareas defaults initial estado to `pendiente`

- **WHEN** a client `POST`s `/tareas` without an `estadoNombre`
- **THEN** the created tarea's `idEstado` resolves to the row where `estado.nombre = 'pendiente'`

#### Scenario: POST /tareas with an unknown estadoNombre returns 404

- **WHEN** a client `POST`s `/tareas` with `estadoNombre: "no-existe"`
- **THEN** the response is `404` with a problem envelope naming the missing estado

#### Scenario: Invalid state transition returns 400

- **WHEN** a tarea is currently in `finalizada` (whose `cambiosPermitidos` is `null`) and a client `PUT`s `/tareas/:id/estado` with `{ idEstado: <pendiente.id> }`
- **THEN** the response is `400` with a problem envelope titled `"Invalid state transition"` and a `detail` referencing the current and attempted estado names

#### Scenario: Valid state transition updates the tarea

- **WHEN** a tarea is in `pendiente` (whose `cambiosPermitidos` is `'en-progreso,finalizada'`) and a client `PUT`s `/tareas/:id/estado` with `{ idEstado: <en-progreso.id> }`
- **THEN** the response is `200` and the tarea's `idEstado` is now `en-progreso`'s id

#### Scenario: GET /tareas/categoria is not SQL-injectable

- **WHEN** a client `GET`s `/tareas/categoria/' OR 1=1 --`
- **THEN** Prisma treats the value as a literal string (no matching estados) and the response is `200` with an empty array — no syntax error, no extra rows, no Postgres warning in logs

#### Scenario: Tarea list includes related names

- **WHEN** a client `GET`s `/tareas`
- **THEN** each item in the response array includes `empleadoNombre` (from the related empleado) and `estadoNombre` (from the related estado), not just the foreign-key ids

### Requirement: Vitest integration tests cover every endpoint

The repository SHALL contain Vitest tests under `apps/api/test/` that use `buildApp({ logger: false })` + `app.inject()` to exercise every route. Coverage SHALL include:

- Every endpoint's golden-path scenario (matching status code + response schema).
- At least one error-path scenario per endpoint (one of `400`, `404`, `409`, `422` as appropriate).
- A shared `globalSetup` that applies migrations and seeds before the suite runs.

`apps/api/package.json` SHALL expose `test` (single-run) and `test:watch` scripts invoking Vitest.

#### Scenario: `pnpm test` passes with the database up

- **WHEN** a developer runs `pnpm db:up && pnpm db:migrate:deploy && pnpm db:seed && pnpm --filter @employeek/api test`
- **THEN** Vitest completes with exit code 0 and every test file reports at least one test passing

#### Scenario: Tests run in a single fork

- **WHEN** Vitest is invoked via `pnpm --filter @employeek/api test`
- **THEN** it uses `--pool=forks --poolOptions.forks.singleFork=true` (or equivalent) to avoid parallel writes racing on the shared DB

#### Scenario: Test environment disables logging by default

- **WHEN** a Vitest test boots via `buildApp({ logger: false })`
- **THEN** no Pino lines appear in the test output unless the test opts in explicitly

### Requirement: Pino logger with pretty-print in development

The app SHALL use Fastify's default Pino logger. In `NODE_ENV=development` the logger SHALL pipe to `pino-pretty` for human-readable output. In `NODE_ENV=production` the logger SHALL write structured JSON to stdout. In `NODE_ENV=test` the logger SHALL default to disabled. Every request log SHALL include the Fastify-generated `reqId`, and the same id SHALL appear as `traceId` in any RFC 7807 error response from that request.

#### Scenario: Dev logs are pretty

- **WHEN** a developer runs `pnpm --filter @employeek/api dev` (`NODE_ENV=development`) and hits an endpoint
- **THEN** the terminal shows colorized, one-line-per-event logs with request ids

#### Scenario: Error traceId matches log reqId

- **WHEN** a request triggers a 500 and is logged at level `error`
- **THEN** the `traceId` in the JSON response equals the `reqId` printed in the corresponding log line

### Requirement: `.env.example` documents the new variables

`.env.example` SHALL list every variable the API reads — `PORT`, `HOST`, `CORS_ORIGINS`, `LOG_LEVEL` — each with a safe placeholder and a brief inline comment. Existing entries (`POSTGRES_*`, `DATABASE_URL`) SHALL remain unchanged.

#### Scenario: Fresh clone works with placeholder env

- **WHEN** a new contributor runs `cp .env.example .env && pnpm db:up && pnpm db:migrate:deploy && pnpm db:seed && pnpm --filter @employeek/api dev`
- **THEN** the API binds `http://localhost:4000`, serves `/health`, and accepts requests from `http://localhost:5173` — all with default placeholders

### Requirement: Legacy stack remains untouched

The `legacy/` directory SHALL NOT be modified by this change. Legacy Express routes, controllers, validators, and the Sequelize connection SHALL remain runnable via `cd legacy && npm install && npm run dev`, unchanged from the state they were in at the end of CH3.

#### Scenario: Legacy still boots after CH4

- **WHEN** a developer runs `cd legacy && npm install && npm run dev` after this change is applied
- **THEN** the legacy Express server starts on port 4000 and serves its original 18 routes exactly as before

#### Scenario: No Fastify imports inside `legacy/`

- **WHEN** grepping `legacy/` for `fastify` or `@fastify/`
- **THEN** there are zero matches

### Requirement: Developer documentation covers the API workflow

`CLAUDE.md` SHALL include an "HTTP API" section documenting:

- How to start the API (`pnpm --filter @employeek/api dev`).
- The env variables the API reads (with pointer to `.env.example`).
- The RFC 7807 error envelope shape and when each status code is used.
- How to run tests (`pnpm --filter @employeek/api test`).
- The rule that app code accesses Prisma via `app.prisma`, not a top-level import.

#### Scenario: New contributor boots and tests the API

- **WHEN** a new contributor reads the "HTTP API" section and follows it end-to-end
- **THEN** they can start the server, hit `/health`, run the test suite, and understand the error envelope without asking questions
