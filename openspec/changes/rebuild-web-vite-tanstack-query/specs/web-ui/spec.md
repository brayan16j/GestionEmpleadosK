## ADDED Requirements

### Requirement: Vite + React 18 + TypeScript strict owns the `apps/web` build

The `apps/web` workspace SHALL be a Vite 5.x SPA using React 18.x, TypeScript strict, `@vitejs/plugin-react-swc`, and `extends "../../packages/tsconfig/react.json"`. No other frontend framework (Next.js, Remix, CRA) SHALL be present.

#### Scenario: Vite dev server boots on 5173

- **WHEN** a developer runs `pnpm --filter @employeek/web dev` with a default `.env`
- **THEN** Vite logs that it is serving on `http://localhost:5173`, opens an HTTP listener there, and the page returns a 200 with a React root rendered

#### Scenario: TypeScript strict is enforced

- **WHEN** a developer introduces a file with `any` or an unchecked `as` cast in `apps/web/src/`
- **THEN** `pnpm --filter @employeek/web typecheck` fails with a `noImplicitAny` / unchecked-assignment error

#### Scenario: No unsupported framework dependencies

- **WHEN** inspecting `apps/web/package.json`
- **THEN** neither `next`, `@remix-run/*`, nor `react-scripts` appears in `dependencies` or `devDependencies`

### Requirement: Single HTTP helper parses the RFC 7807 problem envelope

The web app SHALL route every API call through `src/lib/http.ts`, which reads `import.meta.env.VITE_API_URL` (default `http://localhost:4000`), sets `Content-Type: application/json` for requests with a body, and on any `response.ok === false` parses the response as `application/problem+json` and throws an `ApiProblem` error carrying `{ type, title, status, detail, instance, traceId, errors? }`. No React component or query hook SHALL call the global `fetch` directly.

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

### Requirement: TanStack Query owns server state

The web app SHALL wrap its tree in `QueryClientProvider` and expose every read as a `useQuery` hook and every write as a `useMutation` hook. Query keys SHALL be stable, hierarchical arrays (e.g., `['empleados']`, `['empleados', id]`, `['tareas', { categoria }]`). Mutations SHALL call `queryClient.invalidateQueries({ queryKey: [...] })` after success so lists refetch without manual reload. TanStack Query Devtools SHALL be enabled in development builds.

#### Scenario: List hook caches results

- **WHEN** two components mount simultaneously and both call `useEmpleados()`
- **THEN** exactly one network request fires, and both components render from the shared cache

#### Scenario: Mutation invalidates the affected list

- **WHEN** a component calls a `useCreateEmpleado()` mutation that succeeds
- **THEN** the `['empleados']` query is invalidated and the list view refetches without the user clicking reload

#### Scenario: Devtools are available in dev

- **WHEN** the app runs under `pnpm dev`
- **THEN** the TanStack Query floating panel is reachable via its trigger button

#### Scenario: Query errors throw into the nearest error boundary

- **WHEN** a `useQuery` hook errors with a 5xx `ApiProblem`
- **THEN** the React error boundary above the route catches it and renders a fallback instead of crashing the whole app

### Requirement: React Router v6 data router owns navigation

The app SHALL use `createBrowserRouter` from `react-router-dom` v6 with an explicit route tree. Routes SHALL include at minimum `/`, `/empleados`, `/empleados/:id`, `/empleados/nuevo`, `/estados`, `/tareas`, `/tareas/:id`, and a catch-all `*` 404 route. Navigation SHALL happen via `<Link>` / `useNavigate`, never via raw `<a href>` for internal targets.

#### Scenario: Direct-URL load renders the right route

- **WHEN** the user opens `http://localhost:5173/empleados/42` in a fresh tab
- **THEN** the detail view for empleado 42 mounts and issues its query without a redirect

#### Scenario: 404 route catches unknown paths

- **WHEN** the user navigates to `/does-not-exist`
- **THEN** the catch-all route renders a "Page not found" view with a link back to `/`

#### Scenario: Internal links use router navigation

