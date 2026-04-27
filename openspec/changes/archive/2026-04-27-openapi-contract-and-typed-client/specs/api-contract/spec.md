# Spec delta — `api-contract` (NEW)

## ADDED Requirements

### Requirement: `apps/api` registers `@fastify/swagger` to derive an OpenAPI 3.1 document

The `apps/api` workspace SHALL declare `@fastify/swagger` (`^9` or later compatible with Fastify 5) as a runtime dependency and register it in `buildApp()` **before** any route plugin. The registered options SHALL set `openapi.openapi: "3.1.0"`, an `info` object with `title: "EmployeeK API"`, `version` sourced from `apps/api/package.json#version`, a `description`, and a `servers` array containing at minimum `http://localhost:4000`. The plugin SHALL pick up every route's `schema` block (`params`, `querystring`, `body`, `response`) and every JSON Schema with a `$id` so they appear under `components.schemas.<id>` in the generated document.

#### Scenario: `@fastify/swagger` is registered before routes

- **WHEN** a developer reads `apps/api/src/app.ts`
- **THEN** the file registers the swagger plugin between the CORS plugin and the first call to `app.register(*Routes, ...)`, so the plugin's `onRoute` hook captures every subsequent route

#### Scenario: `info.version` tracks the API package version

- **WHEN** `apps/api/package.json#version` is `0.2.0` and a developer fetches `/docs/json`
- **THEN** the response body contains `info.version: "0.2.0"` (no hard-coded literal in `app.ts`)

#### Scenario: Schemas with `$id` become reusable components

- **WHEN** `apps/api/src/schemas/empleado.ts` exports `empleadoSchema` with `$id: "Empleado"`
- **THEN** the generated OpenAPI document contains `components.schemas.Empleado` with the same shape, and `paths./empleados.get.responses.200.content.application/json.schema` is a `$ref: "#/components/schemas/Empleado"` reference rather than the schema inlined

### Requirement: Every route declares `tags`, `operationId`, `summary`, and `description`

Every route registered in `apps/api/src/routes/*.ts` SHALL declare in its `schema` block a non-empty `tags: string[]` (at least one), a unique camelCase `operationId`, a one-line `summary`, and a `description`. `operationId` SHALL match the convention `<verb><Resource>[<Qualifier>]` — examples: `listEmpleados`, `getEmpleado`, `createEmpleado`, `updateEmpleado`, `deleteEmpleado`, `listTareasForEmpleado`, `changeTareaEstado`, `listTareasByCategoria`. Routes SHALL NOT rely on Fastify's auto-generated `operationId` fallback.

#### Scenario: A route without `operationId` fails the lint check

- **WHEN** a developer adds a new route under `apps/api/src/routes/` without an `operationId` and runs `pnpm --filter @employeek/api typecheck` (or the equivalent route-metadata lint test)
- **THEN** the check fails naming the offending route, before the change can be merged

#### Scenario: Tags group routes by resource

- **WHEN** an external consumer opens `/docs` (Swagger UI) in the browser
- **THEN** the routes are grouped under `Empleados`, `Tareas`, `Estados`, and `Health` tabs — not flattened into a single list

### Requirement: OpenAPI document is served at `/docs/json` and Swagger UI at `/docs`

The app SHALL expose the raw OpenAPI document at `GET /docs/json` (`content-type: application/json`) and the Swagger UI HTML at `GET /docs` via `@fastify/swagger-ui`. Both endpoints SHALL be reachable without authentication. The UI SHALL load the JSON from the same origin (no CDN dependency for the spec itself).

#### Scenario: OpenAPI JSON endpoint returns a valid 3.1 document

- **WHEN** a client `GET`s `/docs/json` while the server is running
- **THEN** the response is `200 application/json` and the body parses as JSON whose `openapi` field starts with `"3.1"` and whose `paths` object contains every documented endpoint

#### Scenario: Swagger UI renders the document

- **WHEN** a developer opens `http://localhost:4000/docs` in a browser (NODE_ENV=development)
- **THEN** the browser shows the Swagger UI shell, lists every endpoint grouped by tag, and the "Try it out" feature is enabled

#### Scenario: UI is disabled in production by default

- **WHEN** the API boots with `NODE_ENV=production` and `OPENAPI_UI_ENABLED` unset
- **THEN** `GET /docs` returns `404` and `GET /docs/json` also returns `404`

