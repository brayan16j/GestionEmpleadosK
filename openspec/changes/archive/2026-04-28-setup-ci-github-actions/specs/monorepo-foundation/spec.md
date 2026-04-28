# Spec — `monorepo-foundation` (delta from `setup-ci-github-actions`)

Delta to the canonical `monorepo-foundation` spec introduced by `setup-ci-github-actions`. Adds a CI-parity script and pins `packageManager` so CI can derive the pnpm version without YAML edits.

---

## ADDED Requirements

### Requirement: `package.json#packageManager` is pinned

The repo-root `package.json` SHALL declare a `packageManager` field with the exact pinned pnpm version (e.g., `"packageManager": "pnpm@9.12.3"`). The pinned version SHALL match the version installed locally and used by `pnpm/action-setup` in CI. The field SHALL NOT be removed or set to a range.

#### Scenario: Local and CI agree on pnpm version

- **WHEN** a developer runs `pnpm --version` after `corepack enable && pnpm install`
- **THEN** the version matches the value declared in `package.json#packageManager`

#### Scenario: Bumping pnpm needs a single edit

- **WHEN** a maintainer updates `packageManager` to a newer pnpm version and pushes
- **THEN** the CI workflow installs the same new version automatically because `pnpm/action-setup@v4` reads the field, and no edit to `.github/workflows/ci.yml` is required

## MODIFIED Requirements

### Requirement: Node version pinning

The repository SHALL pin Node 20 LTS via a root `.nvmrc` file, and every `package.json` SHALL declare `engines.node >=20.19.0 <21`. The lower bound is `20.19.0` (not `20.18.0`) because Prisma 7 refuses to install on Node `<20.19.0` — running `pnpm install` on `20.18.x` fails the `prisma` `preinstall` script with `"Prisma only supports Node.js versions 20.19+, 22.12+, 24.0+"`.

#### Scenario: Developer using the wrong Node version

- **WHEN** a developer runs `pnpm install` on Node `20.18.x` or earlier
- **THEN** the `prisma` `preinstall` script aborts with a Node-version error and `pnpm install` exits non-zero, guiding the developer to upgrade via `nvm use` (which reads `.nvmrc`)

#### Scenario: CI provisions Node from `.nvmrc`

- **WHEN** a CI job runs `actions/setup-node@v4` with `node-version-file: .nvmrc`
- **THEN** the runner downloads the exact Node version listed in `.nvmrc` (`20.19.6` at the time of writing) and `pnpm install --frozen-lockfile` succeeds

### Requirement: Root scripts provide a unified developer interface

The root `package.json` SHALL expose at least these scripts, each delegating to Turborepo or the appropriate tool:

- `pnpm dev` — run all apps in development mode.
- `pnpm build` — build all workspaces.
- `pnpm lint` — lint all workspaces.
- `pnpm typecheck` — type-check all workspaces.
- `pnpm test` — run all test suites.
- `pnpm format` — run Prettier across the repo.
- `pnpm format:check` — Prettier check mode (no writes), used by CI.
- `pnpm clean` — remove all `dist/`, `.turbo/`, `node_modules/`.
- `pnpm ci:local` — reproduce the CI `quality` job locally; runs `pnpm format:check && pnpm lint && pnpm typecheck && pnpm build` in the same order CI does. SHALL exit non-zero on the first failing step.

#### Scenario: One-command bootstrap

- **WHEN** a developer runs `pnpm install && pnpm dev` on a fresh clone
- **THEN** both app skeletons start successfully within 60 seconds on a typical developer machine

#### Scenario: `pnpm ci:local` matches CI behavior

- **WHEN** a developer runs `pnpm ci:local` after introducing a lint error
- **THEN** the script fails at the lint step with the same error the CI `quality` job would print, before any further steps run

#### Scenario: `pnpm format:check` is non-mutating

- **WHEN** a developer runs `pnpm format:check` on a repo with already-formatted files
- **THEN** the command exits with code 0 and modifies no files