- **WHEN** the user clicks an internal link, e.g. from the empleados list to a detail page
- **THEN** the URL updates without a full page reload and the QueryClient cache is preserved

### Requirement: Forms use React Hook Form + Zod with per-field error mapping

Every form in `apps/web` SHALL use `react-hook-form` with `@hookform/resolvers/zod` and a Zod schema colocated under `src/features/<resource>/schemas.ts`. Submit handlers SHALL call a mutation hook; on `ApiProblem.errors`, the handler SHALL call a shared helper `applyProblemToForm(problem, form)` that translates each `errors[i].path` (e.g., `body/salario`) into the matching RHF field error. Top-level errors without a field target SHALL surface as a toast.

#### Scenario: Field-level validation shows before submit

- **WHEN** the user leaves `salario` empty and clicks submit on the "new empleado" form
- **THEN** the form does not call the mutation and the `salario` input shows the Zod-derived error message

#### Scenario: API 400 maps to the right field

- **WHEN** a submit fires and the API returns a 400 problem with `errors: [{ path: "body/salario", message: "must be >= 0" }]`
- **THEN** the `salario` input renders that message inline and no toast is shown

#### Scenario: API 409/422 without field path shows a toast

- **WHEN** a create-estado submit fires and the API returns 409 `{ title: "Conflict", detail: "A record with the same nombre already exists" }` with no `errors` array
- **THEN** a toast appears with `title` as the heading and `detail` as the body

### Requirement: Feature parity with FRONTK1 across empleados, estados, and tareas

The SPA SHALL implement the following user-visible features in `apps/web/src/features/`:

- **empleados:** list with columns (id, nombre, fechaIngreso, salario), detail page, create form, update form, delete action with confirmation dialog, and an "empleado's tareas" panel on the detail page.
- **estados:** list, create form, update form, delete action with confirmation dialog (disabled or showing a meaningful error when the estado is in use).
- **tareas:** list (with empleado and estado names rendered), detail page, create form (prefilling `estadoNombre = 'pendiente'` when left blank), update form for non-estado fields, a dedicated "cambiar estado" modal backed by `PUT /tareas/:id/estado`, a categoria filter dropdown driving `GET /tareas/categoria/:categoria`, delete action with confirmation.

No screen SHALL reference the legacy frontend at `D:\Proyectos Konecta\FRONTK1` at build or runtime; components SHALL be authored fresh.

#### Scenario: Empleados list shows seeded and newly-created rows

- **WHEN** the user navigates to `/empleados` after creating Ana via the form
- **THEN** the table shows Ana's row with the values just submitted

#### Scenario: Deleting an empleado with tareas shows a friendly error

- **WHEN** the user confirms delete on an empleado with at least one tarea
- **THEN** the mutation rejects with a 422 `ApiProblem`, a toast surfaces the title "Unprocessable Entity" and the detail "Foreign key constraint failed on foreign key", and the row is NOT removed from the list

#### Scenario: Tarea state transition enforces allowed moves

- **WHEN** a tarea is in `finalizada` and the user opens "cambiar estado" and picks `pendiente`
- **THEN** the submit fires, the API returns 400 `Invalid state transition`, and the modal renders that detail inline without closing

#### Scenario: Categoria filter drives the list query

- **WHEN** the user picks "activa" from the tareas categoria dropdown
- **THEN** the table shows only tareas whose estado's categoria is `activa`, backed by `GET /tareas/categoria/activa`

#### Scenario: Create tarea defaults to `pendiente`

- **WHEN** the user creates a new tarea without selecting an `estadoNombre`
- **THEN** the POST body omits the field, the API applies the default, and the created row shows `estadoNombre: "pendiente"`

### Requirement: Tailwind v3 + a curated shadcn/ui primitive set styles the app

The app SHALL use Tailwind CSS v3 with a `tailwind.config.ts` covering `src/**/*.{ts,tsx,html}` and an inline content-based purge. A minimal set of shadcn/ui source components SHALL live under `src/components/ui/` (Button, Input, Label, Select, Dialog, Table, Toast). No external UI kit (MUI, Chakra, Ant) SHALL be installed.