#### Scenario: UI can be re-enabled in production via env

- **WHEN** the API boots with `NODE_ENV=production` and `OPENAPI_UI_ENABLED=true`
- **THEN** both `/docs` and `/docs/json` return `200`

### Requirement: New env var `OPENAPI_UI_ENABLED` controls doc exposure

`apps/api/src/config/env.ts` SHALL extend the `envZ` Zod schema with `OPENAPI_UI_ENABLED: boolean` (parsed from string `'true'`/`'false'`). The default SHALL be `true` for `NODE_ENV` in `development` or `test`, and `false` for `production`. `.env.example` SHALL document this variable with an inline comment. `app.config.OPENAPI_UI_ENABLED` SHALL be typed as `boolean`.

#### Scenario: Default flips with NODE_ENV

- **WHEN** `.env` omits `OPENAPI_UI_ENABLED` and `NODE_ENV=development`
- **THEN** `app.config.OPENAPI_UI_ENABLED === true`
- **WHEN** the same `.env` is used with `NODE_ENV=production`
- **THEN** `app.config.OPENAPI_UI_ENABLED === false`

#### Scenario: Explicit override wins

- **WHEN** `.env` contains `OPENAPI_UI_ENABLED=false` and `NODE_ENV=development`
- **THEN** `app.config.OPENAPI_UI_ENABLED === false` and `/docs` returns `404`

### Requirement: `apps/api` exposes a script to dump the OpenAPI snapshot

The `apps/api` workspace SHALL expose a script `openapi:dump` in its `package.json` that invokes `tsx scripts/dump-openapi.ts`. The script SHALL boot the app in test mode (`buildApp({ logger: false })`), call `app.swagger()`, write the result to `packages/api-types/openapi.json` (formatted JSON with two-space indentation and trailing newline), and exit with code `0`. The script SHALL NOT require a running database — it MUST complete even if Postgres is down.

#### Scenario: Dump succeeds with the database stopped

- **WHEN** a developer stops the Docker Postgres container and runs `pnpm --filter @employeek/api openapi:dump`
- **THEN** the script exits with code `0`, prints a one-line success log, and `packages/api-types/openapi.json` is updated

#### Scenario: Dump output is deterministic

- **WHEN** a developer runs `pnpm --filter @employeek/api openapi:dump` twice in a row without changing any source
- **THEN** `git diff packages/api-types/openapi.json` reports no changes after the second run

#### Scenario: Root convenience script proxies to the workspace

- **WHEN** a developer runs `pnpm api:openapi` from the repo root
- **THEN** Turbo (or the root `package.json` script) invokes `pnpm --filter @employeek/api openapi:dump` and the snapshot file is updated identically

### Requirement: A test enforces that the snapshot matches the live document

`apps/api/test/openapi-snapshot.test.ts` SHALL exist and SHALL compare `app.swagger()` (from a fresh `buildApp({ logger: false })`) against the contents of `packages/api-types/openapi.json`. If the two differ, the test SHALL fail with a message instructing the developer to run `pnpm api:types`.

#### Scenario: Snapshot in sync — test passes

- **WHEN** `packages/api-types/openapi.json` matches `app.swagger()` byte-for-byte and `pnpm --filter @employeek/api test` is run
- **THEN** the snapshot test passes

#### Scenario: Snapshot drift — test fails with actionable error

- **WHEN** a developer adds a new route and forgets to regenerate the snapshot
- **THEN** the snapshot test fails with `Error: OpenAPI snapshot is out of date. Run 'pnpm api:types' to regenerate.`

### Requirement: `packages/api-types` is a workspace published as `@employeek/api-types`

The repository SHALL contain a new workspace at `packages/api-types/` registered in `pnpm-workspace.yaml` (already covered by the `packages/*` glob). Its `package.json` SHALL declare `name: "@employeek/api-types"`, `version: "0.0.0"` (internal-only, never published to npm), `type: "module"`, `main: "./dist/index.js"`, `types: "./dist/index.d.ts"`, an `exports` map that exposes `"."` to `./dist/index.js` and the type file, and `files: ["dist", "openapi.json"]`. `private: true` SHALL be set.

#### Scenario: Package is detected by pnpm

