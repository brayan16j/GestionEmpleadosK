# Tasks — `setup-ci-github-actions`

## 1. Preparación del repo

- [ ] 1.1 Verificar que `package.json#packageManager` está pinneado (formato `pnpm@<version>`); si falta, agregarlo con la versión actual de `pnpm --version`.
- [ ] 1.2 Agregar script root `pnpm format:check` (`prettier --check .`) en `package.json` si aún no existe.
- [ ] 1.3 Agregar script root `pnpm ci:local` que encadene `pnpm format:check && pnpm lint && pnpm typecheck && pnpm build` en ese orden.
- [ ] 1.4 Verificar que `.nvmrc` contiene `20.x` (Node 20 LTS) y coincide con `engines.node` en cada `package.json`.
- [ ] 1.5 Correr `pnpm ci:local` localmente para asegurar que pasa antes de tocar CI.

## 2. Workflow base (`.github/workflows/ci.yml`)

- [ ] 2.1 Crear `.github/workflows/ci.yml` con `name: CI`, triggers `push` (branches: `main`) y `pull_request` (branches: `main`).
- [ ] 2.2 Agregar bloque `concurrency` con `group: ci-${{ github.ref }}` y `cancel-in-progress: true`.
- [ ] 2.3 Definir defaults globales: `permissions: { contents: read }` (least-privilege) y `defaults.run.shell: bash`.

## 3. Setup compartido

- [ ] 3.1 Documentar (en comentario YAML) los steps comunes que se repiten en cada job: checkout, setup-node, pnpm action-setup, cache pnpm store, install. Decidir si extraer a composite action en `.github/actions/setup/` o mantener inline; criterio: si el bloque se repite >3 veces, extraer.
- [ ] 3.2 Pinear las acciones de terceros por SHA (no solo por tag): `actions/checkout`, `actions/setup-node`, `actions/cache`, `pnpm/action-setup`. Documentar en un comentario el tag equivalente al SHA.

## 4. Job `quality`

- [ ] 4.1 Definir job `quality` con `runs-on: ubuntu-latest` y `timeout-minutes: 10`.
- [ ] 4.2 Steps: checkout → setup Node desde `.nvmrc` → pnpm action-setup → cache `~/.pnpm-store` con key basada en hash de `pnpm-lock.yaml` → `pnpm install --frozen-lockfile` → cache `node_modules/.cache/turbo` → `pnpm format:check` → `pnpm lint` → `pnpm typecheck` → `pnpm build`.
- [ ] 4.3 Verificar que el job NO levanta servicios ni define `DATABASE_URL`.

## 5. Job `test`

- [ ] 5.1 Definir job `test` con `runs-on: ubuntu-latest`, `timeout-minutes: 15`, y bloque `services.postgres` con imagen `postgres:16-alpine`, env `POSTGRES_USER/PASSWORD/DB=employeek`, ports `5432:5432` y healthcheck `pg_isready -U employeek`.
- [ ] 5.2 Exportar `DATABASE_URL=postgresql://employeek:employeek@localhost:5432/employeek?schema=public` en `env` del job.
- [ ] 5.3 Steps: checkout → setup-node → pnpm action-setup → caches → `pnpm install --frozen-lockfile` → `pnpm db:migrate:deploy` → `pnpm db:seed` → `pnpm test`.
- [ ] 5.4 Verificar que el snapshot test de OpenAPI (`apps/api/test/openapi-snapshot.test.ts`) corre dentro de `pnpm test` y pasa.

## 6. Job `contract-drift`

- [ ] 6.1 Definir job `contract-drift` con `runs-on: ubuntu-latest`, `timeout-minutes: 10`. No requiere DB (el dump es resiliente a Postgres caído por requirement de `api-contract`).
- [ ] 6.2 Steps: checkout → setup-node → pnpm action-setup → cache pnpm store → `pnpm install --frozen-lockfile` → `pnpm api:types` → `git diff --exit-code packages/api-types/`.
- [ ] 6.3 Si el diff falla, el step de fallback SHALL imprimir: `OpenAPI types are out of sync. Run 'pnpm api:types' locally and commit the result.` Usar `if: failure()`.

## 7. Job `openspec-sync`

