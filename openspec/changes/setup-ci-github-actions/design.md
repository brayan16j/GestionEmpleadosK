# Design — `setup-ci-github-actions`

## Context

El repo está en `main` con seis changes archivadas. Los gates de calidad existen solo en husky local (`pre-commit`, `commit-msg`, `pre-push`) y dependen de que cada colaborador los tenga instalados y no use `--no-verify`. CH6 acaba de introducir dos invariantes que solo se verifican corriendo `pnpm test` con la DB arriba: (a) `apps/api/test/openapi-snapshot.test.ts` falla si `packages/api-types/openapi.json` no refleja `app.swagger()`, y (b) los integration tests de `apps/api` requieren un Postgres real (no mocks). Sin CI, ambos se pueden saltar fácilmente.

CH8 (`retire-legacy-express-stack`) borra `legacy/` y elimina las dependencias del Express viejo. Hacer eso sin un pipeline verde como red de seguridad significa que si CH8 rompe algo en el rebuild, no hay forma automática de detectarlo antes del merge. Por eso CH7 va antes que CH8: CI primero, retire después.

El stack ya está estandarizado: pnpm `packageManager` pinneado en `package.json`, Node 20 en `.nvmrc`, Turborepo con `turbo.json`, Vitest configurado por workspace, Prisma con migraciones versionadas en `apps/api/prisma/migrations`, OpenAPI dump idempotente vía `pnpm api:openapi`. Casi todo lo necesario para CI ya existe localmente — el trabajo es traducirlo a un workflow.

## Goals / Non-Goals

**Goals:**

- Workflow CI que falle el merge si lint, typecheck, build, tests, format, drift de contrato OpenAPI o sync de OpenSpec están rotos.
- Tiempo total ≤ 8 min en cold cache, ≤ 3 min en warm cache.
- Reproducibilidad local: `pnpm ci:local` debe correr exactamente lo mismo que el job `quality` (sin DB) para depurar fallas sin pushear.
- Cero divergencia entre cómo se levanta la DB en local (`infra/docker-compose.yml`) y cómo se levanta en CI (service container) — misma imagen, mismas credenciales por env.
- Mensajes de fallo accionables: si falla `contract-drift`, el log debe decir `Run 'pnpm api:types' to regenerate.` (mismo wording que el snapshot test).

**Non-Goals:**

- Configurar branch protection rules en GitHub (es UI/admin, fuera de scope; se documenta en `tasks.md` como paso post-merge manual).
- Deploy automático a producción. Esta change solo cubre verificación; el deploy queda para una change futura si se decide.
- Matrix builds (Node 18/20/22). Node 20 está pinneado por `.nvmrc` y `engines`; correr otras versiones contradice ADR-0 #6.
- Tests E2E o de UI con browsers reales. Vitest + jsdom es suficiente al nivel actual del web; agregar Playwright sería su propia change.
- Notificaciones a Slack/Discord/email. Se asume que GitHub UI + emails de fallo son suficientes para un equipo pequeño.

## Decisions

### 1. GitHub Actions sobre alternativas (CircleCI, GitLab CI)

**Elegido:** GitHub Actions.

**Por qué:** el repo ya vive en GitHub (origen `git@github.com:.../GestionEmpleadosK`). Actions tiene integración nativa con `pull_request` events, status checks y branch protection sin webhooks externos. El free tier (2000 min/mes en privados, ilimitado público) cubre con holgura el volumen esperado (~1200 min/mes calculado en el proposal). Acciones oficiales (`actions/checkout`, `actions/setup-node`, `pnpm/action-setup`) están bien mantenidas y son la opción canónica del ecosistema.

**Alternativas consideradas:**
- **CircleCI**: requiere webhook + cuenta separada, mejor performance pero overhead operativo no justificado.
- **GitLab CI**: el repo no está en GitLab; migrar el remote por CI es over-engineering.

### 2. Service container para Postgres en lugar de docker-compose

**Elegido:** `services.postgres` nativo de Actions con `postgres:16-alpine`.

**Por qué:** Actions levanta el contenedor en paralelo al checkout y expone el puerto 5432 al runner. Eliminamos la dependencia de instalar Docker Compose en el runner y de gestionar `docker compose up` / health checks manualmente. El healthcheck de la action (`--health-cmd pg_isready`) hace que el job espere automáticamente. Misma imagen que `infra/docker-compose.yml` → cero deriva entre dev y CI.

**Alternativas consideradas:**
- **Levantar `infra/docker-compose.yml` desde el job**: funciona pero añade ~30s y un punto de falla extra (compose plugin instalado, networking). Sin valor agregado.
- **GitHub-hosted Postgres en runners ubuntu**: existe pero es Postgres 14, no 16. Diverge de prod-like.

### 3. Jobs separados (`quality`, `test`, `contract-drift`, `openspec-sync`, `commitlint`) vs job monolítico

**Elegido:** cinco jobs paralelos, cada uno con su propio install + cache.

**Por qué:** paralelización real (los runners corren en máquinas distintas) reduce wall-clock de ~12 min a ~6-8 min. Un fallo en `lint` no bloquea el feedback de `test`; el dev ve ambos errores juntos. Logs separados son más legibles. El costo es duplicar `pnpm install` por job (~30s c/u con cache caliente), pero el cache de pnpm store es compartido por `actions/cache`, así que el segundo install reusa el mismo `node_modules` resoluto desde el lockfile.

**Trade-off aceptado:** más minutos consumidos vs feedback más rápido y completo. Para el volumen actual, la cuenta sigue dentro del free tier.

