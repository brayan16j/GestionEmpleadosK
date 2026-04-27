# Design — `openapi-contract-and-typed-client`

## Context

Tras CH4 y CH5, `apps/api` y `apps/web` son TypeScript estricto pero el contrato HTTP entre ambos es prosa: el backend declara schemas AJV con `$id` (p. ej. `Empleado`, `CreateEmpleadoBody`), y el frontend redefine las mismas formas a mano en `apps/web/src/features/<recurso>/schemas.ts`. Cada cambio en el backend requiere una edición coordinada en el frontend; el linter no detecta el desfase.

Por otro lado, no existe documentación navegable de la API. Para alguien que llega nuevo, descubrir endpoints implica leer `apps/api/src/routes/*.ts`. Eso bloquea cualquier consumidor externo, y es un blocker de facto para CI (CH7), donde el contrato debería ser un artefacto versionado y comparable entre PRs.

CH6 abre el contrato OpenAPI como single source of truth y genera tipos TypeScript desde él. Aprovechamos que los schemas AJV ya tienen `$id`, así que `@fastify/swagger` los reusa como `components.schemas.<id>` sin cambiar el código de validación.

## Goals / Non-Goals

**Goals:**

- Servir el documento OpenAPI 3.1 en `GET /docs/json` y la UI en `GET /docs`, derivado automáticamente de los schemas AJV existentes.
- Anotar cada ruta con `tags`, `operationId`, `summary` y `description` — sin esto, los nombres generados son frágiles y los tipos del cliente quedan ilegibles.
- Crear `packages/api-types` (`@employeek/api-types`) que genera tipos TS con `openapi-typescript` y los expone con helpers ergonómicos.
- Versionar `packages/api-types/openapi.json` (el snapshot del contrato) y bloquear el drift: si tocas una ruta y no regeneras, el test falla.
- Reescribir `apps/web/src/lib/http.ts` y los `apps/web/src/features/*/api.ts` para consumir tipos generados, eliminando las interfaces manuales.

**Non-Goals:**

- No cambiar el modelo de errores (`api-rest` ya define el RFC 7807); solo se documenta en el OpenAPI.
- No introducir validación runtime en el cliente desde el OpenAPI (el frontend sigue usando `zod` para forms; el contrato genera **tipos**, no validators).
- No publicar `@employeek/api-types` a npm — es un paquete interno del workspace.
- No cubrir auth (no hay auth en EmployeeK aún).
- No mover los schemas AJV a Zod ni reescribirlos. El backend mantiene AJV; solo añadimos metadatos OpenAPI sobre lo que ya existe.
- No abrir Swagger UI en producción por defecto; CH6 deja el endpoint protegido por env (`OPENAPI_UI_ENABLED`) con default `true` en dev/test y `false` en prod.

## Decisions

### D1. Generador de OpenAPI: `@fastify/swagger` (no `fastify-swagger-ui-bundle` ni alternativa custom)

`@fastify/swagger` lee directamente los `schema.{params,body,querystring,response}` de cada ruta y los `$id`s de los schemas registrados. Es la opción canónica del ecosistema Fastify, mantenida por el core team, sin `peerDependencies` exóticas. Genera OpenAPI 3.1 (preferido sobre 3.0 porque el `format: 'date-time'` y `nullable` son nativos).

**Alternativas descartadas:**

- *`fastify-oas`* — sin actualizar para Fastify 5, comunidad muerta.
- *`zod-to-openapi` + reescribir schemas en zod* — implicaría reescribir `apps/api/src/schemas/*.ts`, fuera de scope. Lo apuntamos como follow-up para una eventual unificación.
- *Hand-written `openapi.yaml`* — anula el beneficio de single source of truth.

### D2. UI: `@fastify/swagger-ui` montado en `/docs`

Swagger UI es lo que la mayoría de devs reconoce. Lo montamos en `/docs` (UI) y `/docs/json` (raw doc). Alternativa considerada: `@scalar/fastify-api-reference` (más bonito, mejor DX), pero arrastra dependencia adicional y CSS pesado. Mantenemos Swagger UI por ser estándar y minimal.

### D3. Generador de tipos TS: `openapi-typescript` (no `openapi-fetch`, no `orval`, no `swagger-typescript-api`)

