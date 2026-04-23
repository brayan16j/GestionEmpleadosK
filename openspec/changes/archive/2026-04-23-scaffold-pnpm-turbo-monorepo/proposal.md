## Why

El proyecto vive hoy como un repositorio Node + Express de un solo paquete, mientras que el frontend React (CRA) existe en un directorio separado sin vínculo con el backend. No hay TypeScript, no hay herramientas compartidas, no hay automatización de calidad, ni una forma única y reproducible de levantar el entorno. Antes de reescribir API, frontend, ORM o contenerización, necesitamos un cimiento de monorepo profesional que sostenga todo lo que viene.

Este change establece **únicamente** esos cimientos: estructura de monorepo, baseline de TypeScript, tooling de calidad y convenciones del repositorio. Ningún código de aplicación se migra aquí — eso es trabajo de changes posteriores.

## What Changes

- Convertir el repositorio en un monorepo gestionado con **pnpm workspaces** y orquestado con **Turborepo**.
- Crear la estructura `apps/` y `packages/` con esqueletos TypeScript mínimos pero funcionales (sin lógica de negocio).
- Mover el código legado (`src/`, `models/`, `config/`) a `legacy/` para dejar clara la zona de cuarentena hasta su reemplazo.
- Establecer un **baseline de TypeScript estricto** con project references y `tsconfig.base.json` compartido.
- Introducir **ESLint (flat config) + Prettier** como tooling de calidad unificado.
- Configurar **husky + lint-staged + commitlint** para forzar calidad en pre-commit y Conventional Commits en pre-push.
- Fijar **Node 20 LTS** vía `.nvmrc` y `engines` en `package.json`.
- Añadir **`CLAUDE.md`** en la raíz con convenciones del repo, comandos comunes y guía para futuras sesiones con Claude Code.
- Actualizar `.gitignore`, añadir `.gitattributes` (line endings) y `.editorconfig`.
- **BREAKING**: el `package.json` actual del root se reemplaza; `npm run dev` deja de existir en esa forma y pasa a `pnpm dev` (orquestado por Turbo).

## Capabilities

### New Capabilities
- `monorepo-foundation`: infraestructura del monorepo — estructura, gestor de paquetes, orquestador de tareas, baseline de TypeScript, tooling de calidad, git hooks, convenciones del repositorio y comandos de desarrollador unificados.

### Modified Capabilities
<!-- Ninguna: no hay specs previas en openspec/specs/ -->

## Impact

- **Código afectado**: todo el árbol del repo (nueva estructura). Código legado se preserva bajo `legacy/` hasta ser reemplazado en changes posteriores.
- **Dependencias nuevas**: `pnpm`, `turbo`, `typescript`, `eslint`, `prettier`, `husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional`.
- **Comandos de desarrollador**: `npm run dev` → `pnpm dev`. `npm install` → `pnpm install`.
- **Frontend externo** (`D:\Proyectos Konecta\FRONTK1`): *no* se mueve en este change. Su migración a `apps/web` ocurre en el change `rebuild-web-vite-tanstack-query`.
- **CI/CD**: sin cambios aquí. Se configura en `setup-ci-github-actions`.
- **Base de datos**: sin cambios. Se dockeriza en `dockerize-local-postgres`.
- **ORM / API / Front**: sin cambios aquí. Trabajo de changes posteriores.
