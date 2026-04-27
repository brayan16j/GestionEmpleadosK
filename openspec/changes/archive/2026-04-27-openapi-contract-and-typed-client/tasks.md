# Tasks — `openapi-contract-and-typed-client`

## 1. API: registrar swagger y env nuevo

- [x] 1.1 Añadir `@fastify/swagger` y `@fastify/swagger-ui` a `apps/api/package.json` (`dependencies`).
- [x] 1.2 Extender `apps/api/src/config/env.ts` con `OPENAPI_UI_ENABLED: z.coerce.boolean()` y default por `NODE_ENV` (`true` en dev/test, `false` en prod). Regenerar `envJsonSchema`.
- [x] 1.3 Documentar `OPENAPI_UI_ENABLED` en `.env.example` con un comentario breve sobre el default en producción.
- [x] 1.4 Crear `apps/api/src/openapi.ts` con un plugin que registre `@fastify/swagger` (OpenAPI 3.1, `info.title`, `info.version` desde `package.json`, `info.description`, `servers: [{ url: \`http://localhost:${PORT}\` }]`).
- [x] 1.5 En `apps/api/src/app.ts`, registrar el plugin de swagger después de `fastifyCors` y antes del primer `app.register(*Routes, ...)`. Si `app.config.OPENAPI_UI_ENABLED === true`, registrar también `@fastify/swagger-ui` con `routePrefix: "/docs"`.
- [x] 1.6 Confirmar manualmente con `pnpm --filter @employeek/api dev` que `GET /docs/json` devuelve un OpenAPI válido y `GET /docs` la UI.

## 2. API: anotar cada ruta con metadatos OpenAPI

- [x] 2.1 `apps/api/src/routes/health.ts` — añadir `tags: ["Health"]`, `operationId` (`livenessCheck`, `readinessCheck`), `summary`, `description` a cada ruta.
- [x] 2.2 `apps/api/src/routes/empleados.ts` — añadir metadatos para `listEmpleados`, `getEmpleado`, `createEmpleado`, `updateEmpleado`, `deleteEmpleado`, `listTareasForEmpleado` (tag `Empleados`).
- [x] 2.3 `apps/api/src/routes/estados.ts` — añadir metadatos para `listEstados`, `getEstado`, `createEstado`, `updateEstado`, `deleteEstado` (tag `Estados`).
- [x] 2.4 `apps/api/src/routes/tareas.ts` — añadir metadatos para `listTareas`, `getTarea`, `listTareasByCategoria`, `createTarea`, `updateTarea`, `changeTareaEstado`, `deleteTarea` (tag `Tareas`).
- [x] 2.5 Reforzar el hook `onRoute` existente en `app.ts` para que también valide presencia de `operationId` y rechace el boot si falta (mensaje claro con la URL ofensora).
- [x] 2.6 Inspeccionar `/docs/json` en local y confirmar que cada `paths.<...>.operationId` es único y camelCase.

## 3. API: script `openapi:dump`

- [x] 3.1 Crear `apps/api/scripts/dump-openapi.ts` que: (a) carga `.env` con `process.loadEnvFile()`, (b) llama `buildApp({ logger: false })`, (c) toma `app.swagger()`, (d) escribe el resultado en `packages/api-types/openapi.json` con `JSON.stringify(doc, null, 2) + "\n"`, (e) `await app.close()` y `process.exit(0)`.
- [x] 3.2 Añadir a `apps/api/package.json` el script `"openapi:dump": "tsx scripts/dump-openapi.ts"`.
- [x] 3.3 Verificar que el script funciona con la DB apagada (es decir, sin `pnpm db:up`). Ajustar `db/client.ts` si Prisma intenta conectar al boot — debe ser lazy.
- [x] 3.4 Hacer una primera corrida del dump y commitear el `openapi.json` resultante.

## 4. Nuevo workspace `packages/api-types`

- [x] 4.1 Crear `packages/api-types/package.json` con `name: "@employeek/api-types"`, `version: "0.0.0"`, `private: true`, `type: "module"`, `main: "./dist/index.js"`, `types: "./dist/index.d.ts"`, `exports: { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } }`, `files: ["dist", "openapi.json"]`. Incluir `scripts.build`, `scripts.lint`, `scripts.typecheck`, `scripts.clean`.
- [x] 4.2 Añadir devDependencies: `openapi-typescript`, `typescript`, `@employeek/tsconfig: workspace:*`.
- [x] 4.3 Crear `packages/api-types/tsconfig.json` extendiendo `@employeek/tsconfig/base.json` con `outDir: "dist"`, `declaration: true`, `declarationMap: true`, `rootDir: "src"`.
- [x] 4.4 Crear `packages/api-types/src/index.ts` que re-exporta `paths` y `components` desde `./generated.js` y define los helpers `Schema<K>`, `RequestBody<P, M>`, `ResponseBody<P, M, S = 200>` (ver `design.md` D6 para la forma exacta).
- [x] 4.5 Configurar el script `build`: `openapi-typescript ./openapi.json -o ./src/generated.ts && tsc --build`.
- [x] 4.6 Añadir `packages/api-types/src/generated.ts` y `packages/api-types/dist/` al `.gitignore` (root o local).
- [x] 4.7 Correr `pnpm install` y `pnpm --filter @employeek/api-types build`. Verificar que `dist/index.d.ts` exporta los tipos esperados.

