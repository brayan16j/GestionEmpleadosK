# Proposal — `retire-legacy-express-stack`

## Why

La refundación EmployeeK está completa: el API Fastify (`apps/api`) tiene paridad funcional con los 17 endpoints del Express+Sequelize legado, está cubierto por tests de integración, y CI ya lo gatea desde el change anterior. El directorio `legacy/` cumplió su función como referencia durante la reescritura, pero ahora es deuda muerta — confunde a contribuidores nuevos, ocupa espacio en el repo, y mantiene en disco código con vulnerabilidades conocidas (SQL injection en `tareasController.js:203`, credenciales hardcoded en `database/database.js`). Este change cierra el plan ADR-0 (8/8) y elimina la cuarentena.

## What Changes

- **BREAKING (para usuarios del legacy)**: se elimina `legacy/` por completo. Cualquiera que estuviera corriendo `cd legacy && npm install && npm run dev` debe migrar al nuevo stack (`pnpm dev`). El SQL del legacy y sus migraciones Sequelize ya quedaron portadas a Prisma en el change 3, así que no hay dato que rescatar.
- Se borra `legacy/` (el árbol completo: `src/`, `models/`, `config/`, `package.json`, `package-lock.json`, `sonar-project.properties`, `node_modules/`).
- Se limpian las referencias residuales:
  - `.prettierignore` — quitar la línea `legacy/`.
  - `CLAUDE.md` — quitar la entrada de `legacy/` en _Repository layout_, la nota de _Port 4000 clash_, la sección _Quarantined code — do not modify_, y el bullet "Never touch `legacy/`" en _When Claude is asked to do work_.
  - `README.md` — quitar la línea de `legacy/` en el árbol y el bullet "Never modify files under `legacy/`".
- Se documenta en el change un audit de paridad endpoint-a-endpoint (los 17 endpoints originales del legacy mapeados a `apps/api/src/routes/`) como evidencia de que el borrado es seguro. No es código, es una tabla en `design.md`.
- Se valida con `pnpm ci:local` y `pnpm test` que la limpieza no rompe nada.

No se reescribe ni se agrega código en `apps/api`. No se introduce ninguna feature nueva.

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `monorepo-foundation`: el requirement `Legacy code quarantined under legacy/` se retira (delta `## REMOVED Requirements`). Era el contrato que protegía el directorio; al desaparecer el directorio, el contrato deja de aplicar.

## Impact

- **Código eliminado**: ~1.5k LOC (Express controllers, Sequelize models, validators, routers, helpers) más `node_modules/` local del legacy.
- **Documentación tocada**: `CLAUDE.md`, `README.md`, `.prettierignore`.
- **Specs canónicas**: solo `monorepo-foundation` (delta REMOVED de un único requirement). No afecta `api-contract`, `api-rest`, `db-local-postgres`, `db-schema-prisma`, `web-ui`, ni `ci-github-actions`.
- **CI**: la conflict del puerto 4000 desaparece. Ningún job de CI referencia `legacy/` (los jobs `quality` / `test` ya excluyen el directorio porque no está en `pnpm-workspace.yaml` ni en Turbo).
- **Sin efecto en runtime**: `apps/api`, `apps/web`, Prisma, Docker Compose, y el contract pipeline (`packages/api-types`) no cambian.
- **Externos**: el `sonar-project.properties` que se va era exclusivo del legacy. No hay integración Sonar viva con este repo (confirmado por el usuario), así que no hay limpieza fuera del repo.
- **Riesgo**: bajo. La paridad funcional ya quedó demostrada en el change 4 (`rebuild-api-fastify-ajv-errors`). El audit del `design.md` documenta el mapeo final como salvaguarda.