- **WHEN** a developer runs `pnpm install` on a fresh clone after this change is applied
- **THEN** `pnpm m ls --depth -1` lists `@employeek/api-types` among the workspaces and `apps/web/node_modules/@employeek/api-types` is a workspace symlink

#### Scenario: Package is private

- **WHEN** a developer runs `pnpm publish --filter @employeek/api-types --dry-run`
- **THEN** pnpm refuses to publish because `private: true` is set in the package's `package.json`

### Requirement: `@employeek/api-types` generates types via `openapi-typescript`

The `packages/api-types` workspace SHALL declare `openapi-typescript` (`^7` or compatible) as a devDependency. Its `build` script SHALL invoke `openapi-typescript ./openapi.json -o ./src/generated.ts`, then run `tsc --build` to emit `dist/index.d.ts` and `dist/index.js`. The generated file `src/generated.ts` SHALL be gitignored (regenerated each build) but `openapi.json` SHALL be committed.

#### Scenario: Build produces type declarations from the snapshot

- **WHEN** a developer runs `pnpm --filter @employeek/api-types build`
- **THEN** `packages/api-types/src/generated.ts` is regenerated from `openapi.json`, `dist/index.d.ts` exports `paths` and `components` interfaces, and `dist/index.js` is a stub (no runtime types)

#### Scenario: Snapshot is the only input to the type build

- **WHEN** a developer modifies `packages/api-types/openapi.json` by hand (without changing the API) and runs `pnpm --filter @employeek/api-types build`
- **THEN** the build succeeds using only the snapshot as input — it does NOT need to boot the API

#### Scenario: Generated artifact is gitignored

- **WHEN** a developer inspects `packages/api-types/.gitignore` (or the repo-root `.gitignore`)
- **THEN** `src/generated.ts` and `dist/` are listed as ignored, while `openapi.json` is tracked

### Requirement: `@employeek/api-types` exports ergonomic helper types

`packages/api-types/src/index.ts` SHALL re-export `paths` and `components` from `./generated.ts`, and SHALL define and export the helper types `Schema<K>`, `RequestBody<P, M>`, and `ResponseBody<P, M, S>` so consumers can write `Schema<'Empleado'>`, `RequestBody<'/empleados', 'post'>`, `ResponseBody<'/empleados/{id}', 'get', 200>` without writing nested conditional types themselves.

#### Scenario: `Schema<K>` resolves to a component schema

- **WHEN** a TypeScript consumer writes `import type { Schema } from '@employeek/api-types'; const e: Schema<'Empleado'> = { id: 1, nombre: 'Ana', fechaIngreso: '2026-01-15', salario: '3500.50', createdAt: '...', updatedAt: '...' };`
- **THEN** the type-checker accepts the assignment and rejects it if any required field is missing

#### Scenario: `RequestBody<P, M>` resolves to the documented body

- **WHEN** a consumer writes `RequestBody<'/empleados', 'post'>`
- **THEN** the resolved type is structurally `{ nombre: string; fechaIngreso: string; salario: number }` (the `CreateEmpleadoBody` schema)

#### Scenario: `ResponseBody<P, M, S>` resolves to the 2xx body by default

- **WHEN** a consumer writes `ResponseBody<'/empleados/{id}', 'get', 200>`
- **THEN** the resolved type is the `Empleado` component schema, not the `ProblemEnvelope` (which is the 404 response)

### Requirement: Root scripts orchestrate the contract pipeline through Turbo

The repo-root `package.json` SHALL expose two scripts:

- `api:openapi` — proxies to `pnpm --filter @employeek/api openapi:dump`.
- `api:types` — runs `api:openapi` then `pnpm --filter @employeek/api-types build`.

`turbo.json` SHALL declare `@employeek/api-types#build` with `dependsOn: ["@employeek/api#openapi:dump"]` and `inputs: ["openapi.json", "src/**", "tsconfig.json"]`, so a root-level `pnpm build` produces type packages without manual ordering.

#### Scenario: `pnpm build` orders the contract pipeline correctly

- **WHEN** a developer runs `pnpm build` from a clean state
- **THEN** Turbo executes `@employeek/api#openapi:dump` before `@employeek/api-types#build` and both succeed without an "openapi.json not found" error

#### Scenario: `pnpm api:types` is idempotent

- **WHEN** a developer runs `pnpm api:types` twice in a row without changing any source
- **THEN** the second run is mostly a Turbo cache hit and `git status` reports no changes
