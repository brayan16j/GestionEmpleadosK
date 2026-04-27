# Spec delta — `monorepo-foundation`

## ADDED Requirements

### Requirement: `packages/api-types` is registered as a workspace and orchestrated by Turbo

The repository SHALL include `packages/api-types/` as a pnpm workspace member (already covered by the `packages/*` glob in `pnpm-workspace.yaml`). `turbo.json` SHALL declare a task `@employeek/api-types#build` with `dependsOn: ["@employeek/api#openapi:dump"]` and `inputs: ["openapi.json", "src/**", "tsconfig.json", "package.json"]`. The `@employeek/api#openapi:dump` task SHALL declare `outputs: ["../../packages/api-types/openapi.json"]` so Turbo's cache invalidates `api-types#build` when the snapshot changes.

#### Scenario: Turbo runs the dump before the type build

- **WHEN** a developer runs `pnpm build` from the repo root after a change to `apps/api/src/routes/empleados.ts`
- **THEN** Turbo executes `@employeek/api#openapi:dump` first, then `@employeek/api-types#build`, and the latter sees the freshly written `openapi.json`

#### Scenario: Cached pipeline finishes fast on no-op rebuilds

- **WHEN** a developer runs `pnpm build` twice without changing any source
- **THEN** both `@employeek/api#openapi:dump` and `@employeek/api-types#build` report cache hits in the second run

### Requirement: Root scripts expose the contract pipeline

The repo-root `package.json` SHALL expose two scripts:

- `api:openapi` — proxies to `pnpm --filter @employeek/api openapi:dump`. Used when only the snapshot needs refreshing (e.g., to inspect the document or commit it manually).
- `api:types` — runs `api:openapi` then `pnpm --filter @employeek/api-types build`. Used by developers after editing routes or schemas.

These scripts SHALL be documented in `CLAUDE.md` under a new "OpenAPI contract" subsection.

#### Scenario: `pnpm api:openapi` updates the snapshot only

- **WHEN** a developer runs `pnpm api:openapi`
- **THEN** `packages/api-types/openapi.json` is rewritten and `packages/api-types/dist/` is unchanged

#### Scenario: `pnpm api:types` regenerates types end-to-end

- **WHEN** a developer runs `pnpm api:types` after editing a schema in `apps/api/src/schemas/`
- **THEN** both `packages/api-types/openapi.json` and `packages/api-types/dist/index.d.ts` reflect the schema change, and `apps/web` typecheck consumes the new types without further commands

### Requirement: `packages/api-types` follows the existing TypeScript baseline

`packages/api-types/tsconfig.json` SHALL extend `@employeek/tsconfig/base.json` (or the closest preset compatible with type-only output). `packages/api-types/package.json` SHALL declare `@employeek/tsconfig: workspace:*` as a devDependency. The package's `lint`, `typecheck`, and `build` scripts SHALL be picked up by the root `pnpm lint`, `pnpm typecheck`, and `pnpm build` commands without any `turbo.json` changes beyond those listed above.

#### Scenario: `pnpm typecheck` covers the new package

- **WHEN** a developer runs `pnpm typecheck` from the root
- **THEN** Turbo invokes the `typecheck` script in `@employeek/api-types` and the package compiles without errors

#### Scenario: Generated artifacts do not leak into lint

- **WHEN** a developer runs `pnpm lint` from the root
- **THEN** ESLint ignores `packages/api-types/src/generated.ts` and `packages/api-types/dist/` (configured via the package's local `.eslintignore` or root flat-config ignore patterns)
