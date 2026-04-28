# Design — `retire-legacy-express-stack`

## Context

`legacy/` es la app Express 4 + Sequelize 6 + JS original. Vive en cuarentena desde el change 1 (`scaffold-pnpm-turbo-monorepo`, 2026-04-22): no está en `pnpm-workspace.yaml`, no está en Turbo, no está en CI. Existe solo como referencia mientras se reescribió el stack hacia Fastify 5 + Prisma 7 + TS estricto.

Estado actual (2026-04-28):
- 7 changes archivados, los 17 endpoints originales reescritos en `apps/api/src/routes/` con tests de integración pasando.
- CI corriendo en GitHub Actions con 5 jobs gatean `main`.
- `legacy/` sigue intacta en disco con su `node_modules/` instalado, `package.json` con `nodemon`, controllers, validators y rutas Sequelize. Nadie la corre, pero ahí está.
- Vulnerabilidades conocidas en `legacy/`: SQL injection en `src/controllers/tareasController.js:203` (`sequelize.literal` con interpolación) y credenciales hardcoded en `src/database/database.js`. Eliminadas indirectamente al reescribir, pero el código vulnerable sigue versionado.

Stakeholders: Brayan (autor único). No hay consumidores externos del legacy.

## Goals / Non-Goals

**Goals:**

- Eliminar `legacy/` del repositorio (árbol completo).
- Limpiar todas las referencias a `legacy/` en config y documentación, de forma que un contribuidor nuevo no tenga que preguntarse qué fue ese directorio.
- Retirar el requirement de cuarentena de la spec canónica `monorepo-foundation` (delta REMOVED).
- Documentar el mapeo de paridad endpoint-a-endpoint como evidencia de que el borrado es seguro.
- Cerrar el plan ADR-0 (8/8) y actualizar la memoria del proyecto.

**Non-Goals:**

- No reescribir nada en `apps/api`. Si aparece una discrepancia funcional vs el legacy durante el audit, se documenta como follow-up — no se resuelve en este change.
- No introducir features nuevas (auth, observabilidad, etc.).
- No tocar specs canónicas distintas de `monorepo-foundation`.
- No modificar `package.json` root, `pnpm-workspace.yaml`, ni `turbo.json` — `legacy/` ya está fuera de esos archivos por construcción.
- No tocar `.gitignore` (no menciona `legacy/`).

## Decisions

### D1. Borrado por `git rm -rf legacy/` en lugar de mover a un branch de archivo

- **Decisión:** ejecutar `git rm -rf legacy/` en una sola operación. El historial de Git preserva todo lo necesario; cualquier consulta futura se hace con `git log -- legacy/` o `git show <sha>:legacy/<path>`.
- **Alternativa considerada:** crear una rama `archive/legacy` con el último estado y luego borrar de `main`. Rechazada porque añade ruido (rama eterna que nadie va a leer) y Git ya cumple ese rol con el historial.
- **Por qué:** cero deuda residual; el repo queda más limpio para revisores y para Claude (no más exclusiones de `legacy/` en grep/find).

### D2. Audit de paridad documentado en `design.md`, no como tabla en `tasks.md`

- **Decisión:** la matriz de los 17 endpoints va abajo, en la sección "Audit de paridad". `tasks.md` solo tiene una tarea que dice "verificar la matriz contra `apps/api/src/routes/` y marcarla `[x]` cuando esté validada".
- **Alternativa considerada:** tabla en `tasks.md`. Rechazada porque `tasks.md` es checklist accionable; una tabla de auditoría no se "marca como hecha", se revisa.
- **Por qué:** mantiene `tasks.md` enfocado en el flujo de ejecución y deja el evidencialque queda archivado en `design.md` para referencia futura.

### D3. Delta a `monorepo-foundation` con `## REMOVED Requirements` (no MODIFIED, no edición directa)

- **Decisión:** el único cambio en specs es un bloque REMOVED para el requirement `Legacy code quarantined under legacy/`. El resto de `monorepo-foundation` no se toca.
- **Alternativa considerada:** edición directa de `openspec/specs/monorepo-foundation/spec.md` saltándose el flujo OpenSpec. Rechazada — viola el principio del workflow (los cambios a specs canónicas siempre pasan por una change con delta).
- **Por qué:** el delta REMOVED deja constancia explícita de que el contrato de cuarentena terminó. Cualquiera que haga `git log openspec/specs/monorepo-foundation/spec.md` verá la archivación de este change como el momento donde el contrato fue retirado.

### D4. No tocar `.gitignore`

- **Decisión:** `.gitignore` no menciona `legacy/` y no necesita cambios.
- **Por qué:** `legacy/node_modules/` ya está cubierto por la regla genérica `node_modules/`. No hay otra exclusión específica del legacy en el repo.

### D5. Validación final solo con `pnpm ci:local` y `pnpm test`

- **Decisión:** la última tarea corre los dos comandos y verifica que ambos pasan. Si alguno rompe por culpa del borrado (cosa improbable), se identifica antes del PR.
- **Alternativa considerada:** correr `pnpm dev` y verificar manualmente que el API arranca. Rechazada como redundante — `pnpm test` ya levanta `buildApp()` para los tests de integración, y `pnpm ci:local` cubre format/lint/typecheck/build.

## Audit de paridad — 17 endpoints originales del legacy

Mapeo del legacy hacia `apps/api/src/routes/`. Confirmar cada fila durante la fase apply (tarea 4.x) leyendo ambos archivos y marcándola como verificada.

