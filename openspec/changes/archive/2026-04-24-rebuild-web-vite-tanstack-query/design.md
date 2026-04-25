## Context

`apps/web` today is a TypeScript skeleton with no real UI — it exists so the workspace appears in `pnpm dev` / `pnpm build`, nothing more. The user-facing frontend is still `D:\Proyectos Konecta\FRONTK1`, a Create-React-App 4 project outside the monorepo using JavaScript, plain `fetch`, and per-component `useState` for server data. CH4 (`rebuild-api-fastify-ajv-errors`, archived 2026-04-24) has just replaced the legacy Express API with a Fastify 5 service that speaks `application/problem+json` (RFC 7807) and enforces Zod-derived schemas on every request. The new API runs on `http://localhost:4000`, already allow-lists `http://localhost:5173` via `CORS_ORIGINS`, and exposes 18 endpoints across `empleados`, `estados`, `tareas`, and `health`. FRONTK1's screens map 1:1 to these endpoints but were written against the legacy Express error shape (ad-hoc JSON, sometimes HTML).

We now need a real `apps/web` inside the monorepo. This change is the opportunity to: (a) move the frontend off CRA (unmaintained, slow) onto **Vite**; (b) commit to **TypeScript strict**; (c) replace scattered `fetch + useState` with a single server-state layer (**TanStack Query v5**); (d) teach the SPA to parse the Fastify problem envelope into structured, reusable errors. The constraint is to stay within the quality bars already enforced for the monorepo (ESLint flat config, Prettier, commitlint, husky, Turbo pipeline), and to not touch `legacy/` or `FRONTK1` — both stay quarantined until CH8.

## Goals / Non-Goals

**Goals:**

- Replace `apps/web`'s skeleton with a Vite 5 + React 18 + TypeScript-strict SPA, bootable via `pnpm --filter @employeek/web dev` at `http://localhost:5173`.
- All server state flows through **TanStack Query v5** hooks (`useQuery` / `useMutation`) keyed by resource + filter; invalidations after mutations are explicit and typed.
- A single HTTP helper (`src/lib/http.ts`) owns `application/problem+json` parsing and throws a typed `ApiProblem` error that components can pattern-match (`error.status === 422`, `error.errors?.[0].path`).
- Feature parity with FRONTK1 on the three CRUD resources plus tarea state transitions and categoria filtering.
- Client-side forms validated with **React Hook Form + Zod**; schemas live in `src/schemas/` and mirror the API's Zod schemas (duplicated by design, unified in CH6).
- Test bar: one Vitest + Testing Library test per form happy-path + one error-envelope rendering test per resource.
- Integrate into the existing Turbo pipeline with no new root scripts.

**Non-Goals:**

- OpenAPI-driven typed client. The client calls are hand-written `fetch` wrappers for now; CH6 (`openapi-contract-and-typed-client`) replaces them with a generated client.
- Authentication, authorization, session handling, CSRF tokens. Legacy has none; we don't add them here.
- i18n, dark mode, theming, analytics, telemetry.
- Moving `FRONTK1` into the monorepo or deleting it. Quarantined until CH8.
- Storybook, Chromatic, visual regression. Deferred — reassess after the team uses the UI in anger for a sprint.
- SSR, Next.js, Remix. This is an internal tool; SPA with client-side rendering is sufficient.
- End-to-end tests (Playwright/Cypress). Component tests are enough for this change; E2E is a future CI addition.

## Decisions

### Decision: Vite 5 with `@vitejs/plugin-react-swc` over Vite + Babel or Next.js

SWC is ~20× faster than Babel for JSX transforms and has first-party Vite support. Next.js would give us SSR "for free" but adds a server runtime, file-system routing, and build output format we don't need for an internal SPA. Vite's dev server with HMR is the minimum viable tool for the feedback loop we want.

**Alternatives considered:**

- `@vitejs/plugin-react` (Babel): Works, but SWC is the modern default and shaves seconds off cold reloads. No feature we need depends on Babel plugins.
- **Next.js 14 (app router)**: Overkill for an internal tool; SSR is irrelevant when the only consumer is a logged-in staff user on a LAN; forces a server runtime we don't want to operate.
- **Remix**: Similar arguments as Next.js; nested routing is nice but not worth the SSR complexity.

### Decision: TanStack Query v5 for server state, React context only for UI state

TanStack Query gives us caching, background refetch, stale-while-revalidate, devtools, and `invalidateQueries` out of the box. Manual `useEffect + useState` in 18 endpoints × N screens = dozens of bespoke loading/error/refetch ladders, none of them consistent. Query keys become the canonical way to describe "what the UI needs from the server," and mutations are one-liners with typed rollback.

