# Spec delta — `web-ui`

## MODIFIED Requirements

### Requirement: Single HTTP helper parses the RFC 7807 problem envelope

The web app SHALL route every API call through `src/lib/http.ts`, which reads `import.meta.env.VITE_API_URL` (default `http://localhost:4000`), sets `Content-Type: application/json` for requests with a body, and on any `response.ok === false` parses the response as `application/problem+json` and throws an `ApiProblem` error carrying `{ type, title, status, detail, instance, traceId, errors? }`. No React component or query hook SHALL call the global `fetch` directly.

The exported `http` function SHALL be typed against the OpenAPI `paths` map from `@employeek/api-types`. Its signature SHALL constrain `path` to literal endpoint patterns documented in the contract (e.g., `'/empleados'`, `'/empleados/{id}'`), `method` to the verbs documented for that path, `body` (when present) to `RequestBody<P, M>`, and the resolved promise to `ResponseBody<P, M, 2xx>`. Path placeholders such as `{id}` SHALL be filled in at the call site by the caller (the helper does not auto-substitute), but the type system SHALL accept any string ending in a valid placeholder slot.

#### Scenario: Success path returns the parsed JSON body

- **WHEN** `http('GET', '/health')` is called against an API returning `200 { "status": "ok" }`
- **THEN** the promise resolves with `{ status: 'ok' }` and no error is thrown

#### Scenario: 4xx response is rethrown as `ApiProblem`

- **WHEN** the API returns `404` with body `{ "type": "...", "title": "Not Found", "status": 404, "detail": "...", "instance": "/empleados/999", "traceId": "abc-123" }`
- **THEN** `http()` rejects with an `ApiProblem` instance whose `.status === 404`, `.title === "Not Found"`, and `.traceId === "abc-123"`

#### Scenario: Validation error exposes field-level details

- **WHEN** the API returns `400` with `errors: [{ path: "body/salario", message: "must be >= 0" }]`
- **THEN** the thrown `ApiProblem.errors` array contains one entry with `path === "body/salario"` and `message === "must be >= 0"`

#### Scenario: No component calls `fetch` directly

- **WHEN** `pnpm --filter @employeek/web lint` runs on a file that imports the global `fetch` outside `src/lib/http.ts`
- **THEN** ESLint reports a `no-restricted-globals` (or equivalent) error for that import

#### Scenario: Calling an undocumented path is a type error

- **WHEN** a developer writes `http('GET', '/no-existe')` in any feature file
- **THEN** `pnpm --filter @employeek/web typecheck` fails with a "type '/no-existe' is not assignable to type ..." error pointing at the offending call site

#### Scenario: Posting an invalid body shape is a type error

- **WHEN** a developer writes `http('POST', '/empleados', { nombre: 'Ana' })` (missing `fechaIngreso` and `salario`)
- **THEN** `pnpm --filter @employeek/web typecheck` fails with a "missing properties from type 'RequestBody<\"/empleados\", \"post\">'" error

#### Scenario: Response body type derives from the contract

- **WHEN** a developer writes `const e = await http('GET', '/empleados/1')`
- **THEN** `e` is inferred as `Schema<'Empleado'>` from `@employeek/api-types`, with `e.salario` typed `string` and `e.id` typed `number`

## ADDED Requirements

### Requirement: Feature API modules consume types from `@employeek/api-types`

Every file `apps/web/src/features/<recurso>/api.ts` SHALL import request and response types from `@employeek/api-types` (via `Schema<...>`, `RequestBody<...>`, `ResponseBody<...>`) rather than from a local `schemas.ts` interface. Local domain interfaces (`Empleado`, `Tarea`, `Estado`, etc.) duplicating contract shapes SHALL be removed.

#### Scenario: `features/empleados/api.ts` types calls via the contract

- **WHEN** a developer reads `apps/web/src/features/empleados/api.ts` after this change
- **THEN** every `http(...)` call uses literal path/method arguments and infers the response type from `@employeek/api-types`; no `http<Empleado>(...)` generic argument appears

#### Scenario: Domain interfaces in `schemas.ts` are removed when redundant

- **WHEN** a developer searches `apps/web/src/features/` for `interface Empleado`, `interface Tarea`, or `interface Estado`
- **THEN** none of those interfaces exist; their use sites import `Schema<'Empleado'>` etc. from `@employeek/api-types`

#### Scenario: `schemas.ts` keeps zod schemas only for forms

- **WHEN** a developer reads `apps/web/src/features/<recurso>/schemas.ts`
- **THEN** the file contains only `z.object(...)` definitions used by React Hook Form resolvers and their `z.infer` types; no plain `interface` shadows the contract

### Requirement: `apps/web` declares `@employeek/api-types` as a workspace dependency

`apps/web/package.json` SHALL list `@employeek/api-types: workspace:*` under `dependencies`. The workspace symlink SHALL resolve at install time without manual setup.

#### Scenario: Fresh install resolves the workspace dep

- **WHEN** a developer runs `pnpm install` on a fresh clone after this change is applied
- **THEN** `apps/web/node_modules/@employeek/api-types` is a symlink to `packages/api-types` and `pnpm --filter @employeek/web typecheck` resolves the imports without errors

#### Scenario: Type-only import works after `pnpm api:types`

- **WHEN** a developer runs `pnpm api:types` then opens `apps/web/src/lib/http.ts` in their editor
- **THEN** the editor (TypeScript language service) shows the `paths` and `components` types as resolved from `@employeek/api-types/dist/index.d.ts` with no red squiggles
