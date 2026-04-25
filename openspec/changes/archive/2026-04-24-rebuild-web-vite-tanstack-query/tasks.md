## 1. Prerequisites

- [x] 1.1 Confirm branch `feat/rebuild-web-vite-tanstack-query` is checked out and the working tree is clean
- [x] 1.2 Verify the CH4 API boots: `pnpm db:up && pnpm --filter @employeek/api dev` → `curl http://localhost:4000/health` returns `200 {"status":"ok"}`
- [x] 1.3 Read `openspec/changes/rebuild-web-vite-tanstack-query/{proposal,design}.md` and `specs/web-ui/spec.md` end-to-end
- [x] 1.4 Skim FRONTK1 (`D:\Proyectos Konecta\FRONTK1\src/`) to refresh memory on the screens we're porting (do not modify anything there)

## 2. Install dependencies

- [x] 2.1 Add runtime deps to `apps/web`: `pnpm --filter @employeek/web add react react-dom react-router-dom @tanstack/react-query @tanstack/react-query-devtools react-hook-form @hookform/resolvers zod class-variance-authority clsx lucide-react sonner`
- [x] 2.2 Add dev deps: `pnpm --filter @employeek/web add -D vite @vitejs/plugin-react-swc @types/react @types/react-dom vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom tailwindcss postcss autoprefixer tailwindcss-animate`
- [x] 2.3 Record the actual installed majors in `proposal.md`'s Impact section (match reality, not guesses)
- [x] 2.4 Run `pnpm install` at the repo root and confirm the lockfile refreshes cleanly

## 3. Workspace config

- [x] 3.1 Update `apps/web/tsconfig.json` to `extends "../../packages/tsconfig/react.json"` with `compilerOptions.paths` = `{ "@/*": ["./src/*"] }` and `include: ["src", "test"]`
- [x] 3.2 Create `apps/web/vite.config.ts`: react-swc plugin, `resolve.alias['@'] = path.resolve(__dirname, 'src')`, `server.port = 5173`, `test` block for Vitest (jsdom, globals, setup file)
- [x] 3.3 Create `apps/web/tailwind.config.ts` with `content: ['./index.html', './src/**/*.{ts,tsx}']`, `theme.extend = {}`, `plugins: [require('tailwindcss-animate')]`
- [x] 3.4 Create `apps/web/postcss.config.js` with `tailwindcss` and `autoprefixer`
- [x] 3.5 Create `apps/web/index.html` with a `<div id="root">` and the Vite module entry
- [x] 3.6 Replace `apps/web/package.json` scripts with `dev`/`build`/`preview`/`lint`/`typecheck`/`test`/`test:watch`; keep `name: @employeek/web`, `type: module`
- [x] 3.7 Add `apps/web/.eslintrc` or wire the flat config so it pulls `@employeek/eslint-config` plus React + Testing Library rules; add a `no-restricted-globals` rule for `fetch` outside `src/lib/http.ts`
- [x] 3.8 Update root `turbo.json` to declare a `preview` task with `cache: false, persistent: true` (mirrors `dev`)

## 4. HTTP client + error model (`src/lib/http.ts`, `src/lib/problem.ts`)

- [x] 4.1 Create `src/lib/problem.ts` exporting `type ProblemEnvelope`, `class ApiProblem extends Error { status; title; detail?; instance?; traceId; errors? }` with a constructor that hydrates from a parsed envelope
- [x] 4.2 Create `src/lib/http.ts` exporting `async function http<T>(method, path, body?): Promise<T>`: prefix `import.meta.env.VITE_API_URL`, set JSON headers when `body` is defined, on `!response.ok` parse JSON and throw `new ApiProblem(envelope)`
- [x] 4.3 Write a unit test `test/lib/http.test.ts`: happy-path 200, 404 problem throws `ApiProblem` with expected fields, 400 with `errors[]` throws with the array preserved
- [x] 4.4 Write `src/lib/applyProblemToForm.ts` that takes `(problem: ApiProblem, form: UseFormReturn)` and maps each `errors[i].path` (e.g. `body/salario` → field `salario`) onto RHF field errors; unit-test it in `test/lib/applyProblemToForm.test.ts`