Local UI state (open modals, selected row, dirty form) lives in component state or small contexts. Zustand/Redux/Jotai are not added — we don't have cross-tree global state.

**Alternatives considered:**

- **SWR**: Thinner than TanStack Query, but missing mutation infrastructure, devtools that work in production, and the richer cache surface we'll need in CH6 for optimistic updates and pagination.
- **Plain `fetch` + `useState`**: Matches FRONTK1 exactly — and matches its bugs (inconsistent loading states, stale data on back-nav, unhandled 409/422). Rejected.
- **RTK Query**: Brings Redux as a dependency we don't otherwise want.

### Decision: Thin `fetch` wrapper over Axios for the HTTP client

A ~50-line `http(method, path, body)` helper in `src/lib/http.ts` that (a) prefixes `VITE_API_URL`, (b) sets `Content-Type: application/json` when there's a body, (c) on `response.ok === false`, parses the JSON and throws a typed `ApiProblem` instance built from the RFC 7807 envelope. Components and query hooks catch `ApiProblem` and rendered it as inline errors + toast.

Axios brings interceptors and cancel tokens, but it also brings a 15KB runtime, its own error model (`AxiosError`) we'd then have to re-wrap anyway, and historically lagged on fetch-like web standards. The helper we need is small.

**Alternatives considered:**

- **Axios**: Familiar, but everything useful it offers (retries, cancellation) is out of scope now.
- **`ky`**: A nicer fetch wrapper; adds a dep for marginal gain since our needs are narrow.
- **`@tanstack/query` fetcher direct**: Coupling every call to a Query hook makes imperative usage (e.g., one-shot script) awkward.

### Decision: React Router v6 (data-router API) over TanStack Router

React Router 6.4+ offers the data-router API with `loader`/`action` integration, is the industry default, and is known to every React dev on the team. TanStack Router has end-to-end type safety but is pre-1.0 in some ergonomics and adds another library to learn alongside TanStack Query.

**Alternatives considered:**

- **TanStack Router**: Best-in-class types; too young for us to debug if it misbehaves.
- **Wouter**: Tiny and cute; no nested routing story worth adopting.

### Decision: Tailwind v3 + a minimal set of shadcn/ui primitives over MUI / Headless UI+CSS Modules

Tailwind lets us ship pixel-perfect UI with zero CSS file management; shadcn/ui gives us tree-shakable, copy-into-repo primitives (Button, Input, Dialog, Table) we can restyle without fighting a component library's opinions. shadcn pieces are source in our repo — no runtime dep, no version lock.

The ramp-up cost of Tailwind is real but widely paid already; the alternative is spending weeks reinventing a design system.

**Alternatives considered:**

- **MUI (Material-UI)**: Big, opinionated, themed around Google's Material. Not the aesthetic we want and expensive to customize.
- **Chakra UI**: Nice, but its styling system is custom (emotion-based) and we'd be locked to it.
- **Headless UI + CSS Modules**: Clean separation, but writing CSS Modules for every button/dialog/input is time we'd rather spend on features.

### Decision: React Hook Form + Zod, schemas colocated with features

Each feature folder (`src/features/empleados/`) owns its own Zod schema (`schemas.ts`) mirroring the API's request body. RHF uses `@hookform/resolvers/zod` to validate. Field-level errors render inline; on submit, mutation errors from the API (`error.errors[]`) are mapped by `path` onto the same form fields.

Duplicating the Zod schema between API and web is intentional: the API evolves at its own pace, and CH6 adds the generated client + generated types. Until then, a human keeps these in sync — the alternative (importing Zod from the API workspace) would leak backend-only concerns like `PrismaPg` adapter imports into the browser bundle via dependency graph.

**Alternatives considered:**

- **Formik**: Slower, larger, with a less ergonomic API; RHF is the modern default.
- **Uncontrolled forms with no library**: Fine for two-field forms; brittle for our multi-field CRUD.
- **Shared Zod schemas via `packages/contracts`**: Clean but premature. CH6 introduces a proper contract package derived from OpenAPI; we don't want to invent a parallel one now.

### Decision: Vitest + @testing-library/react + jsdom for component tests

Vitest is already the test runner for `@employeek/api`. Using it in `@employeek/web` means the same config surface, the same CLI, and Turbo's `test` task already works. jsdom (not happy-dom) because it's the best-supported and fastest-enough.

Tests live under `apps/web/test/` mirroring `src/`. The test bar for this change: each form has one happy-path test (fills + submits + asserts mutation called) and one error-envelope test (the API returns a 422 problem, the form renders the inline error at the right field).

**Alternatives considered:**

