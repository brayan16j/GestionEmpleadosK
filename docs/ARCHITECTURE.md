# Arquitectura — EmployeeK

Documento de referencia para entender de qué está hecho el proyecto, cómo está organizado y por qué se tomaron las decisiones que se tomaron.

> Para el contrato detallado de tooling y reglas de contribución, ver [`CLAUDE.md`](../CLAUDE.md). Para correr el proyecto en menos de un minuto, ver [`README.md`](../README.md).

---

## 1. Visión general

**EmployeeK** es una aplicación para la gestión de empleados y tareas. Modelo de dominio simple (3 entidades: `empleado`, `estado`, `tarea`) con **18 endpoints REST** en el backend y un frontend SPA con CRUDs y formularios validados.

El proyecto fue **refundado** entre 2026-04-22 y 2026-04-28 como un monorepo profesional, reemplazando el stack legado (Express 4 + Sequelize + JS + CRA) por uno enterprise-grade. Los 8 changes OpenSpec del plan ADR-0 ya están archivados; el directorio `legacy/` fue eliminado en el último change.

### Estado actual

- **0 deuda técnica conocida** documentada.
- **CI gatea cada push a `main`** con 5 jobs paralelos.
- **Tests automatizados** en backend (Vitest + integración contra Postgres real) y frontend (Vitest + jsdom).
- **Type-safety end-to-end** vía contrato OpenAPI tipado consumido por el frontend.

---

## 2. Stack tecnológico

| Capa             | Tecnología                                                | Por qué                                                                           |
| ---------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Lenguaje**     | TypeScript 5 (strict + `noUncheckedIndexedAccess`)        | Catch errors a compile-time; zero `any` implícitos                                |
| **Runtime**      | Node 20 LTS (`>=20.19.0` por requerimiento de Prisma 7)   | LTS estable, ESM nativo                                                           |
| **Backend**      | Fastify 5                                                 | Rápido, plugin-based, soporte nativo de JSON Schema vía AJV; reemplazó Express    |
| **Validación**   | AJV (vía Fastify) + Zod (en el frontend)                  | AJV se integra al router y emite OpenAPI; Zod cubre forms + env parsing           |
| **Errores HTTP** | RFC 7807 (`application/problem+json`)                     | Envelope estándar reusable web/server                                             |
| **ORM**          | Prisma 7 + `PrismaPg` driver adapter                      | Type-safe, migrations declarativas; reemplazó Sequelize                           |
| **Database**     | PostgreSQL 16 (Docker)                                    | Estándar; la única forma soportada de correr DB local es vía `docker compose`     |
| **Frontend**     | Vite 5 + React 18 + TanStack Query v5                     | Vite reemplazó CRA; TanStack Query maneja cache de servidor; Suspense friendly    |
| **UI**           | Tailwind CSS 3 + shadcn/ui (primitives)                   | Componentes propios sobre primitivas de Radix; sin biblioteca pesada              |
| **Forms**        | React Hook Form + Zod                                     | Validación type-safe, mapping directo de errores RFC 7807 a campos                |
| **HTTP client**  | `apps/web/src/lib/http.ts` (wrapper de `fetch`)           | Custom thin layer; rechazo de `fetch` directo enforced por ESLint                 |
| **Tests**        | Vitest (backend + frontend), Fastify `inject()` para HTTP | Mismo runner; backend prueba contra DB real, frontend usa jsdom                   |
| **Monorepo**     | pnpm workspaces + Turborepo                               | Caché por inputs, paralelización; reemplazó Nx/Lerna por simplicidad              |
| **Lint/format**  | ESLint 9 flat config + Prettier 3                         | Reglas consolidadas en `@employeek/eslint-config`                                 |
| **Hooks Git**    | husky + lint-staged + commitlint                          | Pre-commit (lint+format), commit-msg (Conventional Commits), pre-push (typecheck) |
| **CI/CD**        | GitHub Actions (5 jobs paralelos)                         | Quality / Test / Contract-drift / OpenSpec-sync / Commitlint                      |
| **Workflow**     | OpenSpec (proposal → design → specs → tasks → archive)    | Toda change no-trivial pasa por aquí; specs canónicas viven en `openspec/specs/`  |