- [ ] 7.1 Definir job `openspec-sync` con `runs-on: ubuntu-latest`, `timeout-minutes: 5`.
- [ ] 7.2 Determinar cómo instalar el CLI `openspec` en el runner. Opciones: (a) `npm i -g openspec@<version>` con la misma versión que se usa localmente, (b) ejecutar vía `npx -y openspec@<version>`. Documentar la decisión en un comentario YAML.
- [ ] 7.3 Steps: checkout → setup-node → instalar `openspec` → `openspec validate` desde la raíz.
- [ ] 7.4 Verificar localmente con la change actual que `openspec validate` exit 0 antes de mergear.

## 8. Job `commitlint`

- [ ] 8.1 Definir job `commitlint` con `if: github.event_name == 'pull_request'` y `runs-on: ubuntu-latest`, `timeout-minutes: 3`.
- [ ] 8.2 Steps: checkout con `fetch-depth: 0` (necesario para ver todos los commits del PR) → setup-node → pnpm action-setup → install → `npx commitlint --from origin/${{ github.base_ref }} --to HEAD --config commitlint.config.cjs`.
- [ ] 8.3 Verificar que el step funciona con un commit malo de prueba (forzando un fallo en una rama scratch) y luego revertir.

## 9. Cache strategy

- [ ] 9.1 En cada job, agregar `actions/cache@v4` para `~/.pnpm-store` con `key: pnpm-store-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}` y `restore-keys: pnpm-store-${{ runner.os }}-`.
- [ ] 9.2 En jobs que corren tasks Turbo (`quality`, `test`), agregar segundo cache para `node_modules/.cache/turbo` con `key: turbo-${{ runner.os }}-${{ github.sha }}` y `restore-keys: turbo-${{ runner.os }}-`.
- [ ] 9.3 Medir el wall-clock de un cold run vs warm run; documentar el tiempo en un comentario al tope de `ci.yml` para referencia futura.

## 10. README badge

- [ ] 10.1 Agregar el badge de CI a `README.md` dentro de las primeras 20 líneas, formato `[![CI](...)](...)` apuntando a `main`.
- [ ] 10.2 Verificar que el link del badge abre la página de runs filtrada por `ci.yml` al hacer click.

## 11. Dependabot (decisión)

- [ ] 11.1 Decidir si esta change incluye `.github/dependabot.yml` (bumps semanales para `github-actions` y `npm`) o si se difiere a una change futura. Si se incluye, crear el archivo con los dos ecosystems configurados con `interval: weekly`.
- [ ] 11.2 Si se difiere, dejar nota en `proposal.md` (sección Open Questions) y abrir issue de seguimiento.

## 12. Validación end-to-end

- [ ] 12.1 Pushear la rama `ch7/setup-ci-github-actions` y abrir un PR contra `main`.
- [ ] 12.2 Esperar que los 5 jobs (`quality`, `test`, `contract-drift`, `openspec-sync`, `commitlint`) corran y pasen en verde.
- [ ] 12.3 Probar fallos intencionales en una rama scratch para validar que cada gate falla cuando debe: (a) lint error, (b) test rojo, (c) snapshot drift, (d) commit message inválido. Revertir luego.
- [ ] 12.4 Documentar en el PR description los tiempos observados (cold y warm cache) para referencia futura.

## 13. Documentación

- [ ] 13.1 Actualizar `CLAUDE.md`: agregar sección "CI" describiendo los 5 jobs, qué valida cada uno, y `pnpm ci:local` como reproducción local del job `quality`.
- [ ] 13.2 Actualizar `CLAUDE.md`: agregar el badge de CI cerca del título.
- [ ] 13.3 Mencionar en `CLAUDE.md` que branch protection rules de `main` deben configurarse manualmente en GitHub Settings → Branches con los 4 status checks requeridos (`quality`, `test`, `contract-drift`, `openspec-sync`). El job `commitlint` no se incluye porque solo aplica en PRs.

## 14. Post-merge (manual, fuera del scope automatizable)

- [ ] 14.1 Después del merge, configurar en GitHub branch protection rules para `main`: require status checks `quality`, `test`, `contract-drift`, `openspec-sync` antes de mergear; require PRs (no direct push); require conversations resolved. Documentar en un comentario del PR que esto fue hecho.

## 15. Cierre

- [ ] 15.1 Marcar todas las tasks anteriores como completadas (`[x]`).
- [ ] 15.2 Correr `/opsx:archive setup-ci-github-actions` para mover specs/proposal/design a `openspec/changes/archive/` y propagar deltas a `openspec/specs/`.