`openapi-typescript` produce **solo** tipos: un archivo `paths` (mapa endpoint → método → request/response) y `components` (mapa de schemas). Nada de runtime, nada de clientes generados. Esto encaja con nuestra arquitectura: ya tenemos `http()` en `apps/web/src/lib/http.ts` y queremos mantener su control.

**Alternativas descartadas:**

- *`openapi-fetch`* — genera un cliente runtime. Innecesario; nuestro `http()` ya hace lo justo.
- *`orval`* — genera hooks de TanStack Query directamente. Atractivo, pero opina demasiado sobre la forma de los hooks (queryKeys, error handling) y nos forzaría a adoptar su estilo. Lo descartamos para mantener consistencia con los hooks ya escritos a mano.
- *`swagger-typescript-api`* — genera clases. Fuera de estilo del proyecto (funcional + hooks).

### D4. Snapshot del OpenAPI versionado en el repo (`packages/api-types/openapi.json`)

El JSON del OpenAPI se commitea. Razones:

1. **Diff revisable.** En un PR, un cambio en el contrato se ve como diff en `openapi.json`. Sin esto, los reviewers tendrían que correr la API localmente para descubrir si el contrato cambió.
2. **No-drift test.** El test compara `JSON.stringify(buildApp().swagger())` contra el archivo en disco. Si difieren, el test falla con instrucción clara: `pnpm api:types`. Esto bloquea PRs con tipos desincronizados.
3. **Independencia del consumidor.** `packages/api-types` puede regenerar sus `.d.ts` sin necesidad de la DB ni de bootear la API; basta con leer el archivo.

**Alternativa descartada:** generar el snapshot en CI sin commitear. Pierde el diff revisable y obliga al consumidor a tener el backend corriendo.

### D5. Scripts y orquestación Turbo

- `pnpm api:openapi` (root) → `pnpm --filter @employeek/api openapi:dump` → ejecuta `apps/api/scripts/dump-openapi.ts` que llama a `buildApp({ logger: false })`, lee `app.swagger()`, y escribe `packages/api-types/openapi.json` (sin formatear; Prettier lo deja consistente). El script no necesita DB porque `buildApp` decora `prisma` pero ningún query corre durante el dump.
- `pnpm api:types` (root) → corre `api:openapi` y luego `pnpm --filter @employeek/api-types build`, que invoca `openapi-typescript ./openapi.json -o ./dist/index.d.ts`.
- `turbo.json`: la tarea `build` de `@employeek/api-types` declara `dependsOn: ["@employeek/api#openapi:dump"]` para que `pnpm build` desde root produzca tipos frescos.

### D6. Forma del paquete `@employeek/api-types`

```
packages/api-types/
  package.json          # name: @employeek/api-types, type: module
  openapi.json          # snapshot del contrato (commiteado)
  src/index.ts          # re-exporta paths/components + helpers
  dist/
    index.d.ts          # generado por openapi-typescript
    index.js            # stub vacío (módulo de tipos)
```

`src/index.ts` exporta tipos como:

```ts
export type { paths, components } from "./generated.js";

export type Schema<K extends keyof components["schemas"]> = components["schemas"][K];

export type RequestBody<
  P extends keyof paths,
  M extends keyof paths[P],
> = paths[P][M] extends { requestBody: { content: { "application/json": infer B } } } ? B : never;

export type ResponseBody<
  P extends keyof paths,
  M extends keyof paths[P],
  S extends number = 200,
> = /* ... extrae 2xx/4xx con narrowing ... */;
```

El consumidor importa: `import type { Schema, RequestBody, ResponseBody } from "@employeek/api-types"`.

### D7. http.ts tipado por `paths`

`apps/web/src/lib/http.ts` queda con un overload genérico que acepta `path` literal y `method` literal y deriva el tipo de respuesta del contrato:

```ts
export function http<
  P extends keyof paths,
  M extends keyof paths[P] & HttpMethod,
>(method: M, path: P, body?: RequestBody<P, M>): Promise<ResponseBody<P, M>>;
```

Esto da error de compilación si alguien llama `http("GET", "/empleados")` esperando un `string` en lugar de `Empleado[]`. Ningún feature/api.ts necesita pasar genéricos manualmente.

### D8. Frontend conserva sus zod schemas para forms