---

## 3. Estructura del monorepo

```
GestionEmpleadosK/
├── apps/
│   ├── api/                  # @employeek/api — backend Fastify + Prisma
│   │   ├── prisma/           # schema.prisma, migrations, seed.ts
│   │   ├── src/
│   │   │   ├── app.ts        # buildApp(): registra plugins y rutas
│   │   │   ├── server.ts     # entry point producción
│   │   │   ├── index.ts      # entry point dev (tsx watch)
│   │   │   ├── config/       # env.ts: contrato Zod del .env
│   │   │   ├── db/           # client.ts: singleton Prisma + driver adapter
│   │   │   ├── errors/       # problem.ts: helpers RFC 7807
│   │   │   ├── routes/       # empleados.ts, estados.ts, tareas.ts, health.ts
│   │   │   ├── schemas/      # JSON Schemas con $id (OpenAPI components)
│   │   │   └── openapi.ts    # registración de @fastify/swagger
│   │   ├── scripts/dump-openapi.ts  # genera packages/api-types/openapi.json
│   │   └── test/             # Vitest integration contra DB real
│   │
│   └── web/                  # @employeek/web — frontend Vite + React
│       ├── src/
│       │   ├── main.tsx, App.tsx
│       │   ├── routes/       # React Router routes
│       │   ├── features/     # empleados/ estados/ tareas/ (vertical slices)
│       │   ├── components/   # primitives shadcn/ui
│       │   ├── lib/
│       │   │   ├── http.ts             # único cliente HTTP permitido
│       │   │   ├── problem.ts          # ApiProblem extends Error
│       │   │   └── applyProblemToForm.ts  # mapping errors[] → RHF fields
│       │   └── styles/       # Tailwind
│       └── test/             # Vitest jsdom component tests
│
├── packages/
│   ├── api-types/            # @employeek/api-types — tipos generados desde OpenAPI
│   │   ├── openapi.json      # snapshot commiteado
│   │   ├── src/index.ts      # helpers Schema<K>, RequestBody, ResponseBody
│   │   └── src/generated.ts  # generado por openapi-typescript (gitignored)
│   ├── eslint-config/        # @employeek/eslint-config — reglas compartidas
│   └── tsconfig/             # @employeek/tsconfig — presets base/node/react
│
├── infra/
│   └── docker-compose.yml    # Postgres 16 local (servicio: employeek_postgres)
│
├── openspec/
│   ├── changes/archive/      # changes archivados (8 a la fecha)
│   └── specs/                # specs canónicas vivas
│
├── .github/
│   ├── workflows/ci.yml      # 5 jobs paralelos
│   ├── actions/setup/        # composite action reutilizado
│   └── dependabot.yml        # bumps semanales
│
├── .claude/                  # commands y skills para Claude Code
├── .husky/                   # pre-commit, commit-msg, pre-push
├── docs/                     # documentación técnica del proyecto
├── CLAUDE.md                 # contrato de tooling y reglas
└── README.md                 # one-command bootstrap
```

---

## 4. Vista de capas

```mermaid
graph TB
    User[Usuario web]
    Web["apps/web<br/>Vite + React + TanStack Query"]
    Types["packages/api-types<br/>tipos OpenAPI"]
    API["apps/api<br/>Fastify + AJV"]
    Prisma[Prisma Client]
    DB[(PostgreSQL 16<br/>Docker)]

    User -->|HTTP| Web
    Web -->|importa| Types
    Web -->|fetch via lib/http.ts| API
    API -->|app.prisma| Prisma
    Prisma -->|SQL| DB

    API -.->|dump OpenAPI| Types
```

El frontend nunca llama directamente a la DB. El contrato OpenAPI es el único punto de acoplamiento entre web y api: cualquier cambio de schema del backend regenera tipos que el frontend consume tipadamente.

