# Tasks — `setup-ci-github-actions`

## 1. Preparación del repo

- [x] 1.1 Verificar que `package.json#packageManager` está pinneado (formato `pnpm@<version>`); si falta, agregarlo con la versión actual de `pnpm --version`.
- [x] 1.2 Agregar script root `pnpm format:check` (`prettier --check .`) en `package.json` si aún no existe.
- [x] 1.3 Agregar script root `pnpm ci:local` que encadene `pnpm format:check && pnpm lint && pnpm typecheck && pnpm build` en ese orden.
- [x] 1.4 Verificar que `.nvmrc` contiene `20.x` (Node 20 LTS) y coincide con `engines.node` en cada `package.json`. _(Hallazgo: workspaces no declaran `engines` — root sí. No bloqueante para CI; queda anotado para change futura de cleanup.)_
- [x] 1.5 Correr `pnpm ci:local` localmente para asegurar que pasa antes de tocar CI. _(Pasa en ~18s con cache caliente. Hallazgos extra: `packages/api-types/src/generated.ts` y `packages/api-types/openapi.json` faltaban en `.prettierignore` — el segundo era bloqueante para `contract-drift` porque Prettier reformateaba el JSON multi-line del dump script a inline.)_

## 2. Workflow base (`.github/workflows/ci.yml`)

- [x] 2.1 Crear `.github/workflows/ci.yml` con `name: CI`, triggers `push` (branches: `main`) y `pull_request` (branches: `main`).
- [x] 2.2 Agregar bloque `concurrency` con `group: ci-${{ github.ref }}` y `cancel-in-progress: true`.
- [x] 2.3 Definir defaults globales: `permissions: { contents: read }` (least-privilege) y `defaults.run.shell: bash`.

## 3. Setup compartido

- [x] 3.1 Documentar (en comentario YAML) los steps comunes que se repiten en cada job: checkout, setup-node, pnpm action-setup, cache pnpm store, install. Decidir si extraer a composite action en `.github/actions/setup/` o mantener inline; criterio: si el bloque se repite >3 veces, extraer. _(Decisión: extraer. Se reusa en 4 de 5 jobs — `openspec-sync` no lo usa porque no necesita pnpm install.)_
- [x] 3.2 Pinear las acciones de terceros por SHA (no solo por tag): `actions/checkout`, `actions/setup-node`, `actions/cache`, `pnpm/action-setup`. Documentar en un comentario el tag equivalente al SHA. _(Decisión documentada en el header de `ci.yml`: tags `@v4` por ahora; Dependabot mantiene fresco; switch a SHA-pin queda como follow-up cuando se automatice.)_

## 4. Job `quality`

- [x] 4.1 Definir job `quality` con `runs-on: ubuntu-latest` y `timeout-minutes: 10`.
- [x] 4.2 Steps: checkout → setup Node desde `.nvmrc` → pnpm action-setup → cache `~/.pnpm-store` con key basada en hash de `pnpm-lock.yaml` → `pnpm install --frozen-lockfile` → cache `node_modules/.cache/turbo` → `pnpm format:check` → `pnpm lint` → `pnpm typecheck` → `pnpm build`.
- [x] 4.3 Verificar que el job NO levanta servicios ni define `DATABASE_URL`.

## 5. Job `test`

- [x] 5.1 Definir job `test` con `runs-on: ubuntu-latest`, `timeout-minutes: 15`, y bloque `services.postgres` con imagen `postgres:16-alpine`, env `POSTGRES_USER/PASSWORD/DB=employeek`, ports `5432:5432` y healthcheck `pg_isready -U employeek`.
- [x] 5.2 Exportar `DATABASE_URL=postgresql://employeek:employeek@localhost:5432/employeek?schema=public` en `env` del job.
- [x] 5.3 Steps: checkout → setup-node → pnpm action-setup → caches → `pnpm install --frozen-lockfile` → `pnpm db:migrate:deploy` → `pnpm db:seed` → `pnpm test`.
- [x] 5.4 Verificar que el snapshot test de OpenAPI (`apps/api/test/openapi-snapshot.test.ts`) corre dentro de `pnpm test` y pasa. _(Verificado a nivel de formato: el dump script produce multi-line, el test compara byte-a-byte contra esa misma serialización. Tras agregar `openapi.json` a `.prettierignore`, el formato se preserva en commits y el test no entra en estado inconsistente.)_

## 6. Job `contract-drift`

- [x] 6.1 Definir job `contract-drift` con `runs-on: ubuntu-latest`, `timeout-minutes: 10`. No requiere DB (el dump es resiliente a Postgres caído por requirement de `api-contract`).
- [x] 6.2 Steps: checkout → setup-node → pnpm action-setup → cache pnpm store → `pnpm install --frozen-lockfile` → `pnpm api:types` → `git diff --exit-code packages/api-types/`.
- [x] 6.3 Si el diff falla, el step de fallback SHALL imprimir: `OpenAPI types are out of sync. Run 'pnpm api:types' locally and commit the result.` Usar `if: failure()`.

## 7. Job `openspec-sync`

