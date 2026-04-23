## Context

Estado actual:
- Backend: Node + Express 4.18 (JS ESM), Sequelize + Postgres, sin tests, sin TS, credenciales hardcoded, en `D:\Proyectos Konecta\GestionEmpleadosK`.
- Frontend: React 18 + CRA (`react-scripts` 5), Tailwind, sin TS, sin tests significativos, en directorio separado `D:\Proyectos Konecta\FRONTK1`.
- No hay herramientas compartidas, ni esquema de versionado de commits, ni reglas de lint/format, ni Node pin.
- Objetivo de negocio: profesionalizar el stack completo para evolucionarlo sin arrastrar deuda técnica.

Restricciones:
- Windows como entorno principal de desarrollo (line endings, paths).
- El equipo está aprendiendo OpenSpec y Claude Code a la par que ejecuta la refundación. Los changes deben ser pequeños y pedagógicos.
- Node 20 LTS es el objetivo (compatible con Prisma 5, Fastify 4/5, Vite 5, TypeScript 5).

## Goals / Non-Goals

**Goals:**
- Estructura de monorepo que escale a 2 apps + N paquetes compartidos.
- Un solo comando clona-y-levanta: `pnpm install && pnpm dev`.
- Baseline de TypeScript estricto compartido, con project references.
- Calidad automatizada: lint + format + commit rules aplicadas en pre-commit/pre-push.
- Turborepo cacheando `build`, `lint`, `typecheck`, `test` para ciclos locales rápidos.
- `CLAUDE.md` que codifique convenciones para cargar automáticamente a cada sesión.

**Non-Goals:**
- Migrar el código Express a Fastify (change `rebuild-api-fastify-ajv-errors`).
- Introducir Prisma o tocar el esquema de base de datos (change `migrate-sequelize-to-prisma`).
- Dockerizar la base de datos (change `dockerize-local-postgres`).
- Migrar CRA a Vite (change `rebuild-web-vite-tanstack-query`).
- Generar tipos OpenAPI o configurar TanStack Query (change `openapi-contract-and-typed-client`).
- Configurar GitHub Actions (change `setup-ci-github-actions`).
- Retirar el código legado (change `retire-legacy-express-stack`).

## Decisions

### D1 — Package manager: pnpm (no npm, no yarn)
**Elegido:** pnpm v9.
**Alternativas:** npm workspaces (menos eficiente en disco, peor en monorepos), Yarn Berry (potente pero curva alta y fricción con Windows/pnp).
**Razón:** instalaciones más rápidas con store único, symlinks estrictos que evitan phantom deps, excelente soporte de workspaces y la mejor integración con Turborepo.

### D2 — Orquestador: Turborepo (no Nx, no Lerna)
**Elegido:** Turborepo 2.
**Alternativas:** Nx (más features — generadores, plugins — pero más opinión y complejidad), Lerna (legacy, sin ventajas hoy), Rush (sobredimensionado para 2 apps).
**Razón:** configuración mínima (`turbo.json`), caché local y remoto, pipelines declarativos. Para 2 apps y 1-N paquetes compartidos es el sweet spot.

### D3 — Estructura: `apps/` + `packages/` + `legacy/` + `infra/`
**Elegido:**
```
apps/api        — backend (skeleton TS en este change, Fastify en CH4)
apps/web        — frontend (skeleton TS+Vite en este change, features en CH5)
packages/*      — código compartido (api-types, eslint-config, tsconfig)
legacy/         — código Express actual, en cuarentena hasta CH8
infra/          — docker-compose, scripts (empieza vacío, se llena en CH2)
```
**Alternativas:** `services/` + `libs/` (estilo Nx) — rechazado por consistencia con la convención pnpm/Turbo oficial. Todo plano — rechazado, no escala.
**Razón:** convención mainstream, legible por cualquier ingeniero que entre al repo.

### D4 — TypeScript baseline con `tsconfig.base.json` + project references
**Elegido:** un `tsconfig.base.json` con `strict: true`, `target: ES2022`, `module: NodeNext`. Cada paquete extiende de él y expone su propio `tsconfig.json` con `references`.
**Alternativas:** un solo `tsconfig.json` monolítico (rompe en monorepo), cada paquete con config aislado (dispersión).
**Razón:** `tsc --build` ordena por dependencias, `turbo run typecheck` cachea por paquete, IDE funciona correctamente.

### D5 — ESLint flat config + Prettier separados
**Elegido:** `eslint.config.js` (flat, ESLint 9) en la raíz. Prettier como formateador puro; ESLint delega formato a Prettier vía `eslint-config-prettier`. Config compartida en `packages/eslint-config`.
**Alternativas:** `.eslintrc.*` legacy (deprecado en ESLint 9), Biome (prometedor pero ecosistema de plugins aún en crecimiento).
**Razón:** flat config es el futuro oficial; separar lint y format evita conflictos; paquete compartido evita duplicación entre `apps/api` y `apps/web`.

### D6 — Git hooks: husky + lint-staged + commitlint
**Elegido:**
- pre-commit: `lint-staged` corre ESLint + Prettier sobre staged files.
- commit-msg: `commitlint` enforcement Conventional Commits.
- pre-push: `pnpm typecheck` en paquetes afectados.