---

## 5. Pipeline del contrato OpenAPI

Una de las piezas más importantes de la arquitectura. Resuelve el problema clásico de "el frontend rompió porque el backend cambió un campo".

```mermaid
sequenceDiagram
    autonumber
    participant Dev as Developer
    participant API as apps/api
    participant Snap as openapi.json
    participant Types as packages/api-types
    participant Web as apps/web

    Dev->>API: edita una ruta o un Schema
    Dev->>API: pnpm api:openapi
    API->>Snap: dump-openapi.ts escribe<br/>snapshot determinista
    Dev->>Types: pnpm api:types
    Types->>Types: openapi-typescript genera<br/>src/generated.ts
    Types->>Types: tsc --build
    Types-->>Web: dist/index.d.ts
    Web->>Web: tipos actualizados<br/>en feature.api.ts
```

**Salvaguardas:**

1. **Test snapshot** (`apps/api/test/openapi-snapshot.test.ts`) — falla si `app.swagger()` actual no coincide con `openapi.json` commiteado.
2. **CI gate `contract-drift`** — corre `pnpm api:types` + `git diff --exit-code packages/api-types/`. Falla si hay drift.
3. **ESLint regla** — el frontend no puede declarar `interface Empleado` a mano; debe usar `Schema<'Empleado'>`.

Resultado: imposible mergear un cambio de API sin que los tipos del web reflejen ese cambio.

---

## 6. Backend (`apps/api`)

### Plugin order (`buildApp()`)

```
1. @fastify/sensible       → app.httpErrors.notFound() etc.
2. @fastify/cors            → CORS_ORIGINS env
3. JSON Schemas con $id     → componentes reutilizables
4. @fastify/swagger         → recolecta routes posteriores
5. @fastify/swagger-ui      → /docs (si OPENAPI_UI_ENABLED)
6. Decorator app.prisma     → singleton del cliente
7. Error handler RFC 7807   → setErrorHandler global
8. Routes                   → /empleados, /estados, /tareas, /health
```

El orden importa: el plugin Swagger debe registrarse **antes** que las rutas para que su hook `onRoute` capture todas.

### Reglas internas

- **Prisma decorator rule**: las rutas leen el cliente vía `app.prisma`, nunca con `import { prisma }`. Esto evita pools duplicados bajo `tsx watch` y permite override en tests.
- **Errores como `application/problem+json`** — siempre. El `errorHandler` global mapea cualquier excepción a esa forma. Validación AJV → 400, `httpErrors.notFound` → 404, `Prisma.PrismaClientKnownRequestError` → 404/409/422 según el código.
- **Type generation flow**: cada ruta declara `schema.body`, `schema.response`, `schema.params`, etc., con `$ref` a JSON Schemas con `$id`. Esos `$id` se vuelven `components.schemas.<id>` en el OpenAPI output.

### Tests

Los tests del backend usan `fastify.inject()` (no servidor real) contra una **base de datos real** (Postgres dockerizado). Cada test resetea las tablas con un `beforeEach` truncate. La idea es que si los tests pasan, el endpoint funciona end-to-end excepto por la red.

---

## 7. Frontend (`apps/web`)

### Estructura por features

```
features/
├── empleados/
│   ├── api.ts        # imports tipados desde @employeek/api-types
│   ├── components/   # EmpleadoForm, EmpleadosList, etc.
│   ├── hooks.ts      # useEmpleados, useCreateEmpleado (TanStack Query)
│   └── schemas.ts    # Zod schemas para forms
├── estados/
└── tareas/
```

Cada feature es un slice vertical. El componente importa el hook, el hook importa la función `api.ts`, la función `api.ts` usa `lib/http.ts`. Sin barrel files que oculten dependencias.

### Manejo de errores

El backend siempre responde `application/problem+json`. El cliente lanza `ApiProblem extends Error` cuando recibe un 4xx/5xx. El helper `applyProblemToForm` mapea `errors[].path` (formato `body/<campo>`) a errores de React Hook Form. Lo no mapeado cae a un toast Sonner.