#### Scenario: Tailwind classes apply in production build

- **WHEN** a developer runs `pnpm --filter @employeek/web build`
- **THEN** the generated `dist/assets/*.css` contains the utilities actually used by `src/**/*.tsx` and excludes unused ones

#### Scenario: No competing UI kit present

- **WHEN** inspecting `apps/web/package.json`
- **THEN** no `@mui/*`, `@chakra-ui/*`, `antd`, or `@mantine/*` dependency appears

### Requirement: Vitest + Testing Library covers forms and error rendering

`apps/web` SHALL ship a Vitest setup using `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, and `jsdom`. Test files SHALL live under `apps/web/test/` mirroring `src/`. For each resource (empleados, estados, tareas) there SHALL be at least one happy-path form submission test and at least one 4xx error-rendering test that mocks the HTTP layer and asserts the inline field error or toast copy.

#### Scenario: Test runner is wired

- **WHEN** a developer runs `pnpm --filter @employeek/web test`
- **THEN** Vitest executes every file matching `test/**/*.test.{ts,tsx}` and reports a non-zero exit code when any assertion fails

#### Scenario: Happy-path submit asserts the mutation payload

- **WHEN** the empleados create-form test fills valid fields and clicks submit
- **THEN** the mocked HTTP helper is called with `POST /empleados` and the expected body, and the test passes

#### Scenario: 422 FK error surfaces in the UI

- **WHEN** the empleados delete-confirmation test triggers the mutation with a mocked 422 envelope
- **THEN** a toast containing the envelope's `title` appears in the rendered output

### Requirement: Turbo and CLAUDE.md wire the workspace

`apps/web/package.json` SHALL declare `dev`, `build`, `preview`, `lint`, `typecheck`, and `test` scripts consumable by Turbo. `turbo.json` SHALL gain a `preview` task definition without touching the existing `dev`/`build`/`test`/`lint`/`typecheck` entries. `CLAUDE.md` SHALL document (a) the new `pnpm dev` behavior (both API and web boot together), (b) the single env var `VITE_API_URL`, (c) the location of the HTTP client and the error-model rule, and (d) a reminder that FRONTK1 remains quarantined.

#### Scenario: `pnpm dev` boots both apps

- **WHEN** a developer runs `pnpm dev` from the repo root
- **THEN** the API listens on `4000`, the web dev server listens on `5173`, and the web app can fetch `/empleados` without CORS errors

#### Scenario: `pnpm build` caches on the second run

- **WHEN** the developer runs `pnpm build`, touches no files, then runs `pnpm build` again
- **THEN** the second run is a Turbo cache hit for both `@employeek/api` and `@employeek/web` and completes in under 2 seconds

#### Scenario: CLAUDE.md documents the web workflow

- **WHEN** a reader opens `CLAUDE.md`
- **THEN** there is a "Web app" (or equivalent) section that names `VITE_API_URL`, points at `src/lib/http.ts`, references the RFC 7807 error model, and states that FRONTK1 is quarantined

### Requirement: Environment defaults live in `.env.example` and Vite-prefixed vars

`.env.example` SHALL include a new entry `VITE_API_URL=http://localhost:4000` with a one-line comment. The web app SHALL read it via `import.meta.env.VITE_API_URL` and SHALL NOT read any env var that is not prefixed with `VITE_`.

#### Scenario: Missing `VITE_API_URL` falls back to the default

- **WHEN** a developer omits `VITE_API_URL` from `.env`
- **THEN** the dev server boots, `http()` uses `http://localhost:4000`, and requests to `/health` succeed assuming the API is running

#### Scenario: Non-`VITE_` var is not exposed to the client

- **WHEN** a developer adds `SECRET=xyz` to `.env` and tries to read `import.meta.env.SECRET` from a component
- **THEN** the value is `undefined` at runtime and Vite does NOT bundle the string into the output
