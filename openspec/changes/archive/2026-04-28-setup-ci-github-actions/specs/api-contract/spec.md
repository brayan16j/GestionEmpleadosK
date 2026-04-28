# Spec — `api-contract` (delta from `setup-ci-github-actions`)

Delta to the canonical `api-contract` spec introduced by `setup-ci-github-actions`. Adds a CI gate that enforces the no-drift rule beyond the existing snapshot test.

---

## ADDED Requirements

### Requirement: CI enforces no-drift between code and `packages/api-types/`

The CI workflow SHALL include a job that regenerates the contract pipeline (`pnpm api:types`) and fails the build if the regeneration produces any diff in `packages/api-types/`. This requirement complements `apps/api/test/openapi-snapshot.test.ts` by also catching drift in the generated TypeScript artifacts (`packages/api-types/dist/`, `packages/api-types/src/generated.ts`), not only the JSON snapshot.

#### Scenario: PR with stale snapshot is blocked at CI

- **WHEN** a developer adds a route, regenerates the snapshot locally but forgets to run `pnpm api:types`, and opens a PR
- **THEN** the CI `contract-drift` job fails at `git diff --exit-code packages/api-types/` with a message instructing the developer to run `pnpm api:types` and commit the result

#### Scenario: PR with stale generated types is blocked at CI

- **WHEN** a developer manually edits `packages/api-types/openapi.json` without rerunning `pnpm api:types` (so `dist/` is out of sync with the JSON)
- **THEN** the CI `contract-drift` job fails because `pnpm api:types` regenerates `dist/` and `git diff --exit-code` detects the drift

#### Scenario: Up-to-date PR passes the gate

- **WHEN** a developer runs `pnpm api:types` locally before pushing and commits the result
- **THEN** the CI `contract-drift` job's `git diff --exit-code` step exits with code 0 and the job succeeds
