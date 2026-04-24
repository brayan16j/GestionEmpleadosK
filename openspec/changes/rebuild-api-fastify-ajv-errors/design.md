## Context

CH1/CH2/CH3 left `apps/api` with a Prisma client, a tested schema, a running local Postgres, and nothing that speaks HTTP. The refoundation plan (ADR-0) locked Fastify as the backend framework and explicitly listed "Vitest + Supertest desde el día 1" as a CH4 requirement.

The legacy app under `legacy/` is the behavioural reference: 18 endpoints across three resources, Express 4, express-validator, Sequelize, no tests, no OpenAPI. Three legacy-specific problems the rewrite must resolve:

1. **SQL injection** at `legacy/src/controllers/tareasController.js:203` — raw `categoria` param interpolated into `sequelize.literal`.
2. **Wrong status code** at `legacy/src/helpers/validateHelper.js:8` — validation errors return `403` instead of `400`.
3. **Hardcoded credentials** at `legacy/src/database/database.js:3` — DB user/password/DB name embedded in source.

The project is Windows-primary (Brayan + Konecta laptops), TS-strict, ESM, Node 20.19+ (required by Prisma 7 from CH3). The frontend (CH5) will run on Vite's default dev port `5173`; CORS must allow it out of the box. OpenAPI generation (CH6) will walk Fastify's schema registry, so every route **must** declare AJV JSON schemas.

One memory note to revisit: the ADR-0 plan mentioned Supertest for testing. Fastify ships `app.inject()` (backed by `light-my-request`), which is faster, does not need a listening socket, and is the idiomatic Fastify testing tool. We use `.inject()` and skip Supertest — documented below as a deliberate deviation.

## Goals / Non-Goals

**Goals:**

- A Fastify 5 app booted in two layers: `buildApp(opts)` returns a fully-wired `FastifyInstance` (no listening socket) for tests, and `start()` calls `buildApp` then `.listen`. One code path; no production/test fork.
- Every route declares AJV schemas for `params`, `query`, `body`, and `response.2xx`. Missing schema → CI fails (via a Fastify plugin-level assertion or a lint rule we ship in CH4).
- Validation errors, business errors, and Prisma errors all exit via one `setErrorHandler` that produces RFC 7807 JSON: `{ type, title, status, detail, instance, traceId }`. Never `res.send(err.message)`.
- `@fastify/env` owns the env contract with a Zod schema. The schema is the single source of truth — `.env.example`, `prisma.config.ts` docs, and `CLAUDE.md` reference it.
- `GET /health` returns `200 { status: 'ok' }` without touching the DB (liveness) and `GET /health/ready` returns `200` iff Postgres is reachable (readiness). CH7's CI will use these.
- Vitest + `app.inject()` cover all 18 endpoints (golden + at least one error path each) against the real CH2 Postgres. No mocking the DB, no fixture fakes — tests run migrations/seed before the suite.
- The known legacy bugs are fixed: 403→400, SQL injection removed, env-driven creds, consistent POST /estados body shape, state transitions driven by seed data.
- Frontend (CH5) can `fetch('http://localhost:4000/empleados')` from `http://localhost:5173` on day one, with no CORS hacks.

**Non-Goals:**

- No authentication, sessions, or API keys. The legacy had none; Konecta's internal app does not need it yet.
- No rate limiting, no WAF headers beyond what `@fastify/sensible` and Fastify's defaults ship. Can be added in a follow-up without spec churn.
- No OpenAPI document generation. That is CH6's job — CH4 only commits to schema-first routes so CH6 has something to read.
- No typed client package. Also CH6.
- No frontend. CH5.
- No migration of legacy data. CH3 ADR-0 already said there is no dump to preserve.
- No feature expansion: the 18 endpoints match the legacy surface one-to-one (minus the unused `getEmpleadoTareas` weirdness, which we keep — it is a principle-of-REST-subresource demo the author left in). No new endpoints like "search empleados by salary range" even though Prisma makes it trivial. Scope discipline wins.

