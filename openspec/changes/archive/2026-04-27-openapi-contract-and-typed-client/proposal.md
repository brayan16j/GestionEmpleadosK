# Proposal — `openapi-contract-and-typed-client`

## Why

Hoy el contrato HTTP entre `apps/api` y `apps/web` se duplica a mano: cada esquema AJV en `apps/api/src/schemas/*` se vuelve a teclear como `interface` o `z.object` en `apps/web/src/features/<recurso>/schemas.ts` y `api.ts`. Cualquier cambio en el backend (un campo nuevo, un código de error, un body distinto) requiere editar dos lugares y descubrir el desfase en tiempo de ejecución, casi siempre cuando un usuario ya pegó el error. La API no expone un contrato navegable: no hay `/docs`, no hay JSON OpenAPI, no hay forma de que un cliente externo (o un nuevo frontend) descubra qué endpoints existen ni qué devuelven. Toca abrirlo en CH6 ahora que tenemos backend (CH4) y frontend (CH5) estables: cualquier cambio posterior nace ya con un único contrato.

## What Changes

- Añadir `@fastify/swagger` y `@fastify/swagger-ui` a `apps/api`. Generar el documento OpenAPI 3.1 a partir de los schemas AJV ya existentes (los `$id` y los bloques `schema.{params,body,querystring,response}` se reutilizan tal cual).
- Anotar cada ruta con `tags`, `operationId`, `summary` y `description` para que el OpenAPI resultante sea útil sin retoques manuales.
- Servir el documento JSON en `GET /docs/json` y la UI en `GET /docs` (Swagger UI).
- Crear un nuevo workspace `packages/api-types` (`@employeek/api-types`) que:
  - Genera tipos TypeScript desde el OpenAPI con `openapi-typescript`.
  - Vuelca un snapshot del contrato en `packages/api-types/openapi.json` para que el repo siempre tenga el último contrato versionado.
  - Expone tipos `paths`, `components`, y helpers `Schema<'<id>'>`, `RequestBody<'<op>'>`, `ResponseBody<'<op>', <status>>` para uso ergonómico.
- Sustituir las interfaces manuales en `apps/web/src/features/*/schemas.ts` y los `http<Empleado>(...)` por los tipos generados desde `@employeek/api-types`. Las validaciones de formulario (`zod`) se quedan, pero el tipo de salida del fetch viene del contrato.
- Añadir scripts root: `pnpm api:openapi` (vuelca el JSON) y `pnpm api:types` (regenera `@employeek/api-types`). El segundo depende del primero.
- Añadir un test que falla si `packages/api-types/openapi.json` está desactualizado respecto a `buildApp()` — evita drift silencioso entre código y contrato.

## Capabilities

### New Capabilities

- `api-contract` — el contrato OpenAPI servido por `apps/api` (endpoints `/docs` y `/docs/json`, anotaciones por ruta) y el paquete `@employeek/api-types` que se genera desde él (snapshot, scripts, tipos exportados, regla de no-drift).

### Modified Capabilities

- `api-rest` — añadir requirement de que toda ruta declare `tags` + `operationId` y que el server registre el plugin de swagger; el resto del comportamiento de `api-rest` no cambia.
- `web-ui` — `apps/web` SHALL consumir tipos de `@employeek/api-types` en `src/lib/http.ts` y en `src/features/*/api.ts` (ya no se permiten interfaces manuales que dupliquen el contrato).
- `monorepo-foundation` — registrar `packages/api-types` como nuevo workspace y describir los scripts root (`pnpm api:openapi`, `pnpm api:types`) y su orquestación en Turbo (`build` de `api-types` depende del `openapi:dump` de `apps/api`).

## Impact

- **Código afectado en `apps/api`:** un nuevo `src/openapi.ts` que registra `@fastify/swagger` con los metadatos del documento; cada archivo de `src/routes/*.ts` recibe `tags` + `operationId` + `summary` por endpoint. Se añade un script `openapi:dump` que invoca `buildApp()` y escribe `packages/api-types/openapi.json`.
- **Código afectado en `apps/web`:** `src/lib/http.ts` se reescribe con un overload tipado por `paths`. `src/features/*/api.ts` y `schemas.ts` pierden las interfaces manuales y usan los tipos del contrato.
- **Código afectado en `legacy/`:** ninguno (sigue en cuarentena).
- **Dependencias nuevas:** `@fastify/swagger`, `@fastify/swagger-ui`, `openapi-typescript` (este último como devDep en `packages/api-types`).
- **Dependencias removidas:** ninguna (las interfaces manuales se borran de `apps/web`, no son paquetes).
- **CI/local DX:** se añade un check en `pnpm test` que falla si `openapi.json` tiene drift; los desarrolladores corren `pnpm api:types` después de tocar un schema o una ruta.
- **Riesgos:** el dump del OpenAPI requiere bootear `buildApp()` sin abrir socket; si una ruta falta de `operationId`, el documento queda con nombres genéricos (`getEmpleadosId`) y los tipos generados son frágiles — el spec exige `operationId` en cada ruta para evitarlo.