```ts
try {
  await createEmpleado(data);
} catch (err) {
  if (err instanceof ApiProblem) {
    applyProblemToForm(err, form.setError);
  } else {
    toast.error("Error inesperado");
  }
}
```

### TanStack Query

Cache de servidor. Una sola fuente de verdad para datos remotos. `useEmpleados()` en cualquier componente devuelve la misma referencia de datos sin re-fetch. Mutations invalidan queries por key — no se duplica estado.

---

## 8. Database (`apps/api/prisma`)

```mermaid
erDiagram
    EMPLEADO ||--o{ TAREA : "tiene"
    ESTADO ||--o{ TAREA : "clasifica"
    EMPLEADO {
        int id PK
        string nombre
        date fechaIngreso
        decimal salario
        timestamp createdAt
        timestamp updatedAt
    }
    ESTADO {
        int id PK
        string nombre UK
        string categoria
        string cambiosPermitidos
    }
    TAREA {
        int id PK
        string nombre
        date fechaCreacion
        date fechaInicioTarea
        date fechaFinalizacion
        int idEmpleado FK
        int idEstado FK
    }
```

- **Foreign keys** con `onDelete: Restrict` (no cascada accidental).
- **Estado.nombre** es UNIQUE (introducido durante el change 3 para enabling idempotent upsert en seed).
- **Estado.cambiosPermitidos**: string CSV de nombres de estados a los que se puede transicionar (ej. `"en-progreso,finalizada"`). Validado por la ruta `PUT /tareas/:id/estado`.
- **Sin `created_at`/`updated_at`** en `Estado` y `Tarea` — el modelo legacy original tenía `timestamps: false` y se preservó.

### Migraciones

`prisma migrate dev` crea archivos numerados en `apps/api/prisma/migrations/`. CI corre `prisma migrate deploy` (sin prompts). El seed (`prisma/seed.ts`) es idempotente — pobla 3 estados base (`pendiente`, `en-progreso`, `finalizada`).

---

## 9. Decisiones clave (ADR-0)

Todas las decisiones quedaron bloqueadas el 2026-04-22 y ya están implementadas.

| Decisión              | Ganadora               | Alternativas descartadas             | Razón                                                              |
| --------------------- | ---------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| Web framework backend | **Fastify 5**          | Express 4, NestJS, Hono              | AJV nativo + plugin ecosystem; menos magic que NestJS              |
| ORM                   | **Prisma 7**           | Sequelize (legacy), Drizzle, TypeORM | Type-safety automática; migrations declarativas                    |
| Bundler frontend      | **Vite 5**             | CRA (legacy), Next.js, Webpack       | Dev server instantáneo; build rápido; sin SSR (no se necesita)     |
| Server state          | **TanStack Query**     | Redux, Zustand, SWR                  | Cache HTTP-aware out-of-the-box                                    |
| Forms                 | **RHF + Zod**          | Formik, react-final-form             | Performance + tipos compartidos con backend                        |
| Monorepo              | **pnpm + Turborepo**   | Nx, Lerna, npm workspaces solo       | Caché por inputs; menos config que Nx; pnpm tiene mejor resolución |
| DB local              | **Docker Compose**     | Postgres en host, SQLite             | Reproducibilidad; mismo Postgres 16 en local y CI                  |
| Validación HTTP       | **AJV via Fastify**    | Zod en backend, Joi                  | Genera el OpenAPI directamente sin paso intermedio                 |
| Error envelope        | **RFC 7807**           | Custom JSON, GraphQL-style           | Estándar interoperable; los browsers ya lo soportan                |
| Type generation       | **openapi-typescript** | tRPC, GraphQL Codegen                | REST clásico; el backend es la fuente, el front consume            |
| Quality enforcement   | **husky + commitlint** | Solo CI sin hooks                    | Catch local antes de push                                          |
| CI                    | **GitHub Actions**     | CircleCI, Drone, GitLab CI           | Donde vive el repo                                                 |