## 5. App shell (`src/main.tsx`, `src/App.tsx`, router, QueryClient)

- [x] 5.1 Create `src/main.tsx` that renders `<App />` into `#root` and imports `./styles/global.css` (Tailwind base/components/utilities)
- [x] 5.2 Create `src/styles/global.css` with the three Tailwind directives and a light/neutral body reset
- [x] 5.3 Create `src/App.tsx` that wraps the router in `QueryClientProvider` (one `queryClient` with `defaultOptions.queries = { throwOnError: (err) => err.status >= 500, retry: 1 }`), mounts the `Toaster`, mounts `ReactQueryDevtools` when `import.meta.env.DEV`
- [x] 5.4 Create `src/routes/router.tsx` with `createBrowserRouter` exposing `/`, `/empleados`, `/empleados/nuevo`, `/empleados/:id`, `/estados`, `/estados/nuevo`, `/tareas`, `/tareas/nuevo`, `/tareas/:id`, and a catch-all `*` NotFound route
- [x] 5.5 Create `src/routes/Layout.tsx` with a top nav (Empleados, Estados, Tareas) and an `<Outlet />` + a route-level `ErrorBoundary` component that renders the generic fallback for 5xx `ApiProblem`s
- [x] 5.6 Smoke test: `pnpm --filter @employeek/web dev` → open `http://localhost:5173`, see the nav and an empty placeholder route

## 6. UI primitives (`src/components/ui/*`)

- [x] 6.1 Copy shadcn/ui sources for the minimum set: `button.tsx`, `input.tsx`, `label.tsx`, `select.tsx`, `dialog.tsx`, `table.tsx`, `toast.tsx` + `sonner.tsx` (Toaster wrapper); add the needed `cn` util in `src/lib/cn.ts`
- [x] 6.2 Write a smoke test per primitive: renders children, respects `disabled`, forwards ref (one test file `test/components/ui/primitives.test.tsx`)
- [x] 6.3 Delete any unused shadcn piece that crept in so we only own what we use (audit)

## 7. Empleados feature (`src/features/empleados/`)

- [x] 7.1 Create `schemas.ts` with `createEmpleadoSchema` (Zod, mirrors API) and inferred `CreateEmpleadoInput`
- [x] 7.2 Create `api.ts`: `listEmpleados()`, `getEmpleado(id)`, `createEmpleado(body)`, `updateEmpleado(id, body)`, `deleteEmpleado(id)`, `listTareasForEmpleado(id)` — all via `http()`
- [x] 7.3 Create `queries.ts`: `useEmpleados`, `useEmpleado(id)`, `useEmpleadoTareas(id)`, `useCreateEmpleado`, `useUpdateEmpleado`, `useDeleteEmpleado` with stable query keys and invalidations
- [x] 7.4 Create `EmpleadosList.tsx` (route `/empleados`) — `Table` of id/nombre/fechaIngreso/salario/acciones; row links to `/empleados/:id`; "Nuevo" button links to `/empleados/nuevo`
- [x] 7.5 Create `EmpleadoForm.tsx` — shared by create (`/empleados/nuevo`) and edit (`/empleados/:id` edit mode); RHF + zodResolver; on submit error with `ApiProblem`, call `applyProblemToForm` and fall back to toast
- [x] 7.6 Create `EmpleadoDetail.tsx` (route `/empleados/:id`) — shows empleado fields plus a "Tareas de este empleado" panel driven by `useEmpleadoTareas`; edit and delete buttons; delete uses a confirmation `Dialog` and surfaces the 422 FK toast
- [x] 7.7 Tests in `test/features/empleados/`: list renders mocked rows; form happy-path submits expected body; form 400 maps `errors[].path = "body/salario"` to the `salario` field; delete with 422 shows the toast

## 8. Estados feature (`src/features/estados/`)