## 5. Orquestación Turbo y scripts root

- [x] 5.1 En `turbo.json`, añadir tarea `@employeek/api#openapi:dump` con `outputs: ["../../packages/api-types/openapi.json"]` y `inputs: ["src/**", "package.json", "tsconfig.json"]`.
- [x] 5.2 En `turbo.json`, añadir/extender la tarea `@employeek/api-types#build` con `dependsOn: ["@employeek/api#openapi:dump"]` y `inputs: ["openapi.json", "src/**", "tsconfig.json", "package.json"]`, `outputs: ["dist/**", "src/generated.ts"]`.
- [x] 5.3 Añadir scripts a la `package.json` del root: `"api:openapi": "pnpm --filter @employeek/api openapi:dump"` y `"api:types": "pnpm api:openapi && pnpm --filter @employeek/api-types build"`.
- [x] 5.4 Validar `pnpm build` desde root: debe correr `openapi:dump` antes que `api-types#build` y dejar `dist/` actualizado.

## 6. Test de no-drift

- [x] 6.1 Crear `apps/api/test/openapi-snapshot.test.ts`: usa `buildApp({ logger: false })`, lee `packages/api-types/openapi.json`, compara strings (formato idéntico al script de dump). Falla con mensaje literal `OpenAPI snapshot is out of date. Run 'pnpm api:types' to regenerate.`.
- [x] 6.2 Ejecutar `pnpm --filter @employeek/api test` y confirmar que el test pasa.
- [x] 6.3 Verificar manualmente: editar el `summary` de una ruta, NO regenerar, correr `test` y comprobar que falla con el mensaje esperado. Revertir.

## 7. Migrar `apps/web` a tipos generados

- [x] 7.1 Añadir `@employeek/api-types: workspace:*` a `apps/web/package.json` (`dependencies`).
- [x] 7.2 Reescribir `apps/web/src/lib/http.ts` con la firma genérica tipada por `paths` (ver `design.md` D7). Mantener temporalmente un overload legacy `http<T>(method: string, path: string, body?: unknown): Promise<T>` para migración incremental.
- [x] 7.3 Migrar `apps/web/src/features/empleados/api.ts` para usar `http('GET', '/empleados')`, etc., sin pasar genéricos. Borrar `interface Empleado` y otras formas duplicadas en `schemas.ts` (mantener solo los `z.object` de formularios). Actualizar imports en `EmpleadosList.tsx`, `EmpleadoDetail.tsx`, `EmpleadoForm.tsx`, `queries.ts`.
- [x] 7.4 Migrar `apps/web/src/features/estados/api.ts` y archivos relacionados (idéntico patrón).
- [x] 7.5 Migrar `apps/web/src/features/tareas/api.ts` y archivos relacionados.
- [x] 7.6 Eliminar el overload legacy de `http.ts`. Correr `pnpm --filter @employeek/web typecheck` y `pnpm --filter @employeek/web lint`. Resolver cualquier desfase.
- [x] 7.7 Correr `pnpm --filter @employeek/web test` (jsdom) y confirmar que los tests siguen pasando.
- [x] 7.8 Verificación manual: `pnpm dev`, navegar las pantallas de empleados/estados/tareas, comprobar que la app sigue funcionando idénticamente.

## 8. Documentación

- [x] 8.1 Añadir a `CLAUDE.md` una subsección "OpenAPI contract" bajo "HTTP API" que cubra: cómo abrir `/docs`, cómo regenerar tipos (`pnpm api:types`), regla de no-drift, dónde vive `packages/api-types`, cómo importar `Schema<...>`, `RequestBody<...>`, `ResponseBody<...>`.
- [x] 8.2 Confirmar que `.env.example` documenta `OPENAPI_UI_ENABLED`.

## 9. Cierre

- [x] 9.1 Correr `pnpm lint && pnpm typecheck && pnpm build && pnpm db:up && pnpm db:migrate:deploy && pnpm db:seed && pnpm test` desde el root. Todo debe pasar.
- [x] 9.2 Hacer un único commit por tarea lógica siguiendo Conventional Commits (`feat(api):`, `feat(types):`, `refactor(web):`, `docs:`).
- [x] 9.3 Marcar `[x]` cada tarea al cerrarla. Cuando todas estén `[x]`, ejecutar `/opsx:archive`.