## Decisions

### Fastify 5 (not Express, not Hono, not Koa)

**Rationale:** ADR-0 locked Fastify 2026-04-22. The lock reasons are: schema-first route definitions (unlocks CH6), AJV by default (built-in validation + serialization, 2× perf vs `JSON.stringify`), Pino by default (structured logs, zero-config), TypeScript types that are actually maintained, and a plugin ecosystem that covers every enterprise concern we will hit (`@fastify/env`, `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/jwt`, `@fastify/swagger` for CH6).

**Alternatives considered:**

- **Express 5** — rejected: no schema-first routes (we would need express-validator on top, which is what the legacy has and what burned us), weak TS story, no built-in serialization optimization.
- **Hono** — rejected for CH4 timing: smaller ecosystem, no drop-in OpenAPI plugin at CH6's maturity. Also the team is green on TypeScript back-ends; Fastify has deeper Spanish-language tutorials.
- **NestJS** — rejected: heavy decorator-heavy DI framework, three times the boilerplate, overkill for 18 endpoints, and clashes with the "keep it boring" vibe the refoundation set.

### Fastify version 5.x (not 4.x)

**Rationale:** Fastify 5 requires Node 20+ (which we pin) and ships AJV 8 + better TypeScript types. We start fresh, so there is no 4→5 migration pain to pay. Prisma 7 + Fastify 5 is a current, fully-supported combination on Windows.

**Trade-off:** Some older tutorials/blog posts use 4.x APIs. We ship an in-repo pointer to the Fastify 5 docs and a short cheatsheet in `CLAUDE.md` to insulate developers from stale examples.

### Two-layer app: `buildApp(opts)` vs `start()`

```ts
// apps/api/src/app.ts
export async function buildApp(opts: AppOpts = {}): Promise<FastifyInstance> {
  const app = fastify({ logger: buildLogger(opts) });
  await app.register(fastifyEnv, { schema: envSchema, dotenv: false });
  await app.register(sensible);
  await app.register(cors, { origin: app.config.CORS_ORIGINS.split(',') });
  app.decorate('prisma', prisma);
  app.setErrorHandler(problemErrorHandler);
  await app.register(empleadosRoutes, { prefix: '/empleados' });
  await app.register(tareasRoutes, { prefix: '/tareas' });
  await app.register(estadosRoutes, { prefix: '/estados' });
  app.get('/health', { schema: healthSchema }, () => ({ status: 'ok' }));
  app.get('/health/ready', { schema: healthSchema }, readinessHandler);
  return app;
}

// apps/api/src/server.ts
const app = await buildApp();
await app.listen({ port: app.config.PORT, host: app.config.HOST });
```

**Rationale:** `app.inject({ method, url, payload })` gives us real request/response semantics without a listening socket or port conflicts. Tests parallelize cleanly, CI does not fight for ports, and the same code path serves prod + tests. This is the documented Fastify pattern — every Fastify book opens with this shape.

**Alternatives:**

- Single-layer with conditional listen → rejected, couples test runner to env side-effects.
- Supertest against a listening server → rejected, slower by a factor of ~10, port-management pain on CI, no TS typing on request/response. We keep Supertest out.

### Configuration: `@fastify/env` with a Zod schema, AJV runtime

```ts
// apps/api/src/config/env.ts
import { z } from 'zod';

export const envZ = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof envZ>;
// z.toJSONSchema(envZ) converts the schema to JSON Schema at boot, passed to @fastify/env.
```

**Rationale:**

- Zod is the TypeScript-idiomatic validator. We author once, derive both the AJV schema (for `@fastify/env` runtime checks) and the `Env` type (for `app.config` typing).
- `@fastify/env` fails the boot if a required var is missing, so misconfigurations surface in seconds, not at first request.
- No `dotenv` dep: the repo-root `.env` is already loaded by Prisma's config layer and by Node's `--env-file` in scripts. We set `@fastify/env`'s `dotenv: false` and rely on the single load path established in CH3.