- [x] 8.1 Create `schemas.ts` with `createEstadoSchema`, `updateEstadoSchema` (Zod, mirrors API — `nombre`, `categoria`, `cambiosPermitidos?`)
- [x] 8.2 Create `api.ts`: `listEstados`, `getEstado`, `createEstado`, `updateEstado`, `deleteEstado`
- [x] 8.3 Create `queries.ts`: `useEstados`, `useEstado(id)`, `useCreateEstado`, `useUpdateEstado`, `useDeleteEstado`
- [x] 8.4 Create `EstadosList.tsx` (route `/estados`) with `Nuevo` action and an inline edit affordance (modal `Dialog` with `EstadoForm`)
- [x] 8.5 Create `EstadoForm.tsx` — RHF + Zod; on 409 `ApiProblem`, render the `title`/`detail` toast
- [x] 8.6 Tests: list renders; form happy path; form with duplicate `nombre` renders the 409 toast; delete while referenced surfaces 422 toast

## 9. Tareas feature (`src/features/tareas/`)

- [x] 9.1 Create `schemas.ts`: `createTareaSchema`, `updateTareaSchema`, `cambiarEstadoSchema` (`idEstado: number`), with Zod `coerce.date()` for the three date fields
- [x] 9.2 Create `api.ts`: `listTareas`, `listTareasByCategoria(categoria)`, `getTarea`, `createTarea`, `updateTarea`, `cambiarEstado(id, body)`, `deleteTarea`
- [x] 9.3 Create `queries.ts`: `useTareas({ categoria? })` (key `['tareas', { categoria }]`), `useTarea(id)`, `useCreateTarea`, `useUpdateTarea`, `useCambiarEstado`, `useDeleteTarea`
- [x] 9.4 Create `TareasList.tsx` (route `/tareas`) with categoria filter dropdown driven by the list of unique categorias fetched via `useEstados`; query keys switch when the filter changes, so TanStack cache serves "all" and "activa"/"cerrada" separately
- [x] 9.5 Create `TareaForm.tsx` — create and edit; create path leaves `estadoNombre` unset so the API applies the `pendiente` default (verify by asserting the POST body in a test)
- [x] 9.6 Create `CambiarEstadoDialog.tsx` — modal with a `Select` of allowed estados (derived from the current tarea's estado's `cambiosPermitidos` CSV), calls `useCambiarEstado`; on 400 `Invalid state transition`, render the `detail` inline without closing
- [x] 9.7 Create `TareaDetail.tsx` — shows all fields + empleado + estado, buttons for edit, delete, "cambiar estado"
- [x] 9.8 Tests: list renders with empleado/estado names; create without `estadoNombre` sends no such field; `cambiar estado` happy path pendiente→en-progreso; `cambiar estado` rejected finalizada→pendiente surfaces inline

## 10. Home, 404, and error boundary

- [x] 10.1 Create `src/routes/Home.tsx` — simple landing with counts from `useEmpleados`, `useEstados`, `useTareas` and links to each section
- [x] 10.2 Create `src/routes/NotFound.tsx` — static 404 with a link back to `/`
- [x] 10.3 Create `src/routes/ErrorFallback.tsx` — receives the error from the router's `errorElement`; if `error instanceof ApiProblem`, show `title`, `status`, `traceId` in copy; otherwise generic message + reload button
- [x] 10.4 Wire `errorElement: <ErrorFallback />` on the router root

## 11. Env plumbing and dev-server verification

- [x] 11.1 Add `VITE_API_URL=http://localhost:4000` to `.env.example` with a one-line comment
- [x] 11.2 Copy the entry to the local `.env`
- [x] 11.3 Verify `import.meta.env.VITE_API_URL` resolves in dev (temporary `console.log` in `http.ts`, removed once confirmed)
- [x] 11.4 Golden-path smoke: `pnpm dev` from repo root → web at 5173 renders the empleados list after POSTing via the form; no CORS errors in the console

## 12. Turbo wiring

- [x] 12.1 Confirm `turbo.json`'s `dev`, `build`, `lint`, `typecheck`, and `test` tasks cover `@employeek/web` without modification
- [x] 12.2 Add a `preview` task to `turbo.json` (`cache: false, persistent: true`) and a matching `preview: "vite preview --port 5173"` script in the workspace
- [x] 12.3 Run `pnpm build` from the root twice → second run is a Turbo cache hit for both workspaces

## 13. Documentation

