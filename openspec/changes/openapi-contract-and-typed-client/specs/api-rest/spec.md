# Spec delta — `api-rest`

## ADDED Requirements

### Requirement: Every route in `apps/api` declares OpenAPI metadata

In addition to the existing AJV schema requirement, every route registered in `apps/api/src/routes/*.ts` SHALL declare in its `schema` block the OpenAPI metadata fields `tags: string[]` (non-empty), `operationId: string` (camelCase, unique across the app), `summary: string` (one line), and `description: string` (longer prose, may span multiple sentences). These fields are consumed by `@fastify/swagger` to produce the OpenAPI document and SHALL NOT be omitted in favor of auto-generated fallbacks.

`operationId` SHALL follow the convention `<verb><Resource>[<Qualifier>]`. Examples drawn from the current routes:

- `listEmpleados`, `getEmpleado`, `createEmpleado`, `updateEmpleado`, `deleteEmpleado`, `listTareasForEmpleado`
- `listEstados`, `getEstado`, `createEstado`, `updateEstado`, `deleteEstado`
- `listTareas`, `getTarea`, `listTareasByCategoria`, `createTarea`, `updateTarea`, `changeTareaEstado`, `deleteTarea`
- `livenessCheck`, `readinessCheck`

#### Scenario: Existing route gains OpenAPI metadata

- **WHEN** a developer reads any handler in `apps/api/src/routes/empleados.ts` after this change is applied
- **THEN** every `app.<verb>(...)` call's `schema` includes `tags: ["Empleados"]`, a unique `operationId`, a `summary`, and a `description`

#### Scenario: Route without `operationId` fails the boot/test check

- **WHEN** a developer adds a new route under `apps/api/src/routes/` and forgets to declare `operationId`
- **THEN** either the boot-time `onRoute` check throws (preferred) or the snapshot test fails — the change cannot land without metadata

#### Scenario: `operationId` values are unique across the app

- **WHEN** the OpenAPI document is generated
- **THEN** every `paths.<path>.<method>.operationId` value is unique; no two routes share the same id

### Requirement: `buildApp()` registers `@fastify/swagger` and (conditionally) `@fastify/swagger-ui`

`buildApp()` SHALL register `@fastify/swagger` after CORS but before any route plugin. When `app.config.OPENAPI_UI_ENABLED === true`, `buildApp()` SHALL also register `@fastify/swagger-ui` exposing the UI at `/docs` and the raw doc at `/docs/json`. When `OPENAPI_UI_ENABLED === false`, neither route SHALL be registered (the URLs return `404`).

#### Scenario: Doc routes appear in dev/test

- **WHEN** `buildApp()` is invoked with `NODE_ENV=test` (default `OPENAPI_UI_ENABLED=true`)
- **THEN** `app.inject({ method: 'GET', url: '/docs/json' })` returns `200` with a valid OpenAPI document, and `app.inject({ method: 'GET', url: '/docs' })` returns `200` with HTML

#### Scenario: Doc routes are absent when disabled

- **WHEN** `buildApp()` runs with `OPENAPI_UI_ENABLED=false`
- **THEN** `app.inject({ method: 'GET', url: '/docs/json' })` returns `404` and the route is not in the registered routes list

### Requirement: `OPENAPI_UI_ENABLED` is part of the env contract

`apps/api/src/config/env.ts` SHALL extend `envZ` with `OPENAPI_UI_ENABLED: boolean` (Zod `.coerce` from string `'true'`/`'false'`). The default SHALL be `true` for `NODE_ENV` in `development` or `test`, and `false` for `production`. `app.config.OPENAPI_UI_ENABLED` SHALL be typed as `boolean`. `.env.example` SHALL document the variable with an inline comment explaining the prod default.

#### Scenario: Default is environment-derived

- **WHEN** `.env` omits `OPENAPI_UI_ENABLED` and `NODE_ENV=development`
- **THEN** `app.config.OPENAPI_UI_ENABLED === true`

#### Scenario: Production locks the docs by default

- **WHEN** the API starts with `NODE_ENV=production` and no override
- **THEN** `app.config.OPENAPI_UI_ENABLED === false` and the doc routes return `404`

#### Scenario: Explicit env var overrides the default

- **WHEN** `.env` sets `OPENAPI_UI_ENABLED=true` and `NODE_ENV=production`
- **THEN** `app.config.OPENAPI_UI_ENABLED === true` and the doc routes return `200`

### Requirement: A snapshot test enforces no drift between code and `openapi.json`

`apps/api/test/openapi-snapshot.test.ts` SHALL exist and SHALL fail when `app.swagger()` (from a fresh `buildApp({ logger: false })`) does not match `packages/api-types/openapi.json` byte-for-byte (after the same JSON formatting the dump script uses). The failure message SHALL include the literal string `Run 'pnpm api:types' to regenerate.`.

#### Scenario: Snapshot in sync — `pnpm test` passes

- **WHEN** the snapshot file matches the generated document and a developer runs `pnpm --filter @employeek/api test`
- **THEN** the snapshot test passes alongside the existing endpoint tests

#### Scenario: Drift surfaces in `pnpm test`

- **WHEN** a developer modifies a route's `summary` and forgets to regenerate
- **THEN** `pnpm --filter @employeek/api test` exits non-zero and the failure message includes `Run 'pnpm api:types' to regenerate.`