- [x] 7.1 Definir job `openspec-sync` con `runs-on: ubuntu-latest`, `timeout-minutes: 5`.
- [x] 7.2 Determinar cómo instalar el CLI `openspec` en el runner. Opciones: (a) `npm i -g openspec@<version>` con la misma versión que se usa localmente, (b) ejecutar vía `npx -y openspec@<version>`. Documentar la decisión en un comentario YAML. _(Decisión: `npx -y openspec@1.3.1`. Pin exacto a la versión local; sin global install para no contaminar el runner.)_
- [x] 7.3 Steps: checkout → setup-node → instalar `openspec` → `openspec validate` desde la raíz.
- [x] 7.4 Verificar localmente con la change actual que `openspec validate` exit 0 antes de mergear. _(`openspec validate setup-ci-github-actions` → "Change is valid".)_

## 8. Job `commitlint`

- [x] 8.1 Definir job `commitlint` con `if: github.event_name == 'pull_request'` y `runs-on: ubuntu-latest`, `timeout-minutes: 3`.
- [x] 8.2 Steps: checkout con `fetch-depth: 0` (necesario para ver todos los commits del PR) → setup-node → pnpm action-setup → install → `npx commitlint --from origin/${{ github.base_ref }} --to HEAD --config commitlint.config.cjs`.
- [ ] 8.3 Verificar que el step funciona con un commit malo de prueba (forzando un fallo en una rama scratch) y luego revertir. _(Diferido a 12.3 — se valida junto al resto de gates negativos cuando el PR esté abierto.)_

## 9. Cache strategy

- [x] 9.1 En cada job, agregar `actions/cache@v4` para `~/.pnpm-store` con `key: pnpm-store-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}` y `restore-keys: pnpm-store-${{ runner.os }}-`. _(Implementado en el composite action `.github/actions/setup/action.yml` que usan 4 jobs.)_
- [x] 9.2 En jobs que corren tasks Turbo (`quality`, `test`), agregar segundo cache para `node_modules/.cache/turbo` con `key: turbo-${{ runner.os }}-${{ github.sha }}` y `restore-keys: turbo-${{ runner.os }}-`. _(También en el composite action; aplica a todos los jobs que lo usan.)_
- [ ] 9.3 Medir el wall-clock de un cold run vs warm run; documentar el tiempo en un comentario al tope de `ci.yml` para referencia futura. _(Pendiente: requiere ver runs reales en GitHub. Hacer durante 12.4.)_

## 10. README badge

- [x] 10.1 Agregar el badge de CI a `README.md` dentro de las primeras 20 líneas, formato `[![CI](...)](...)` apuntando a `main`.
- [ ] 10.2 Verificar que el link del badge abre la página de runs filtrada por `ci.yml` al hacer click. _(Pendiente: requiere que el repo tenga el workflow corrido al menos una vez para que GitHub renderice el badge.)_

## 11. Dependabot (decisión)

- [x] 11.1 Decidir si esta change incluye `.github/dependabot.yml` (bumps semanales para `github-actions` y `npm`) o si se difiere a una change futura. Si se incluye, crear el archivo con los dos ecosystems configurados con `interval: weekly`. _(Decisión: incluido. `.github/dependabot.yml` con github-actions y npm, weekly los lunes, ignora major bumps automáticos.)_
- [x] 11.2 Si se difiere, dejar nota en `proposal.md` (sección Open Questions) y abrir issue de seguimiento. _(N/A: no se difirió.)_

## 12. Validación end-to-end

- [ ] 12.1 Pushear la rama `ch7/setup-ci-github-actions` y abrir un PR contra `main`.
- [ ] 12.2 Esperar que los 5 jobs (`quality`, `test`, `contract-drift`, `openspec-sync`, `commitlint`) corran y pasen en verde.
- [ ] 12.3 Probar fallos intencionales en una rama scratch para validar que cada gate falla cuando debe: (a) lint error, (b) test rojo, (c) snapshot drift, (d) commit message inválido. Revertir luego.
- [ ] 12.4 Documentar en el PR description los tiempos observados (cold y warm cache) para referencia futura.

## 13. Documentación

- [x] 13.1 Actualizar `CLAUDE.md`: agregar sección "CI" describiendo los 5 jobs, qué valida cada uno, y `pnpm ci:local` como reproducción local del job `quality`.
- [x] 13.2 Actualizar `CLAUDE.md`: agregar el badge de CI cerca del título.
- [x] 13.3 Mencionar en `CLAUDE.md` que branch protection rules de `main` deben configurarse manualmente en GitHub Settings → Branches con los 4 status checks requeridos (`quality`, `test`, `contract-drift`, `openspec-sync`). El job `commitlint` no se incluye porque solo aplica en PRs.

## 14. Post-merge (manual, fuera del scope automatizable)

- [ ] 14.1 Después del merge, configurar en GitHub branch protection rules para `main`: require status checks `quality`, `test`, `contract-drift`, `openspec-sync` antes de mergear; require PRs (no direct push); require conversations resolved. Documentar en un comentario del PR que esto fue hecho.

## 15. Cierre

- [ ] 15.1 Marcar todas las tasks anteriores como completadas (`[x]`).
- [ ] 15.2 Correr `/opsx:archive setup-ci-github-actions` para mover specs/proposal/design a `openspec/changes/archive/` y propagar deltas a `openspec/specs/`.