Los `z.object` en `apps/web/src/features/<recurso>/schemas.ts` se quedan **solo** como validadores de formulario (React Hook Form). Las interfaces `Empleado`, `CreateEmpleadoInput`, etc. desaparecen porque ahora son `Schema<'Empleado'>`, `RequestBody<'/empleados', 'post'>`. El zod schema de formulario y el tipo del contrato se conectan con un test (`expectTypeOf`) que verifica compatibilidad — opcional para CH6, lo apuntamos como mejora.

### D9. operationId convention: `<resource><Action>`

Cada ruta declara `operationId` con la convención `listEmpleados`, `getEmpleado`, `createEmpleado`, `updateEmpleado`, `deleteEmpleado`, `listTareasForEmpleado`, `listEstados`, etc. Esto produce keys en `paths` y `components` predecibles. El spec exige el formato camelCase y rechaza nombres genéricos auto-generados.

### D10. Plugin de Swagger registrado **antes** de las rutas

`@fastify/swagger` necesita estar registrado antes de los plugins de rutas para que el hook `onRoute` capture cada ruta. El registro va justo después del CORS y antes de las rutas. La UI (`@fastify/swagger-ui`) puede registrarse después (no afecta el doc).

## Risks / Trade-offs

- **[Riesgo] Drift silencioso entre `openapi.json` y el código** — un dev modifica una ruta y olvida correr `pnpm api:types`. → Mitigación: test `openapi-snapshot.test.ts` en `apps/api/test/` que falla con mensaje explícito; corre en `pnpm test`.
- **[Riesgo] `buildApp()` requiere `DATABASE_URL` para bootear (env validation)** — el dump no usa DB pero el plugin `@fastify/env` aborta si falta. → Mitigación: el script `dump-openapi.ts` carga `.env` via `dotenv-flow`, y el spec exige que `.env.example` tenga `DATABASE_URL` con un valor placeholder válido (URL bien formada aunque la DB no exista).
- **[Riesgo] OpenAPI 3.1 vs 3.0** — algunas tools (linters viejos) solo soportan 3.0. → Aceptado: `openapi-typescript` y Swagger UI lo soportan; si CH7 introduce una tool 3.0-only, downgradeamos vía flag de `@fastify/swagger`.
- **[Riesgo] Swagger UI en producción** — expone superficie y endpoints internos. → Mitigación: env `OPENAPI_UI_ENABLED` (default `false` en `NODE_ENV=production`). El `/docs/json` también es opt-in en prod.
- **[Trade-off] Frontend pierde flexibilidad para campos "extra"** — si el back devuelve un campo no documentado, los tipos no lo conocen. → Aceptado: forzar disciplina; los campos no documentados deberían no existir.
- **[Trade-off] Generación lenta en CI** — `pnpm api:types` añade ~3s al build. → Aceptado; Turbo cachea por inputs.

## Migration Plan

1. Añadir dependencias y registrar swagger en `apps/api` sin tocar el frontend. Verificar `/docs/json` localmente y commitear el snapshot inicial.
2. Crear `packages/api-types` con el primer build de tipos. Confirmar que `pnpm typecheck` sigue verde.
3. Reescribir `apps/web/src/lib/http.ts` para aceptar el path/method tipados, **manteniendo la firma legacy `http<T>(method, path, body)` como overload** durante esta tarea para que los call sites compilen incrementalmente.
4. Migrar `features/empleados`, luego `features/estados`, luego `features/tareas` — uno por uno, borrando las interfaces manuales y el overload legacy al final.
5. Eliminar el overload legacy y dejar solo la firma tipada por `paths`.
6. Añadir el test de no-drift y el script `pnpm api:types` al `tasks.md`.

**Rollback:** si la generación de tipos rompe algo bloqueante, revertir el commit que reescribió `http.ts` deja a `apps/web` en su estado actual (interfaces manuales). El backend con `@fastify/swagger` puede quedarse — no rompe nada en el frontend.

## Open Questions

- ¿Versionamos el contrato (`info.version`) atado al package.json de `apps/api`, o lo pisamos a `0.1.0` hasta CH7? → Propongo atarlo a `apps/api/package.json#version` para que cada PR refleje el bump.
- ¿`packages/api-types` exporta también un cliente fetcher tipado (helper + hooks) o solo tipos crudos? → Para CH6 mantenemos solo tipos. Si CH8 (retiro de legacy) o un change posterior pide hooks generados, lo evaluamos entonces.