- **Jest**: Works, but would split the monorepo across two runners with different configs.
- **Playwright component mode**: Good, slower, and needs browser downloads in CI — defer to a future change.

### Decision: Env via `import.meta.env.VITE_API_URL`, default `http://localhost:4000`

Vite exposes any env var prefixed with `VITE_` to the client bundle. We set exactly one: `VITE_API_URL`. No dotenv loading in the app — Vite reads `.env` itself. The repo-root `.env.example` gains the entry; the CH4 API's `CORS_ORIGINS` already allow-lists `http://localhost:5173`, so no API change is needed.

### Decision: Error handling model

All `fetch` calls go through `http()`. On failure it throws `new ApiProblem(envelope)`. TanStack Query surfaces this as `error` on the hook; route error boundaries render a generic fallback for 5xx; form submit handlers catch the mutation's `onError` and call a helper `applyProblemToForm(problem, form)` that (a) sets field errors from `problem.errors[]` (path like `body/salario` is mapped to field `salario`), (b) shows a toast with `problem.title` if there are no field errors. The `traceId` is logged to the browser console alongside every failure so QA can correlate with server logs.

## Risks / Trade-offs

- **Schema duplication between API and web** → the Zod schemas in `apps/api/src/schemas/` and `apps/web/src/features/*/schemas.ts` can drift. Mitigation: CH6 (`openapi-contract-and-typed-client`) generates a typed client + shared types; until then, schema diff is part of PR review. Risk is low because the 3 resources' shapes are small and stable.
- **Tailwind learning cost** → devs new to utility-first CSS will push back. Mitigation: `packages/tsconfig/react.json` and `packages/eslint-config` already set conventions; add a short "Tailwind cheatsheet" to CLAUDE.md in the docs task, and lean on shadcn/ui primitives so most devs compose rather than author classes.
- **shadcn/ui is source in the repo, not a dep** → each primitive we adopt is a ~100-line `.tsx` we own forever. Mitigation: only pull in what we use (Button, Input, Label, Dialog, Table, Toast) — not the whole kit. Audit annually.
- **React Router data-router vs classic** → we use the data-router API (`createBrowserRouter`), which is a bigger migration target if we ever move to Next/Remix, but the ergonomics are worth it for this project.
- **Error boundary gaps** → TanStack Query doesn't rethrow `error` into the nearest React error boundary unless we set `throwOnError: true` per hook. Mitigation: enable `throwOnError` globally for `useQuery` so 500s hit a fallback UI; keep mutations catching their own errors because they must show inline form errors.
- **FRONTK1 stays alive during the change** → developers can get confused which one is "the frontend." Mitigation: document explicitly in the HTTP API section of `CLAUDE.md` that `apps/web` is the canonical frontend from CH5 forward and FRONTK1 is retired in CH8.
- **Tests touch the real API?** → No. Component tests mock the HTTP client at the boundary (`vi.mock('../lib/http')`). Integration testing against a live server is a future change when we add E2E.

## Migration Plan

This change does not "migrate" in the data-migration sense — `apps/web` has no real UI to preserve. The plan is forward-only:

1. Install all new deps in the workspace in one go; lockfile refresh in a single commit.
2. Establish the app shell (Vite config, entry, router, QueryClientProvider, Tailwind) before porting any screens. Smoke-test against the CH4 API via `/health`.
3. Port one full feature end-to-end (empleados: list, detail, create, update, delete) as the pattern reference. Land it, review the pattern, then fan out to estados and tareas.
4. Tareas is the non-trivial one: it has the state-transition UI (`PUT /tareas/:id/estado`) and the categoria filter. Build the transition UI last so the mutation helper pattern is already shaken out.
5. Tests go in alongside each feature, not batched at the end.

**Rollback:** revert the change's commits on `main`. `apps/web` returns to the skeleton; FRONTK1 keeps serving users because it is untouched.

## Open Questions

- **Which shadcn/ui primitives do we adopt on day 1?** The minimum for the three screens is Button, Input, Label, Select, Dialog, Table, and Toast. Resolvable during the app-shell task (6.x).
- **Toast library: shadcn's built-in `Toaster` (sonner-based) or `react-hot-toast`?** Tentatively sonner since it's already the shadcn default; decide in task 7.x when we wire the error handler.
- **Route structure for tareas filtering** — two shapes on the table: `/tareas?categoria=activa` (query param) vs `/tareas/categoria/activa` (path param matching the API route). Prefer query param in the UI so the same table view handles both "all" and "filtered"; path param is an API artifact, not a UX one.
- **Error toast copy for 5xx** — "Something went wrong. (trace: abc-123)" fits the envelope but might leak too much to end users. Decide with product before the error-handler task (7.x).
