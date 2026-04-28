# Spec — `ci-github-actions`

Specification for the GitHub Actions continuous integration pipeline that gates merges into `main`. Introduced by `setup-ci-github-actions`.

---

## ADDED Requirements

### Requirement: CI workflow file lives at `.github/workflows/ci.yml`

The repository SHALL contain a workflow file at `.github/workflows/ci.yml` that defines the continuous integration pipeline. The workflow SHALL trigger on `push` to `main` and on `pull_request` targeting `main`. It SHALL declare `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }` so superseded runs on the same ref are cancelled automatically.

#### Scenario: Workflow runs on push to main

- **WHEN** a developer pushes a commit directly to `main`
- **THEN** GitHub Actions starts a run of the `CI` workflow within 30 seconds and the run appears under the commit's status checks

#### Scenario: Workflow runs on pull request

- **WHEN** a developer opens a pull request from `ch7/setup-ci-github-actions` to `main`
- **THEN** GitHub Actions starts a run of the `CI` workflow against the PR's merge commit and the status check appears on the PR page

#### Scenario: Superseded runs are cancelled

- **WHEN** a developer pushes a second commit to a PR while the first run is still executing
- **THEN** the first run is cancelled with status `cancelled` and only the latest commit's run continues to completion

### Requirement: Workflow uses Node 20 from `.nvmrc` and pnpm pinned by `packageManager`

Every job in `ci.yml` SHALL use `actions/setup-node@v4` with `node-version-file: .nvmrc` to read the Node version from the repo root. Every job SHALL use `pnpm/action-setup@v4` without an explicit `version` input, so the version is derived from `package.json#packageManager`. No job SHALL hard-code a Node or pnpm version literal in YAML.

#### Scenario: Bumping `.nvmrc` updates CI without YAML edits

- **WHEN** `.nvmrc` is changed from `20.18.0` to `20.19.0` in a single commit
- **THEN** the next CI run installs Node `20.19.0` without any change to `.github/workflows/ci.yml`

#### Scenario: pnpm version comes from `packageManager`

- **WHEN** a developer reads any job's setup steps in `ci.yml`
- **THEN** the `pnpm/action-setup` step appears without a `version` input, deriving the version from `packageManager` field of the root `package.json`

### Requirement: `quality` job runs format, lint, typecheck, and build without a database

The workflow SHALL define a job named `quality` that runs `pnpm install --frozen-lockfile`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` in that order. The job SHALL NOT depend on a database service. Any non-zero exit code from any step SHALL fail the job.

#### Scenario: Format violation fails the job

- **WHEN** a developer pushes a commit with a `.ts` file that is not Prettier-formatted
- **THEN** the `quality` job fails at the `pnpm format:check` step with a non-zero exit code and the diff is printed in the job log

#### Scenario: Build succeeds without DB

- **WHEN** the `quality` job runs and Postgres is not part of its services
- **THEN** the `pnpm build` step completes successfully because no workspace's `build` task touches the database at build time

### Requirement: `test` job runs Vitest against a Postgres service container

The workflow SHALL define a job named `test` that uses `services.postgres` with image `postgres:16-alpine`, env `POSTGRES_USER=employeek`, `POSTGRES_PASSWORD=employeek`, `POSTGRES_DB=employeek`, ports `5432:5432`, and the healthcheck `pg_isready -U employeek`. The job SHALL export `DATABASE_URL=postgresql://employeek:employeek@localhost:5432/employeek?schema=public` to the environment, install dependencies, run `pnpm db:migrate:deploy`, then `pnpm db:seed`, then `pnpm test`. All Vitest suites across all workspaces SHALL run; integration tests SHALL connect to the service container.

#### Scenario: Integration tests pass against the service container

- **WHEN** the `test` job starts and the Postgres service reports healthy
- **THEN** `pnpm db:migrate:deploy` applies all migrations, `pnpm db:seed` populates `estado`, and `pnpm test` runs every workspace's suite, including the OpenAPI snapshot test

#### Scenario: Migration failure fails the job

- **WHEN** a developer pushes a malformed migration that fails to apply
- **THEN** the `test` job fails at the `pnpm db:migrate:deploy` step before any test runs, and the migration error is printed in the log

### Requirement: `contract-drift` job verifies `pnpm api:types` produces no diff

The workflow SHALL define a job named `contract-drift` that runs `pnpm install --frozen-lockfile`, then `pnpm api:types`, then `git diff --exit-code packages/api-types/`. The job SHALL fail if the diff is non-empty, with a concluding log line stating that the developer must run `pnpm api:types` locally and commit the result.