**Trade-off:** two schema runtimes (Zod for authoring + type inference, AJV for `@fastify/env`'s runtime). Zod 4 exposes `z.toJSONSchema()` natively, so no bridge library is needed. We accept the tiny runtime overhead because Zod's DX on unions/coercion beats AJV authoring by a wide margin.

**Alternative:** ship an AJV schema directly and manually derive TS types. Rejected — manual type duplication is exactly the bug we left behind in legacy.

### RFC 7807 Problem Details as the only error shape

Every error response — validation, not-found, conflict, unexpected — is serialized through one handler as `application/problem+json`:

```json
{
  "type": "https://employeek.local/problems/validation",
  "title": "Validation failed",
  "status": 400,
  "detail": "body.salario must be a positive number",
  "instance": "/empleados",
  "traceId": "01HJ...",
  "errors": [{ "path": "body.salario", "message": "must be >= 0" }]
}
```

**Rationale:**

- RFC 7807 is the boring, documented standard. Frontend (CH5) gets one shape to parse; OpenAPI (CH6) gets one error envelope to describe; on-call engineers get one grep pattern.
- `traceId` is the Fastify `request.id` — already generated per request, already logged by Pino. The frontend can include it in bug reports, and we can correlate to logs instantly.
- Never send `error.message` raw on `5xx`. Clients get a generic message plus the `traceId`; the actual exception is logged.

**Mapping table** (lives in `src/errors/problem.ts`):

| Thrown | Status | Title |
|---|---|---|
| Fastify validation (AJV) | 400 | Validation failed |
| `httpErrors.notFound()` | 404 | Not Found |
| Prisma `P2025` (record not found) | 404 | Not Found |
| Prisma `P2002` (unique violation) | 409 | Conflict |
| Prisma `P2003` (FK violation) | 422 | Unprocessable Entity |
| `httpErrors.badRequest()` (business rule) | 400 | Invalid state transition |
| Unknown / uncaught | 500 | Internal Server Error (generic detail) |

**Alternative:** Ship a custom error envelope (`{ ok: false, error: { code, message } }`). Rejected — rolling a new convention adds zero value and blocks CH6 which will reference RFC 7807 directly in OpenAPI `Problem` schemas.

### Schema-first routes with AJV

Every route uses the Fastify `schema` option:

```ts
app.post(
  '/',
  {
    schema: {
      body: createEmpleadoBodySchema,
      response: { 201: empleadoSchema, 400: problemSchema },
    },
  },
  async (req, reply) => {
    const empleado = await app.prisma.empleado.create({ data: req.body });
    reply.status(201);
    return empleado;
  },
);
```

- Params, query, body, response schemas live in `src/schemas/*.ts` as AJV JSON schemas (hand-authored — not Zod-derived for route schemas). Reasons: (a) `fast-json-stringify` optimization only kicks in with raw JSON schemas, (b) CH6 will walk these same schemas for OpenAPI, (c) we want the learning curve of "JSON Schema is what the protocol says" for the team.
- `response.2xx` SHALL be declared for every route. This enables Fastify's serialization fast path and prevents accidental field leaks (the legacy had `res.json(empleado)` exposing internal Sequelize metadata).
- A repo-level assert (in the `buildApp` wrapper) throws on boot if any route is missing a response schema — a dev-time guardrail that becomes a CI guardrail in CH7.

### Prisma client as a Fastify decorator

`app.decorate('prisma', prisma)` + `declare module 'fastify' { interface FastifyInstance { prisma: PrismaClient } }`.

**Rationale:** Routes access the client via `app.prisma` / `req.server.prisma`, not via a top-level import — this makes mocking trivial (decorate a fake in tests) and keeps the singleton concern in one place.

**Trade-off:** we still import the singleton from `src/db/client.ts` into `app.ts` to decorate it. That is a tolerable single reference; routes themselves stay clean.

### Testing: Vitest + `app.inject()` against real Postgres

```ts
// apps/api/test/empleados.test.ts
import { buildApp } from '../src/app.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp({ logger: false });
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await app.prisma.tarea.deleteMany();
  await app.prisma.empleado.deleteMany();
});

test('POST /empleados creates and returns 201', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/empleados',
    payload: { nombre: 'Ana', fechaIngreso: '2026-01-15', salario: 3500.5 },
  });
  expect(res.statusCode).toBe(201);
  expect(res.json()).toMatchObject({ id: expect.any(Number), nombre: 'Ana' });
});
```

**Rationale:**

- Vitest's ESM-native runner, native Vite tooling, and compatible Jest API is the modern default. Matches CH5's frontend testing choice in advance.
- Tests hit the real CH2 Postgres so Prisma constraints (FK restrict, unique, decimal precision) behave exactly as in prod. Faster than mocking and catches more bugs.
- `beforeEach` truncates test data — not migrations. Migrations run once via a `globalSetup` that does `prisma migrate deploy && prisma db seed`.
- `test:integration` runs against `DATABASE_URL` (the dev DB). A future CH7 CI step can swap it for a dedicated container.

**Alternatives:**

- **Jest** — rejected, slower ESM story, config-heavy. Matches the "boring modern defaults" vibe but loses on perf.
- **Supertest against a listening server** — rejected (see buildApp decision).
- **Testcontainers + disposable Postgres per test file** — overkill for 18 endpoints; defer to CH7 if flakiness shows up.

### Logging: Pino with `pino-pretty` in dev

Fastify's default Pino logger. In dev (`NODE_ENV=development`), pipe to `pino-pretty` for human-readable output. In test (`NODE_ENV=test`), disable logging by default to keep Vitest output clean (tests can opt in). In prod, structured JSON to stdout (Konecta's log aggregator eats JSON).