| # | Método | Path legacy | Controller legacy | Path Fastify | Route Fastify | Status |
| - | ------ | ----------- | ----------------- | ------------ | ------------- | ------ |
| 1 | GET | `/empleados` | `empleadosController.list` | `/empleados` | `apps/api/src/routes/empleados.ts` | pendiente verificar |
| 2 | GET | `/empleados/:id` | `empleadosController.getById` | `/empleados/:id` | `apps/api/src/routes/empleados.ts` | pendiente verificar |
| 3 | POST | `/empleados` | `empleadosController.create` | `/empleados` | `apps/api/src/routes/empleados.ts` | pendiente verificar |
| 4 | PUT | `/empleados/:id` | `empleadosController.update` | `/empleados/:id` | `apps/api/src/routes/empleados.ts` | pendiente verificar |
| 5 | DELETE | `/empleados/:id` | `empleadosController.delete` | `/empleados/:id` | `apps/api/src/routes/empleados.ts` | pendiente verificar |
| 6 | GET | `/estados` | `estadoController.list` | `/estados` | `apps/api/src/routes/estados.ts` | pendiente verificar |
| 7 | GET | `/estados/:id` | `estadoController.getById` | `/estados/:id` | `apps/api/src/routes/estados.ts` | pendiente verificar |
| 8 | POST | `/estados` | `estadoController.create` | `/estados` | `apps/api/src/routes/estados.ts` | pendiente verificar |
| 9 | PUT | `/estados/:id` | `estadoController.update` | `/estados/:id` | `apps/api/src/routes/estados.ts` | pendiente verificar |
| 10 | DELETE | `/estados/:id` | `estadoController.delete` | `/estados/:id` | `apps/api/src/routes/estados.ts` | pendiente verificar |
| 11 | GET | `/tareas` | `tareasController.list` | `/tareas` | `apps/api/src/routes/tareas.ts` | pendiente verificar |
| 12 | GET | `/tareas/:id` | `tareasController.getById` | `/tareas/:id` | `apps/api/src/routes/tareas.ts` | pendiente verificar |
| 13 | POST | `/tareas` | `tareasController.create` | `/tareas` | `apps/api/src/routes/tareas.ts` | pendiente verificar |
| 14 | PUT | `/tareas/:id` | `tareasController.update` | `/tareas/:id` | `apps/api/src/routes/tareas.ts` | pendiente verificar |
| 15 | DELETE | `/tareas/:id` | `tareasController.delete` | `/tareas/:id` | `apps/api/src/routes/tareas.ts` | pendiente verificar |
| 16 | GET | `/tareas/empleado/:empleadoId` | `tareasController.listByEmpleado` | `/tareas/empleado/:empleadoId` (o equivalente) | `apps/api/src/routes/tareas.ts` | pendiente verificar |
| 17 | PATCH | `/tareas/:id/estado` | `tareasController.changeEstado` | `/tareas/:id/estado` (o equivalente) | `apps/api/src/routes/tareas.ts` | pendiente verificar |

> **Nota:** los path exactos de los endpoints 16 y 17 (los "no-CRUD" sobre `tareas`) deben confirmarse leyendo ambos lados. Si un path difiere, se documenta como follow-up — no se modifica `apps/api` en esta change.

## Risks / Trade-offs

- **[Riesgo]** Endpoint del legacy no portado al Fastify se descubre tarde. → **Mitigación:** el audit de paridad arriba es la salvaguarda. Si alguno aparece como "no portado" durante la fase apply, se documenta como follow-up y el borrado se aplaza (se decide en el momento si bloquear el merge o aceptar la deuda).
- **[Riesgo]** Una build de IDE / Sonar / pipeline desconocido apuntando a `legacy/`. → **Mitigación:** confirmado con el usuario que no hay integraciones externas. El `sonar-project.properties` que se va era exclusivo del legacy.
- **[Trade-off]** Perdemos la posibilidad de "comparar contra el legacy a un click". → **Aceptable:** el historial Git lo preserva. `git show <último-sha-en-main>:legacy/src/...` recupera cualquier archivo en cualquier momento.
- **[Riesgo]** Documentación con menciones residuales de `legacy/` que se nos pasen. → **Mitigación:** la tarea 5.x corre `git grep -i legacy` (excluyendo `openspec/changes/archive/`) como verificación final antes del commit del borrado. Cualquier match restante se atiende antes de cerrar.

## Migration Plan

1. Branch ya creada (`ch8/retire-legacy-express-stack`).
2. Audit de paridad — verificar tabla arriba contra `apps/api/src/routes/`.
3. `git rm -rf legacy/` y commit (`chore(legacy): remove quarantined Express+Sequelize app`).
4. Limpiar referencias en `.prettierignore`, `CLAUDE.md`, `README.md` en commits separados (uno por archivo) para diff-readability.
5. Aplicar el delta a `monorepo-foundation` (cuando se archive este change, el bloque REMOVED elimina el requirement de la spec canónica).
6. Correr `pnpm ci:local && pnpm test` localmente.
7. PR a `main`. Esperar verde de los 5 jobs CI.
8. Merge, archivar el change con `/opsx:archive retire-legacy-express-stack`.
9. Actualizar memoria del proyecto: cuarentena retirada, plan ADR-0 cerrado 8/8.

**Rollback:** si después del borrado aparece una regresión imposible de resolver rápido, `git revert <sha>` del commit de borrado restaura `legacy/` exacto. El rollback de las limpiezas de `.prettierignore`/`CLAUDE.md`/`README.md` es trivial (commits independientes).

## Open Questions

Ninguna pendiente. Los puntos abiertos durante la conversación previa al change quedaron resueltos:

- ¿Hay integraciones externas con `legacy/`? — No (confirmado).
- ¿Branch dedicada o merge directo? — Branch + PR (siguiendo el patrón de los 7 changes anteriores).
- ¿Algún endpoint sin portar? — Pendiente del audit en fase apply, pero baja probabilidad dado que los tests de integración del change 4 cubren las 3 entidades.
