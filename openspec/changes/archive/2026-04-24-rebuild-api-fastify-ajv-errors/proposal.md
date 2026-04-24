## Why

`apps/api` is still a `console.log` skeleton: CH1 gave it a workspace, CH2 gave it a database, CH3 gave it a typed schema, but there is no HTTP server yet. The legacy Express app under `legacy/` answers 18 routes with mixed-quality code — a live SQL injection in `tareasController.js:203`, a validation helper that returns `403` instead of `400`, hardcoded credentials, controllers that leak Sequelize model internals as JSON, no tests, no typed contract. CH4 replaces that surface with Fastify + AJV + RFC 7807, so downstream changes (Vite frontend CH5, OpenAPI types CH6, CI CH7) have a solid, tested, typed API to build on.

## What Changes

- Stand up a Fastify 5 server in `apps/api/src/` with a clean boot lifecycle (`buildApp` returns a `FastifyInstance` for tests; `start` binds the port from env).
- Load configuration via `@fastify/env` with a Zod-derived AJV schema: `DATABASE_URL`, `NODE_ENV`, `PORT`, `HOST`, `CORS_ORIGINS`, `LOG_LEVEL`. No more hardcoded creds, no more `process.env.X` sprinkled across modules.
- Define every route with AJV JSON schemas for `params`, `query`, `body`, and `response` — Fastify's native pattern — so validation and response serialization are both schema-driven.
- Replace the legacy validation helper with Fastify's built-in AJV error hook. Validation failures SHALL return `400 Bad Request` (not `403`) in RFC 7807 Problem Details format.
- Install a single `setErrorHandler` that maps every thrown error to RFC 7807 — AJV validation → `400`, not-found helpers → `404`, Prisma `P2002` unique violation → `409`, Prisma `P2003` FK violation → `422`, unknown → `500` with a generated `traceId`. No more raw `error.message` leaking to clients.
- Port the 18 legacy endpoints (6 empleados, 7 tareas, 5 estados) to Fastify with the typed Prisma client from CH3:
  - **BREAKING**: `POST /estados` now accepts `{ nombre, categoria, cambiosPermitidos? }` (legacy accidentally accepted `{ estado, categoria }` because the validator and controller disagreed).
  - **BREAKING**: Tarea state transitions are driven by the `estado.cambiosPermitidos` field (CSV of allowed destination names) from CH3's seed, not the legacy hardcoded 12-state `estados` object in `tareasController.js:123-136`. Initial estado on `POST /tareas` is resolved by name (default `pendiente`) instead of the legacy hardcoded `'Emitida'`.
  - **BREAKING**: `GET /tareas/categoria/:categoria` drops the `sequelize.literal` SQL injection — it uses a parameterized Prisma `where` clause instead.
  - **BREAKING**: `PUT /empleados/:id` and `PUT /tareas/:id` now require the same AJV body validation as the matching POST.
  - URL shape preserved (`/empleados`, `/tareas`, `/estados`) so CH5's Vite frontend can point at this API with no path changes (the legacy `/estado` singular becomes `/estados` plural for consistency — flagged as **BREAKING**, but the frontend has not yet been migrated).
- Introduce `@fastify/cors` reading the allowlist from `CORS_ORIGINS` (comma-separated), replacing the legacy hardcoded `'http://localhost:3000'`.
- Introduce `@fastify/sensible` for typed HTTP errors (`httpErrors.notFound`, `httpErrors.conflict`) and consistent payloads.
- Use Pino (Fastify's default logger) with `pino-pretty` in dev, structured JSON in prod, and request-id propagation.
- Add Vitest + `fastify.inject()` for in-process integration tests. Cover every endpoint's golden path + at least one error path (400, 404, 409, 422). Tests run against the real local Postgres via the CH2 container — no mocking the DB.
- Add a `test` script (already a no-op in the root) that actually runs Vitest, plus a `test:watch`, and wire Turbo's `test` task to depend on `db:generate`.
- Document the Fastify boot, the env contract, and the error envelope shape in `CLAUDE.md`.

## Capabilities

### New Capabilities

- `api-rest`: the HTTP/REST surface of EmployeeK — Fastify app lifecycle, env-driven config, AJV schema-validated routes, RFC 7807 error envelope, and the 18 typed endpoints across the `empleados`, `tareas`, `estados` resources.

### Modified Capabilities

<!-- None. `db-schema-prisma` is consumed unchanged; `db-local-postgres` is consumed unchanged; `monorepo-foundation` is consumed unchanged. This change adds a new layer; it does not redefine the contracts below it. -->

## Impact

- **New files**: `apps/api/src/server.ts` (bootstrap), `apps/api/src/app.ts` (build + plugin registration), `apps/api/src/config/env.ts` (Zod schema + loader), `apps/api/src/errors/problem.ts` (RFC 7807 envelope + error mapper), `apps/api/src/plugins/*.ts` (cors, sensible, prisma decorator), `apps/api/src/routes/empleados.ts`, `apps/api/src/routes/tareas.ts`, `apps/api/src/routes/estados.ts`, `apps/api/src/schemas/*.ts` (AJV/JSON schemas for each resource), `apps/api/test/**/*.test.ts` (Vitest + fastify.inject).
- **Modified files**: `apps/api/package.json` (new deps + test scripts), `apps/api/src/index.ts` (becomes a thin wrapper that imports and calls `server.ts`), `apps/api/src/db/client.ts` (no change in public API; potentially extended with a log hook), root `turbo.json` (test task already wired to `db:generate` — verify), `.env.example` (add `PORT`, `HOST`, `CORS_ORIGINS`, `LOG_LEVEL` with safe defaults), `CLAUDE.md` (new "HTTP API" section).
- **Dependencies (apps/api)**: `fastify@^5`, `@fastify/env@^6`, `@fastify/cors@^11`, `@fastify/sensible@^6`, `pino-pretty@^13` (dev), `zod@^4` (native `z.toJSONSchema()` — no bridge library), `vitest@^4` (dev), `@vitest/coverage-v8@^4` (dev). No additions to root `package.json`.
- **Env contract (new vars)**: `PORT` (default `4000`, matches legacy), `HOST` (default `0.0.0.0`), `CORS_ORIGINS` (default `http://localhost:5173` — Vite's default dev port, ready for CH5), `LOG_LEVEL` (default `info` in prod, `debug` in dev).
- **Runtime surface**: `pnpm --filter @employeek/api dev` now binds `http://localhost:4000` (not just prints and exits). Ready endpoints: `GET /health`, full CRUD on the three resources.
- **Downstream**: unblocks CH5 (frontend has a real API), CH6 (OpenAPI derivation has schema-first routes to walk), CH7 (CI has tests to run). CH8's `retire-legacy-express-stack` becomes a pure deletion once CH5 points at this API.
- **Legacy**: `legacy/` is untouched. It keeps serving the old routes on its own port until CH8. Any behavior described as **BREAKING** above is breaking relative to legacy — it does not affect legacy itself.