**Alternativas consideradas:**
- **Un solo job con todos los pasos**: más simple, pero serializa lo que puede correr en paralelo. Wall-clock peor.
- **Reusable workflow + `needs`**: complejidad innecesaria a este tamaño; se puede refactorizar si crece.

### 4. `pnpm/action-setup` leyendo `packageManager` vs corepack

**Elegido:** `pnpm/action-setup@v4` con `version` derivado de `package.json#packageManager`.

**Por qué:** el campo `packageManager` ya está pinneado (es lo que usa Corepack también). `pnpm/action-setup` lo respeta, instala la versión exacta y configura el global store. Corepack en runners de GitHub funciona pero requiere un paso extra (`corepack enable`) y a veces necesita `--force` por bugs conocidos en versiones intermedias.

### 5. Cache strategy

**Elegido:** dos caches independientes vía `actions/cache@v4`:
- `~/.pnpm-store` con key `pnpm-store-${{ hashFiles('pnpm-lock.yaml') }}` — se invalida solo cuando cambia el lockfile.
- `node_modules/.cache/turbo` con key `turbo-${{ github.sha }}` y `restore-keys: turbo-` — Turbo gestiona su propio hashing por inputs, así que basta con persistir el directorio.

**Por qué dos caches:** el pnpm store cachea binarios descargados (lo caro de `install`); Turbo cachea outputs de tasks (`build`, `test` resultados). Son ortogonales. Combinarlos en una sola key sería miss más frecuente.

### 6. `contract-drift` como job separado, no como test dentro de `test`

**Elegido:** job dedicado `contract-drift` que corre `pnpm api:types` y luego `git diff --exit-code packages/api-types/`.

**Por qué:** el snapshot test de `apps/api/test/openapi-snapshot.test.ts` ya valida que `app.swagger()` coincida con el JSON commiteado, pero **no** valida que los tipos generados (`packages/api-types/dist/`) estén actualizados. El job dedicado regenera ambos y falla si hay cualquier diff. Además da un mensaje de error más claro que un assert dentro de Vitest.

### 7. `openspec-sync` job

**Elegido:** correr `openspec validate` (sin args, valida todos los changes activos) en cada PR.

**Por qué:** evita que se mergee un PR donde `proposal.md` referencia capabilities que no tienen specs, donde `tasks.md` apunta a un design.md inexistente, o donde una change archivada dejó deltas sin propagar a `openspec/specs/`. Es un gate barato (~2s) que bloquea drift silencioso de los artefactos.

### 8. `commitlint` job solo en `pull_request`, no en `push`

**Elegido:** correr `npx commitlint --from origin/main --to HEAD` en eventos `pull_request`.

**Por qué:** el hook local ya valida cada commit individual. El job de CI valida todo el rango del PR — si alguien hizo `--no-verify` localmente, este job lo detecta antes del merge. En `push` directo a main no aplica (los commits ya están escritos; no se pueden re-validar útilmente).

## Risks / Trade-offs

- **[Riesgo] El cache de Turbo puede crecer indefinidamente y consumir el límite de 10 GB de Actions cache.** → Mitigación: `restore-keys` permite cache miss benigno; un cron mensual puede limpiar el cache via `actions/cache/restore` con prefix matching. Si llega a ser problema real, lo abrimos como change.
- **[Riesgo] Postgres 16-alpine es una imagen Docker Hub; rate limits anónimos pueden hacer flaky el job.** → Mitigación: GitHub-hosted runners salen con IP propia que tiene quota de Docker Hub mucho mayor. Si aparecen 429s, usar GHCR mirror o autenticar.
- **[Riesgo] `contract-drift` falla en PRs donde el dev olvidó correr `pnpm api:types`.** → Mitigación deseada, no bug. El mensaje de error apunta exactamente al comando que arregla el problema.
- **[Trade-off] Los cinco jobs reinstalan dependencias por separado; consume más minutos que un job único.** → Aceptado a cambio de paralelismo y feedback granular. Si el costo se vuelve relevante, se puede consolidar.
- **[Trade-off] No corremos matrix de Node.** → Aceptado: ADR-0 fija Node 20. Otra versión es trabajo de migración, no de CI.
- **[Riesgo] Acciones de terceros (`pnpm/action-setup`) pueden ser comprometidas vía supply chain.** → Mitigación: pinear por SHA en lugar de tag (`@v4` → `@a3252b78c4...`). Dependabot puede actualizar los SHAs con PRs revisables. Esto se incluye en `tasks.md`.

## Migration Plan

No hay migración: esta change agrega archivos nuevos sin tocar código existente.

**Rollout:**

1. Crear branch (ya estamos en `ch7/setup-ci-github-actions`).
2. Implementar workflow + script + badge.
3. Push de la rama; primer run del workflow corre sobre el PR mismo.
4. Iterar hasta verde (probable: ajustar variables de entorno, paths de cache, timeouts).
5. Merge a `main`; el primer run en `main` deja el badge verde.
6. **Post-merge (manual, fuera de scope):** configurar branch protection en GitHub Settings → Branches → `main` con required status checks: `quality`, `test`, `contract-drift`, `openspec-sync`. Documentado en `tasks.md`.

**Rollback:** revert del PR. No hay estado persistente.

## Open Questions

- ¿Activar `dependabot.yml` en esta misma change para bumps semanales de actions y npm deps, o dejarlo para una change separada? — Propuesta: incluirlo aquí (es ~10 líneas de YAML y cierra el ciclo de seguridad de supply chain). Si el reviewer prefiere separarlo, se mueve a su propia change.
- ¿`openspec validate` requiere una versión específica del CLI en CI? — Verificar en `tasks.md` que el step instale `openspec` en la versión que usamos localmente.
