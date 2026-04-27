# Monorepo Foundation Specification

## Purpose

This capability defines the foundational structure, tooling, and developer interface of the EmployeeK monorepo. It establishes how workspaces are organized, how tasks are orchestrated, how code quality is enforced, and how contributors interact with the repository on day one.

## Requirements

### Requirement: Monorepo managed by pnpm workspaces
The repository SHALL be managed as a pnpm workspace with a `pnpm-workspace.yaml` at the root that declares `apps/*` and `packages/*` as workspace locations.

#### Scenario: Fresh clone installs all workspaces
- **WHEN** a developer clones the repository and runs `pnpm install`
- **THEN** dependencies for the root, every `apps/*` package, and every `packages/*` package are resolved and linked without errors

#### Scenario: Adding a new workspace package
- **WHEN** a new directory is added under `apps/` or `packages/` with a valid `package.json`
- **THEN** the next `pnpm install` detects and links it automatically without changes to `pnpm-workspace.yaml`

### Requirement: Task orchestration with Turborepo
The repository SHALL use Turborepo via a root `turbo.json` to orchestrate `build`, `lint`, `typecheck`, `test`, and `dev` tasks across all workspaces, with caching enabled for non-`dev` tasks.

#### Scenario: Running build across the monorepo
- **WHEN** a developer runs `pnpm build` from the root
- **THEN** Turborepo runs `build` in every workspace that defines it, respecting declared dependencies between packages

#### Scenario: Rerunning a cached task
- **WHEN** a developer reruns `pnpm lint` without changing any files
- **THEN** Turborepo reports cache hits for every workspace and completes in under 2 seconds

#### Scenario: Development mode
- **WHEN** a developer runs `pnpm dev` from the root
- **THEN** Turborepo starts the `dev` script of every app in parallel and streams their output

### Requirement: TypeScript strict baseline shared across workspaces
The repository SHALL provide a root `tsconfig.base.json` with `strict: true`, `noUncheckedIndexedAccess: true`, `target: ES2022`, and `module: NodeNext`. Every workspace that uses TypeScript SHALL extend this base.

#### Scenario: New package inherits strict rules
- **WHEN** a developer adds a new `packages/foo/tsconfig.json` that extends `tsconfig.base.json`
- **THEN** strict type checking is applied to that package without additional configuration

#### Scenario: Typecheck runs across the monorepo
- **WHEN** a developer runs `pnpm typecheck` from the root
- **THEN** TypeScript validates every workspace using project references and exits with code 0 if all pass

### Requirement: Unified linting with ESLint flat config
The repository SHALL use ESLint 9 flat config (`eslint.config.js`) at the root, with shared rules provided by `packages/eslint-config`. Every workspace SHALL be covered by this lint config.

#### Scenario: Running lint at the root
- **WHEN** a developer runs `pnpm lint` from the root
- **THEN** ESLint checks every TypeScript file across all workspaces and reports issues consistently

#### Scenario: Consistent rules across apps and packages
- **WHEN** the same linting rule is violated in `apps/api` and in `apps/web`
- **THEN** both violations are reported with identical severity and rule id

### Requirement: Code formatting with Prettier
The repository SHALL use Prettier as the single source of truth for code formatting. ESLint SHALL NOT enforce formatting rules that conflict with Prettier (via `eslint-config-prettier`).

#### Scenario: Formatting the repository
- **WHEN** a developer runs `pnpm format` from the root
- **THEN** every supported file is formatted according to the root `.prettierrc` and no ESLint formatting errors remain

### Requirement: Pre-commit and commit-message hooks
The repository SHALL enforce quality gates via husky:
- On `pre-commit`, `lint-staged` SHALL run ESLint and Prettier on staged files.
- On `commit-msg`, commitlint SHALL reject any message that does not follow Conventional Commits.
- On `pre-push`, `pnpm typecheck` SHALL run in affected workspaces.

#### Scenario: Committing malformed code
- **WHEN** a developer stages a file with ESLint errors and runs `git commit`
- **THEN** the commit is aborted and the ESLint errors are printed

#### Scenario: Committing with non-conventional message
- **WHEN** a developer commits with message "fixed stuff"
- **THEN** commitlint aborts the commit with a message explaining the Conventional Commits format

#### Scenario: Pushing code that fails typecheck
- **WHEN** a developer runs `git push` after introducing a type error
- **THEN** the push is aborted and the type error is reported

### Requirement: Node version pinning
The repository SHALL pin Node 20 LTS via a root `.nvmrc` file, and every `package.json` SHALL declare `engines.node >=20.18.0 <21`.

#### Scenario: Developer using the wrong Node version
- **WHEN** a developer runs `pnpm install` on Node 18
- **THEN** pnpm warns or refuses based on the `engines` field and the developer is guided to switch via `nvm use`

### Requirement: Repository hygiene files
The repository SHALL include `.gitattributes` enforcing LF line endings (`* text=auto eol=lf`), `.editorconfig` enforcing 2-space indentation / UTF-8 / LF / trim-trailing-whitespace, and an updated `.gitignore` that covers `node_modules/`, `.turbo/`, `dist/`, `.env*` (except `.env.example`), and IDE metadata.

#### Scenario: Cross-platform consistency
- **WHEN** developers on Windows and Linux commit the same file
- **THEN** the committed file has LF endings and no trailing whitespace