**Alternativas:** lefthook (más rápido, menos popular), simple-git-hooks (minimalista, menos features).
**Razón:** husky es el estándar de facto; lint-staged es eficaz; commitlint habilita changelogs automáticos futuros.

### D7 — Node pinning: `.nvmrc` + `engines`
**Elegido:** `.nvmrc` con `20.18.0` (última LTS al momento de escribir) y `engines.node >=20.18 <21` en cada `package.json`.
**Alternativas:** Volta (excelente DX pero introduce dependencia extra), fnm (similar a nvm).
**Razón:** `.nvmrc` es universal, funciona con nvm, fnm, Volta y el enforcement por `engines` atrapa instalaciones incorrectas.

### D8 — Line endings y editor rules
**Elegido:** `.gitattributes` con `* text=auto eol=lf` + `.editorconfig` estricto (2 espacios, LF, UTF-8, trim trailing whitespace).
**Razón:** evitar guerras de CRLF/LF en Windows, especialmente con husky scripts y archivos generados.

### D9 — `CLAUDE.md` como fuente de convenciones
**Elegido:** archivo raíz `CLAUDE.md` (lo lee Claude Code automáticamente cada sesión) con:
- stack del repo
- comandos comunes (`pnpm dev`, `pnpm test`, etc.)
- convenciones de commits
- enlace a `openspec/` y el flujo `propose → apply → archive`
- reglas de "no tocar `legacy/`" hasta CH8.

**Razón:** persistir las convenciones en un archivo que la herramienta consume directamente reduce fricción en cada sesión y mantiene coherencia entre miembros del equipo.

## Risks / Trade-offs

| Riesgo                                                                 | Mitigación                                                                                      |
|------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
| CRLF/LF romper husky scripts en Windows                                | `.gitattributes` con `* text=auto eol=lf` y `.editorconfig`; hooks en `.husky/` con `#!/usr/bin/env sh`. |
| Conflicto entre `legacy/` y nueva estructura                            | `legacy/` se mueve como bloque completo; Turbo no lo incluye en sus pipelines; queda fuera de ESLint. |
| Curva de aprendizaje simultánea (pnpm+Turbo+TS+flat config)           | Este change NO toca lógica de negocio; es puro tooling. Cada herramienta se ejercita con `pnpm dev` trivial. |
| Ritmo lento si se sobreingenierizan paquetes compartidos              | `packages/*` en este change tienen **solo** lo mínimo (eslint-config, tsconfig). `api-types` se llena en CH6. |
| Husky falla en CI o en clones fresh                                    | Usar `"prepare": "husky"` en root; `HUSKY=0` respetado en CI; documentado en `CLAUDE.md`.      |
| Versiones incompatibles de TypeScript entre paquetes                  | Única versión de TS pinneada en `devDependencies` del root; paquetes la heredan.                |
| El IDE no entiende project references inicialmente                    | Incluir `"include"` explícito en cada `tsconfig.json` y ejemplo de VSCode `settings.json` en `CLAUDE.md`. |
| pnpm bloquea fantom deps que Express/Sequelize usan informalmente    | Irrelevante aquí: `legacy/` no pasa por pnpm install (sigue con su propio `package-lock.json`) hasta su retiro. |

## Migration Plan

1. **Pre-flight**: commit limpio del estado actual; crear rama `feat/scaffold-monorepo` (recomendado).
2. **Quarantine**: mover `src/`, `models/`, `config/`, `package.json`, `package-lock.json`, `node_modules/`, `sonar-project.properties` a `legacy/`. Verificar que `legacy/` siga arrancando con `cd legacy && npm run dev`.
3. **Workspace init**: crear `package.json` raíz nuevo, `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc`.
4. **TS baseline**: `tsconfig.base.json` + `packages/tsconfig/` con presets (base, node, react).
5. **App skeletons**: `apps/api/` y `apps/web/` con `package.json` + `tsconfig.json` + `src/index.ts` (entry point trivial).
6. **Quality tooling**: ESLint flat config + Prettier + `.editorconfig` + `.gitattributes`.
7. **Git hooks**: husky install, lint-staged, commitlint.
8. **Dev docs**: `CLAUDE.md` + `README.md` raíz actualizado.
9. **Validación**: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm build` en paralelo. Todos deben pasar.
10. **Archivo**: `/opsx:archive` mueve la spec `monorepo-foundation` a `openspec/specs/monorepo-foundation/`.

**Rollback**: `git checkout main -- .` + `git clean -fd` devuelve al estado pre-change. `legacy/` permite volver a ejecutar el backend original sin código nuevo.

## Open Questions

- ¿`pnpm` v9 o v10? (v10 es candidata nueva; v9 es la LTS efectiva). **Sugerido:** v9 hasta que v10 tenga 6 meses en producción.
- ¿Volta además de `.nvmrc` para pinnear también `pnpm`? **Sugerido:** no en este change; añadir si surge drift entre máquinas.
- ¿Incluir Renovate / Dependabot config ya? **Sugerido:** en `setup-ci-github-actions` (CH7), no aquí.
- ¿Añadir `.vscode/` con extensiones recomendadas? **Sugerido:** sí (archivo `extensions.json` ligero), documentado en `CLAUDE.md`.