#### Scenario: Drifted snapshot fails the job

- **WHEN** a developer adds a new route to `apps/api/src/routes/` and pushes without running `pnpm api:types`
- **THEN** the `contract-drift` job runs `pnpm api:types`, detects a non-empty diff in `packages/api-types/`, and fails with exit code 1 and an actionable error message

#### Scenario: In-sync snapshot passes the job

- **WHEN** a developer runs `pnpm api:types` locally, commits the result, and pushes
- **THEN** the `contract-drift` job's `git diff --exit-code` step exits with code 0 and the job succeeds

### Requirement: `openspec-sync` job validates change artifacts

The workflow SHALL define a job named `openspec-sync` that installs the OpenSpec CLI (`@fission-ai/openspec`, matching the version used locally) via `npx -y @fission-ai/openspec@<pinned>` and runs `openspec validate --changes` from the repo root. The job SHALL fail if any in-flight change in `openspec/changes/` has missing dependencies, malformed artifacts, or unsynced delta specs. The `--changes` flag is required because `openspec validate` without arguments exits non-zero with `Nothing to validate`.

#### Scenario: Malformed change fails the job

- **WHEN** a developer pushes a PR where `openspec/changes/<name>/proposal.md` references a capability that has no corresponding `specs/<name>/spec.md` file
- **THEN** the `openspec-sync` job fails with the validation error pointing to the missing spec file

#### Scenario: Valid changes pass the job

- **WHEN** every in-flight change passes `openspec validate` locally
- **THEN** the `openspec-sync` job exits with code 0

### Requirement: `commitlint` job validates Conventional Commits in pull requests

The workflow SHALL define a job named `commitlint` that runs only on `pull_request` events. The job SHALL run `npx commitlint --from origin/main --to HEAD --config commitlint.config.cjs` to validate every commit in the PR's range. The job SHALL fail if any commit message violates Conventional Commits.

#### Scenario: Non-conventional commit fails the PR

- **WHEN** a developer opens a PR containing a commit with message `fixed stuff`
- **THEN** the `commitlint` job fails, naming the offending commit hash and explaining the expected format

#### Scenario: Conventional commits pass the job

- **WHEN** every commit in a PR follows `<type>(<scope>): <subject>`
- **THEN** the `commitlint` job exits with code 0

#### Scenario: Job does not run on push

- **WHEN** a commit is pushed directly to `main`
- **THEN** the `commitlint` job is skipped (only `quality`, `test`, `contract-drift`, and `openspec-sync` run)

### Requirement: pnpm store and Turbo cache are persisted across runs

Every job in `ci.yml` that runs `pnpm install` SHALL precede it with an `actions/cache@v4` step that caches `~/.pnpm-store` keyed by `pnpm-store-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}` with `restore-keys: pnpm-store-${{ runner.os }}-`. Jobs that run Turbo tasks SHALL additionally cache `node_modules/.cache/turbo` keyed by `turbo-${{ runner.os }}-${{ github.sha }}` with `restore-keys: turbo-${{ runner.os }}-`.

#### Scenario: Warm cache run completes faster

- **WHEN** a second CI run on the same ref starts after a first run completed successfully
- **THEN** the `pnpm install` step reports cache hits for the pnpm store and the total wall-clock time is at least 50% lower than the cold cache run

#### Scenario: Lockfile change invalidates the pnpm cache

- **WHEN** a developer commits a change to `pnpm-lock.yaml`
- **THEN** the next run's `actions/cache` step reports a cache miss for the pnpm store key and falls back to `restore-keys` for partial restore

### Requirement: README displays the CI status badge

The repo-root `README.md` SHALL include a status badge near the top (within the first 20 lines) of the form `[![CI](https://github.com/<owner>/<repo>/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/<owner>/<repo>/actions/workflows/ci.yml)`. The badge SHALL link to the workflow runs page when clicked.

#### Scenario: Badge reflects main branch status

- **WHEN** a viewer opens the repo's README on GitHub after a green run on `main`
- **THEN** the badge renders in green with text "CI passing" and clicking it opens the workflow runs page filtered by `ci.yml`

#### Scenario: Failing main turns the badge red

- **WHEN** a hotfix commit pushed directly to `main` fails the workflow
- **THEN** the badge renders in red with text "CI failing" within 5 minutes of the failure