---

## 10. Workflow de desarrollo

### Bootstrap

```bash
git clone <repo>
cd GestionEmpleadosK
cp .env.example .env
pnpm install        # 11s con caché
pnpm db:up          # arranca Postgres en :5432
pnpm db:migrate:deploy && pnpm db:seed
pnpm dev            # api en :4000, web en :5173
```

### Día a día

| Necesito…                     | Comando                                                   |
| ----------------------------- | --------------------------------------------------------- |
| Correr todo                   | `pnpm dev`                                                |
| Solo backend                  | `pnpm --filter @employeek/api dev`                        |
| Solo frontend                 | `pnpm --filter @employeek/web dev`                        |
| Tests                         | `pnpm test`                                               |
| Tests en watch (un workspace) | `pnpm --filter @employeek/web test:watch`                 |
| Cambié schema Prisma          | `pnpm db:migrate`                                         |
| Cambié una ruta o JSON schema | `pnpm api:types`                                          |
| Reproducir CI localmente      | `pnpm ci:local`                                           |
| Reset total de la DB          | `pnpm db:reset && pnpm db:migrate:deploy && pnpm db:seed` |
| Abrir Swagger UI              | `http://localhost:4000/docs`                              |

### Hooks Git (enforced)

- **pre-commit** → `lint-staged` (ESLint + Prettier en archivos staged).
- **commit-msg** → `commitlint` (Conventional Commits estricto).
- **pre-push** → `pnpm typecheck` (todo el monorepo).

### CI (`.github/workflows/ci.yml`)

5 jobs paralelos sobre cada `push` a `main` y cada `pull_request`:

1. **`quality`** — `format:check && lint && typecheck && build` (sin DB).
2. **`test`** — Vitest contra Postgres service container.
3. **`contract-drift`** — regenera tipos OpenAPI y falla si hay diff.
4. **`openspec-sync`** — `openspec validate --changes`.
5. **`commitlint`** — Conventional Commits del rango del PR (solo `pull_request`).

Los 4 primeros son los **status checks requeridos** (cuando se active branch protection).

---

## 11. Convenciones

### Conventional Commits

Formato: `type(scope): subject`. Tipos permitidos: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `revert`.

```
feat(api): add empleados PATCH endpoint
fix(web): handle 422 from create-tarea
chore(deps): bump prisma to 7.9.0
```

Rechazados: `fixed bug`, `update`, `WIP`, mensajes en mayúsculas.

### OpenSpec workflow

Toda change no-trivial pasa por:

```
/new-change <name>          ← crea rama feature + scaffold
  ↓ proposal.md / design.md / specs/<cap>/spec.md / tasks.md
/opsx:apply <name>          ← implementa tareas
  ↓ commits chunked, push, PR, merge
/opsx:archive <name>        ← mueve a archive/, propaga deltas
```

Las specs canónicas en `openspec/specs/` son la fuente de verdad de **qué** debe hacer el sistema. El código las cumple, no las define.

### Naming

- **Workspace packages**: `@employeek/<kebab>` (ej. `@employeek/api`).
- **Branches**: `ch<N>/<change-name>` (ej. `ch4/rebuild-api-fastify-ajv-errors`).
- **Conventional commit scopes**: `api`, `web`, `db`, `ci`, `prisma`, `openspec`, `legacy`, `deps`.

---

## 12. Variables de entorno

Todas en `.env` (gitignored). `.env.example` tiene los valores por defecto comentados.

| Variable             | Default                                                                   | Descripción                                         |
| -------------------- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| `DATABASE_URL`       | `postgresql://employeek:employeek@localhost:5432/employeek?schema=public` | Conexión Postgres                                   |
| `PORT`               | `4000`                                                                    | Puerto HTTP del API                                 |
| `HOST`               | `0.0.0.0`                                                                 | Bind address                                        |
| `CORS_ORIGINS`       | `http://localhost:5173`                                                   | CSV de orígenes permitidos                          |
| `LOG_LEVEL`          | `info`                                                                    | Pino level                                          |
| `OPENAPI_UI_ENABLED` | `true` (dev/test) / `false` (prod)                                        | Expone `/docs` y `/docs/json`                       |
| `POSTGRES_PORT`      | `5432`                                                                    | Puerto host del container (cambiar si está ocupado) |
| `VITE_API_URL`       | `http://localhost:4000`                                                   | Base URL del API (solo `VITE_*` llega al bundle)    |