**Rationale:** single-line, out-of-box, request-ids propagated for every log in a request's context — one less thing to bikeshed.

### Tarea state transitions driven by `estado.cambiosPermitidos`, not hardcoded

`PUT /tareas/:id/estado` body: `{ idEstado: number }`. Handler:

1. Load current tarea + its current estado.
2. Read `currentEstado.cambiosPermitidos` (CSV of estado names allowed next).
3. Load the target estado by id.
4. If `cambiosPermitidos` is null → the current estado is terminal → `400` "Invalid state transition".
5. If the target estado's `nombre` is not in the CSV → `400` "Invalid state transition".
6. Otherwise update `idEstado` and return the updated tarea.

**Rationale:**

- The legacy's hardcoded `estados` object (`'Emitida' → 'Iniciada' → …`) assumed 12 rows; CH3's seed has 3 rows (`pendiente`, `en-progreso`, `finalizada`). Hardcoding the 12-state flow would be dead code.
- The `cambiosPermitidos` CSV is already on the model (CH3 preserved it). Driving transitions from data means admins can extend the catalogue without redeploying the API.

**Trade-off:** CSV parsing in Postgres is ugly (`'a,b'.includes('a')` is substring-unsafe). The handler splits by comma and trims — correct. When we have a real need for multiple-transition metadata (roles, reasons), we convert to a join table — deferred.

### `POST /tareas` resolves initial estado by name, default `pendiente`

`POST /tareas` accepts optional `estadoNombre?: string` (default `'pendiente'`). Handler looks up the estado by `findUnique({ where: { nombre } })` (unique constraint from CH3) and uses its id. `404` if the name does not exist.

**Rationale:** removes the legacy's hardcoded `'Emitida'` magic string that was pointing at a nonexistent row under the new seed.

### URL pluralisation: `/estados` (not legacy's `/estado`)

**BREAKING** relative to legacy. Legacy used `/estado` (singular) and `/estados` does not exist.