- [x] 13.1 Add a "Web app" section to `CLAUDE.md` after "HTTP API": dev script, build/preview scripts, `VITE_API_URL`, pointer to `src/lib/http.ts`, statement that all fetches route through it, RFC 7807 error-model note
- [x] 13.2 Update the root-scripts table in `CLAUDE.md`: confirm the existing lines still describe what happens (`pnpm dev` now boots both apps, `pnpm test` now runs web component tests too)
- [x] 13.3 Add a short note reminding readers that `D:\Proyectos Konecta\FRONTK1` and `legacy/` remain quarantined

## 14. Smoke test — full CRUD flow

- [x] 14.1 Fresh slate: `pnpm db:reset && pnpm db:migrate:deploy && pnpm db:seed`; start `pnpm dev` from the repo root
- [x] 14.2 Create an empleado via the form, see it in the list, click through to detail
- [x] 14.3 Create an estado, edit it, observe the list updates without reload
- [x] 14.4 Create a tarea without picking an estado → appears with `estadoNombre = "pendiente"`
- [x] 14.5 "Cambiar estado" → en-progreso → finalizada; then try pendiente and confirm the inline error from the 400 envelope
- [x] 14.6 Filter tareas by `activa` and by `cerrada`, confirm the list content changes and the URL query updates
- [x] 14.7 Delete an empleado that has a tarea → 422 toast appears, row stays

## 15. Smoke test — error envelope rendering

- [x] 15.1 Submit an empleado form with `salario = -1` → `salario` field shows the server-derived message from `errors[0].message`
- [x] 15.2 Submit a second `estado` with `nombre = "pendiente"` → toast with title "Conflict" appears
- [x] 15.3 Delete an `estado` that is in use → toast with title "Unprocessable Entity" appears
- [x] 15.4 Stop the API mid-flow, click "Cargar empleados" → 5xx route boundary renders the fallback with the traceId; restart the API and verify "recargar" recovers
- [x] 15.5 Open the browser devtools — confirm no call bypasses `src/lib/http.ts` (Network panel shows all requests originating from one place)

## 16. Quality gates

- [x] 16.1 `pnpm typecheck` passes
- [x] 16.2 `pnpm lint` passes
- [x] 16.3 `pnpm format:check` passes
- [x] 16.4 `pnpm build` passes (web + api)
- [x] 16.5 `pnpm test` passes (web + api)
- [x] 16.6 `openspec validate rebuild-web-vite-tanstack-query --strict` passes

## 17. Commits

- [x] 17.1 Commit deps install + workspace config as `feat(web): add vite + react 18 + tailwind skeleton`
- [x] 17.2 Commit HTTP client + error model as `feat(web): add fetch-based http client with rfc 7807 parsing`
- [x] 17.3 Commit app shell (main, App, router, QueryClient, layout) as `feat(web): add app shell with react router + tanstack query`
- [x] 17.4 Commit shadcn primitives as `feat(web): add shadcn/ui primitive set`
- [x] 17.5 Commit empleados feature as `feat(web): port empleados CRUD to the new SPA`
- [x] 17.6 Commit estados feature as `feat(web): port estados CRUD to the new SPA`
- [x] 17.7 Commit tareas feature + state-transition UI as `feat(web): port tareas CRUD with cambiar-estado dialog`
- [x] 17.8 Commit home + 404 + error fallback as `feat(web): add home, 404, and route-level error fallback`
- [x] 17.9 Commit `.env.example` addition as `chore(infra): add VITE_API_URL default`
- [x] 17.10 Commit Turbo preview task as `chore(turbo): add preview task for the web workspace`
- [x] 17.11 Commit `CLAUDE.md` updates as `docs(web): document vite spa workflow`
- [x] 17.12 Commit ticked `tasks.md` as `chore(openspec): mark rebuild-web-vite-tanstack-query tasks complete`

## 18. Archive handoff

- [x] 18.1 Verify `openspec status --change rebuild-web-vite-tanstack-query --json` reports all 4 artifacts `done` and `isComplete: true`
- [ ] 18.2 Run `/opsx:archive rebuild-web-vite-tanstack-query` to promote `web-ui` into `openspec/specs/` and move the change into `openspec/changes/archive/` (user-triggered)
- [ ] 18.3 Merge branch `feat/rebuild-web-vite-tanstack-query` into `main` (user-authorized)