---

## 13. Cómo extender el sistema

### Agregar un endpoint nuevo

1. (opcional) Crear OpenSpec change si es no-trivial.
2. Agregar/editar el JSON Schema con `$id` en `apps/api/src/schemas/`.
3. Declarar la ruta en `apps/api/src/routes/<entity>.ts` con `schema.body`, `schema.response`, etc.
4. Escribir test de integración en `apps/api/test/`.
5. Correr `pnpm api:types` para regenerar tipos.
6. Consumir en `apps/web/src/features/<entity>/api.ts` con `Schema<...>`.
7. Commit con `feat(api): add <operationId> endpoint`.

### Cambiar el schema de la DB

1. Editar `apps/api/prisma/schema.prisma`.
2. `pnpm db:migrate` — Prisma pregunta el nombre, genera SQL y lo aplica.
3. Si afecta seed: actualizar `apps/api/prisma/seed.ts` y `pnpm db:seed`.
4. El `pnpm db:generate` corre solo en `postinstall`, pero correrlo manualmente si IDE no actualiza tipos.
5. Commit con `feat(db): <descripción>` o `fix(db): <descripción>`.

### Agregar una pantalla nueva en el web

1. Crear feature folder bajo `apps/web/src/features/<nombre>/`.
2. Definir `api.ts` con funciones tipadas desde `@employeek/api-types`.
3. Hooks con TanStack Query en `hooks.ts`.
4. Componentes consumen el hook.
5. Registrar la ruta en `apps/web/src/routes/`.

---

## 14. Historial y referencias

### Plan ADR-0 (cerrado)

8 OpenSpec changes secuenciales (2026-04-22 → 2026-04-28):

1. `scaffold-pnpm-turbo-monorepo`
2. `dockerize-local-postgres`
3. `migrate-sequelize-to-prisma`
4. `rebuild-api-fastify-ajv-errors`
5. `rebuild-web-vite-tanstack-query`
6. `openapi-contract-and-typed-client`
7. `setup-ci-github-actions`
8. `retire-legacy-express-stack`

Todos archivados en `openspec/changes/archive/`. Cada uno contiene su `proposal.md`, `design.md`, `tasks.md` y deltas de specs aplicados.

### Consultar el código legado eliminado

`legacy/` fue eliminado en el commit `07bc06b`. Para inspeccionar:

```bash
git log -- legacy/                      # historial completo del directorio
git show <sha>:legacy/src/<path>        # contenido en cualquier commit anterior
git show 07bc06b^ -- legacy/            # snapshot previo al borrado
```

### Specs canónicas vivas

En `openspec/specs/`. Cada una representa un capability del sistema:

- `monorepo-foundation` — estructura del repo, scripts root, Node/pnpm pinning.
- `api-rest` — comportamiento HTTP del backend.
- `api-contract` — pipeline OpenAPI y `@employeek/api-types`.
- `db-local-postgres` — Docker Compose y scripts DB.
- `db-schema-prisma` — modelos Prisma y constraints.
- `web-ui` — estructura del frontend, manejo de errores, formularios.
- `ci-github-actions` — los 5 jobs y la cache strategy.

### Documentación adicional

- [`README.md`](../README.md) — bootstrap rápido.
- [`CLAUDE.md`](../CLAUDE.md) — contrato de tooling y reglas para contribuidores (humanos o IA).
- `openspec/specs/<capability>/spec.md` — qué debe hacer el sistema (formato SHALL/WHEN/THEN).
- `openspec/changes/archive/<date>-<name>/design.md` — el "por qué" detrás de cada decisión histórica.