**Rationale:** REST convention is plural for collections. Legacy's singular was a leak from the Sequelize `Estado.define` name; fixing it here costs nothing because the frontend has not been ported yet (CH5 will consume `/estados` from day one). Empleados and tareas were already plural in legacy.

### Known bug fixes (all pre-approved by the refoundation plan)

| Legacy file:line | Bug | CH4 fix |
|---|---|---|
| `helpers/validateHelper.js:8` | Validation returns `403` | AJV hook returns `400` via problem envelope |
| `controllers/tareasController.js:203` | SQL injection via `sequelize.literal` | Parameterized Prisma `where` clause |
| `database/database.js:3` | Hardcoded creds | `@fastify/env` + `DATABASE_URL` |
| `controllers/estadoController.js:12-17` | POST validator wants `estado`, controller reads `{ estado, categoria }` | Single AJV body schema: `{ nombre, categoria, cambiosPermitidos? }` |
| `controllers/tareasController.js:42` | Hardcoded `'Emitida'` for initial estado | Default `'pendiente'`, resolved by name |
| `routes/EstadoRouter.js:7` | Singular `/estado` | Plural `/estados` |
| `controllers/*.js` (all) | Raw `error.message` leaked on 500 | Single `setErrorHandler` with sanitized envelope |

## Risks / Trade-offs

- **[Schema-first adds upfront ceremony]** → Mitigation: scaffolded schemas per resource (params/query/body/response) in `src/schemas/*.ts` — copy-paste-edit. The one-time cost pays back on CH6 (OpenAPI) and on the first runtime bug we catch at the edge instead of in a controller.
- **[Zod + AJV dual stack in env.ts only]** → Mitigation: the bridge lives in one file (`src/config/env.ts`) and is well-documented. Routes are AJV-only (no Zod) so the dual stack does not spread.
- **[Tests hit real DB → flaky in parallel]** → Mitigation: Vitest runs test files in a single worker by default when `DATABASE_URL` is shared; we set `vitest --pool=forks --poolOptions.forks.singleFork=true` in the `test` script until CH7 introduces dedicated per-run DBs. Stated in `CLAUDE.md`.
- **[`@fastify/env` schema drift between Zod and AJV]** → Mitigation: the conversion happens at boot, same process — drift is impossible at runtime. A unit test asserts `envZ.parse(process.env)` matches `app.config` shape.
- **[Legacy still reachable on port 4000]** → Mitigation: CH4's Fastify **also** binds port 4000 by default (matches legacy). In practice only one of the two runs at a time; the developer picks. `CLAUDE.md` notes this. CH8 deletes `legacy/` entirely.
- **[State transitions defined in a CSV column]** → Known sharp edge. Documented. Conversion to a join table is a future change, not a CH4 blocker.
- **[No rate limiting, no helmet]** → Conscious trade-off: the app is LAN-only and internal. Adding rate-limit/helmet is a 10-line change in a follow-up, not a structural concern.

## Migration Plan

- **Rollout:** `pnpm install && pnpm db:up && pnpm db:migrate:deploy && pnpm db:seed && pnpm --filter @employeek/api dev`. The last command boots Fastify on `http://localhost:4000`.
- **Rollback:** revert the branch. Everything is additive to `apps/api` — no files shared with legacy, no DB schema changes on top of CH3.
- **Legacy coexistence:** legacy still binds port 4000 if you `cd legacy && npm run dev`. To run both simultaneously (only useful for a side-by-side compare), override `PORT=4001` in `apps/api/.env` for that session — but the documented workflow is one or the other, not both.
- **Frontend readiness:** CH5 will point at `http://localhost:4000`. CORS allowlists `http://localhost:5173` by default, so no config needed in CH5's first boot.

## Open Questions

None at proposal time. One item we deliberately defer: whether to add a typed client package (`@employeek/api-types`) next to CH6. The design above does not block either outcome — CH6 can either generate a client from the Fastify OpenAPI doc, or we wrap the Zod/JSON Schema definitions into a published package. Both paths work with the schema-first route layout this change establishes.
