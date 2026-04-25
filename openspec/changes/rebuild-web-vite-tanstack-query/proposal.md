## Why

`apps/web` is still a TS-only skeleton — the real user-facing UI lives in `D:\Proyectos Konecta\FRONTK1`, a stand-alone Create-React-App project outside the monorepo. FRONTK1 mixes CRA tooling (no longer maintained), JavaScript, inline fetch calls, and ad-hoc state that can't keep up with the Fastify + RFC 7807 envelope the API now ships (CH4 just landed). To finish the refoundation's user-facing half we need to port the legacy screens into the monorepo as a modern Vite + React 18 + TypeScript SPA with TanStack Query for server state, so the frontend is typed end-to-end, tested, and co-owned with the API in one pipeline.

## What Changes

- Replace `apps/web`'s TS skeleton with a real Vite 5 + React 18 + TypeScript-strict SPA that boots on `http://localhost:5173` and talks to the CH4 API at `VITE_API_URL` (default `http://localhost:4000`).
- Wire **TanStack Query v5** as the single source of truth for server state — every read/write against `empleados`, `estados`, `tareas`, `health` goes through a query or mutation hook.
- Introduce a thin `fetch`-based HTTP client in `apps/web/src/lib/http.ts` that understands `application/problem+json`, surfaces RFC 7807 fields (`title`, `detail`, `status`, `errors[]`, `traceId`) as a typed `ApiProblem` error, and rejects the promise on any `>= 400` response.
- Add **React Router v6** for SPA routing, **React Hook Form + Zod** for client-side form validation (mirroring the API's Zod schemas where possible), and **Tailwind CSS v3 + shadcn/ui primitives** for the component system.
- Port FRONTK1's screens: empleados CRUD, estados CRUD, tareas CRUD with the state-transition UI (consumes `PUT /tareas/:id/estado`), tareas filtered by `categoria`. Present API errors as inline form errors (from `errors[]`) plus a top-level toast (from `title`/`detail`).
- Wire Turbo pipeline tasks for the workspace: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`. Add **Vitest + @testing-library/react + jsdom** for component/integration tests.
- **BREAKING** for local devs (not prod): the web app's default port moves to `5173`; the legacy FRONTK1 dev server at `3000` is left untouched (FRONTK1 is retired later in CH8).

## Capabilities

### New Capabilities

- `web-ui`: the Fastify-facing SPA in `apps/web` — routing, server-state caching via TanStack Query, typed HTTP client, RFC 7807 error surfacing, forms with client-side validation, and the four resource screens (empleados, estados, tareas, health).

### Modified Capabilities

<!-- None — the API contract from CH4 is consumed as-is; no requirement-level change to api-rest. -->

## Impact

- **Code:** `apps/web/**` is effectively rewritten. New dirs: `src/routes/`, `src/features/{empleados,estados,tareas}/`, `src/components/`, `src/lib/` (http client, query client), `src/schemas/` (Zod forms). Root `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `index.html`.
- **Dependencies (actual installed majors):** runtime — `react@18`, `react-dom@18`, `react-router-dom@6`, `@tanstack/react-query@5`, `@tanstack/react-query-devtools@5`, `react-hook-form@7`, `@hookform/resolvers@5`, `zod@3`, `class-variance-authority@0.7`, `clsx@2`, `lucide-react@1`, `sonner@2`; dev — `vite@5`, `@vitejs/plugin-react-swc@4`, `@types/react@18`, `@types/react-dom@18`, `vitest@2`, `@vitest/coverage-v8@2`, `@testing-library/react@16`, `@testing-library/jest-dom@6`, `@testing-library/user-event@14`, `jsdom@29`, `tailwindcss@3`, `postcss@8`, `autoprefixer@10`, `tailwindcss-animate@1`.
- **Env:** new `.env.example` entry `VITE_API_URL=http://localhost:4000`. The API's existing `CORS_ORIGINS=http://localhost:5173` already permits the new dev server — no CH4 change.
- **Turbo:** `turbo.json` gains `preview` task; existing `dev`/`build`/`test`/`lint`/`typecheck` apply to the new workspace with no pipeline-graph changes.
- **Out of scope (future changes):** typed client generated from an OpenAPI document (CH6 `openapi-contract-and-typed-client`), CI/CD (CH7), retiring FRONTK1 and `legacy/` (CH8), authentication/i18n/dark mode/analytics (no legacy parity to match — deferred).
- **Legacy:** `D:\Proyectos Konecta\FRONTK1` and `legacy/` stay untouched per the quarantine rule; FRONTK1 is referenced only to replicate behavior, never imported.
