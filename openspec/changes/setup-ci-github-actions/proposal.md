# Proposal — `setup-ci-github-actions`

## Why

Hoy el repo solo tiene gates locales: husky corre `lint-staged` en `pre-commit`, `commitlint` en `commit-msg` y `typecheck` en `pre-push`. Si un colaborador hace `--no-verify` o trabaja en otra máquina sin instalar los hooks, los errores se descubren al revisar el PR a ojo o, peor, ya en `main`. Tampoco hay verificación automática de los contratos que CH6 acaba de blindar (snapshot OpenAPI, schema Prisma vs migraciones aplicadas, openspec sync). Entrar a CH8 (`retire-legacy-express-stack`) sin un pipeline confiable significa que la siguiente change borra `legacy/` sin red de seguridad: cualquier regresión en `apps/api` o `apps/web` aparece directo en producción. Toca cerrar el ciclo de calidad ahora — antes del retire — para que `main` siempre refleje un build verde, los PRs traigan evidencia objetiva de que pasan, y el equipo deje de depender de la disciplina manual de cada quien.

## What Changes

- Añadir un workflow `.github/workflows/ci.yml` que se dispara en `push` a `main` y en `pull_request` contra `main`. Concurrency `group: ${{ github.ref }}` con `cancel-in-progress: true` para no acumular runs sobre la misma rama.
- Setup base de cada job: `actions/checkout@v4`, `actions/setup-node@v4` con `node-version-file: .nvmrc` (Node 20), `pnpm/action-setup@v4` leyendo `packageManager` de `package.json`, y `actions/cache@v4` para `~/.pnpm-store` y `node_modules/.cache/turbo`.
- Job `quality` (sin DB): corre `pnpm install --frozen-lockfile`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`. Falla rápido si el formato, lint, tipos o build están rotos.
- Job `test` (con DB): levanta `services.postgres` (`postgres:16-alpine`) con la misma config que `infra/docker-compose.yml`, exporta `DATABASE_URL`, corre `pnpm db:migrate:deploy` + `pnpm db:seed` y luego `pnpm test`. Cubre los integration tests de `@employeek/api` (incluye el snapshot test de OpenAPI) y los component tests de `@employeek/web`.
- Job `contract-drift`: corre `pnpm api:types` y luego `git diff --exit-code packages/api-types/`. Falla con un mensaje claro si el contrato OpenAPI o los tipos generados están desactualizados respecto al código de las rutas. Esto convierte la regla de no-drift de CH6 en un gate duro.
- Job `openspec-sync`: corre `openspec validate` (CLI ya disponible) sobre todos los changes activos en `openspec/changes/` y verifica que las specs canónicas (`openspec/specs/`) no queden huérfanas. Falla si hay drift entre proposal/specs/tasks o si una change archivada dejó deltas sin sincronizar.
- Job `commitlint` (solo `pull_request`): valida cada commit del PR contra `commitlint.config.cjs`. Re-aplica en CI lo mismo que el hook local, para que `--no-verify` no rompa la convención.
- Badge de status del workflow en `README.md` (sección de bootstrap, debajo del título), apuntando a `main`.
- Script root `pnpm ci:local` que reproduce el job `quality` localmente — útil para depurar fallas de CI sin pushear.

## Capabilities

### New Capabilities

- `ci-github-actions` — el pipeline CI ejecutado en GitHub Actions: jobs (`quality`, `test`, `contract-drift`, `openspec-sync`, `commitlint`), triggers (`push` a `main`, `pull_request`), servicios de soporte (Postgres), estrategias de cache (pnpm store, Turbo cache), y la regla de que `main` solo acepta merges con CI verde.

### Modified Capabilities

- `monorepo-foundation` — añadir requirement de que el repo provea `pnpm ci:local` y que `package.json#packageManager` quede pinned (lo lee la action `pnpm/action-setup`). Documenta el badge de CI y la dependencia opcional de Docker en local (en CI los services lo proveen).
- `api-contract` — endurecer el requirement de no-drift: deja de ser un test que corre solo en `pnpm test` para volverse también un job dedicado (`contract-drift`) que falla el PR si `pnpm api:types` produce diff.

## Impact

- **Nuevos archivos**: `.github/workflows/ci.yml`, `.github/dependabot.yml` (opcional, para bumps semanales de actions), badge en `README.md`, script root `ci:local` en `package.json`.
- **Sin cambios en código de aplicación**: ninguno de los apps (`api`, `web`) ni packages se modifica funcionalmente. El job de tests corre exactamente lo que ya existe localmente.
- **Tiempos esperados**: cold cache ~6-8 min (mayor parte por `pnpm install` y `pnpm build`); warm cache ~2-3 min. Se puede reducir si hace falta paralelizando `quality` y `test` (ya quedan en paralelo por defecto al ser jobs separados).
- **Costo**: GitHub Actions free tier (2000 min/mes en repos públicos, ilimitado; en privados 2000 min/mes para cuenta Free). Asumiendo 30 PRs/mes × 8 min × 5 jobs ≈ 1200 min/mes — dentro del free tier.
- **Bloqueo de merges**: una vez verde, la regla de branch protection de GitHub debe configurarse manualmente (fuera del scope de esta change; se documenta en `tasks.md` como paso post-merge). El workflow en sí no fuerza la branch protection — solo provee el status check.
- **No se cambia nada de `legacy/`** — sigue cuarentenado hasta CH8.