### Requirement: Application and package skeletons
The repository SHALL contain:
- `apps/api/` with a minimal TypeScript entry point printing a startup message (no Express, no Fastify, no framework).
- `apps/web/` with a minimal TypeScript entry point (no React, no Vite yet — bootstrap happens in `rebuild-web-vite-tanstack-query`).
- `packages/tsconfig/` exposing shared TypeScript presets.
- `packages/eslint-config/` exposing shared ESLint config.

#### Scenario: App skeletons build
- **WHEN** a developer runs `pnpm --filter @employeek/api build` and `pnpm --filter @employeek/web build`
- **THEN** both skeletons emit `dist/` output without errors

### Requirement: Legacy code quarantined under `legacy/`
The repository SHALL move all pre-existing backend code (current `src/`, `models/`, `config/`, `package.json`, `package-lock.json`) into a top-level `legacy/` directory. This directory SHALL NOT be included in the pnpm workspace or in Turborepo pipelines, and SHALL remain runnable with `cd legacy && npm install && npm run dev` until it is retired in a later change.

#### Scenario: Legacy still runs
- **WHEN** a developer runs `cd legacy && npm install && npm run dev`
- **THEN** the original Express server starts on port 4000 as before

#### Scenario: Legacy is excluded from monorepo commands
- **WHEN** a developer runs `pnpm lint`, `pnpm typecheck`, or `pnpm build` from the root
- **THEN** no file under `legacy/` is processed

### Requirement: Developer documentation in `CLAUDE.md`
The repository SHALL contain a `CLAUDE.md` at the root that documents:
- the stack and tooling choices,
- the full list of root scripts (`pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format`),
- Conventional Commit rules with examples,
- the `openspec/` workflow (`/opsx:propose` → `/opsx:apply` → `/opsx:archive`),
- a "do not touch `legacy/`" rule until the retirement change.

#### Scenario: New contributor onboards
- **WHEN** a new contributor opens the repo and reads `CLAUDE.md`
- **THEN** they can run `pnpm install && pnpm dev` and understand the commit/change workflow without asking

### Requirement: `packages/api-types` workspace is registered and orchestrated by Turbo

The `packages/api-types/` directory SHALL be recognized automatically by pnpm (via the existing `packages/*` glob in `pnpm-workspace.yaml`) and SHALL be listed in the Turbo pipeline so that `pnpm build` orchestrates its build task in dependency order. `turbo.json` SHALL include a task entry for `@employeek/api-types#build` with `dependsOn: ["@employeek/api#openapi:dump"]`.

#### Scenario: `packages/api-types` appears in the workspace listing

- **WHEN** a developer runs `pnpm m ls --depth -1` after `pnpm install`
- **THEN** `@employeek/api-types` is listed alongside `@employeek/api`, `@employeek/web`, `@employeek/tsconfig`, and `@employeek/eslint-config`

#### Scenario: Turbo respects api-types build order

- **WHEN** a developer runs `pnpm build` from the repo root
- **THEN** Turbo completes `@employeek/api#openapi:dump` before starting `@employeek/api-types#build`

### Requirement: Root scripts expose `api:openapi` and `api:types` convenience commands

The root `package.json` SHALL expose:

- `api:openapi` — proxies to `pnpm --filter @employeek/api openapi:dump` (dumps the live OpenAPI snapshot).
- `api:types` — runs `api:openapi` then `pnpm --filter @employeek/api-types build` (end-to-end contract pipeline).

These commands are part of the standard developer interface documented in `CLAUDE.md`.

#### Scenario: `pnpm api:openapi` updates the snapshot

- **WHEN** a developer runs `pnpm api:openapi` from the repo root
- **THEN** `packages/api-types/openapi.json` is written (or overwritten) without requiring the developer to know the underlying filter command

#### Scenario: `pnpm api:types` regenerates types end-to-end

- **WHEN** a developer runs `pnpm api:types` after adding a new route
- **THEN** the snapshot is refreshed and `packages/api-types/dist/` is rebuilt, making new types available to `apps/web`

### Requirement: `packages/api-types` follows the TypeScript strict baseline

`packages/api-types/tsconfig.json` SHALL extend `@employeek/tsconfig/base.json` (strict, NodeNext, ES2022) so that its source and generated types are checked under the same rules as every other workspace.

#### Scenario: Typecheck covers `packages/api-types`

- **WHEN** a developer runs `pnpm typecheck` from the root
- **THEN** TypeScript validates `packages/api-types/src/index.ts` (and any other `.ts` files there) using project references and exits with code `0` if all pass

#### Scenario: Strict violations in `packages/api-types` are caught

- **WHEN** a developer introduces an implicit `any` in `packages/api-types/src/index.ts`
- **THEN** `pnpm typecheck` fails with a `noImplicitAny` error pointing at the offending line

### Requirement: Root scripts provide a unified developer interface
The root `package.json` SHALL expose at least these scripts, each delegating to Turborepo or the appropriate tool:
- `pnpm dev` — run all apps in development mode.
- `pnpm build` — build all workspaces.
- `pnpm lint` — lint all workspaces.
- `pnpm typecheck` — type-check all workspaces.
- `pnpm test` — run all test suites (no-op until tests exist).
- `pnpm format` — run Prettier across the repo.
- `pnpm clean` — remove all `dist/`, `.turbo/`, `node_modules/`.

#### Scenario: One-command bootstrap
- **WHEN** a developer runs `pnpm install && pnpm dev` on a fresh clone
- **THEN** both app skeletons start successfully within 60 seconds on a typical developer machine
