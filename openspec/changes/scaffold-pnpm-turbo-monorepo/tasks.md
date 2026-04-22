## 1. Pre-flight and quarantine

- [x] 1.1 Ensure working tree is clean (`git status` empty) and create branch `feat/scaffold-monorepo`
- [x] 1.2 Create top-level `legacy/` directory
- [x] 1.3 Move `src/`, `models/`, `config/`, `package.json`, `package-lock.json`, `sonar-project.properties` into `legacy/` (delete `node_modules/` at root; will be re-created under `legacy/` on demand)
- [x] 1.4 Verify legacy still works: `cd legacy && npm install && npm run dev` starts server on port 4000; stop server
- [x] 1.5 Commit: `chore(scaffold): quarantine legacy express app under /legacy`

## 2. Workspace foundation

- [x] 2.1 Create root `package.json` with name `@employeek/root`, `"private": true`, `engines.node >=20.18.0 <21`, `packageManager: "pnpm@9.x"`
- [x] 2.2 Create `pnpm-workspace.yaml` declaring `apps/*` and `packages/*`
- [x] 2.3 Create `turbo.json` with pipelines for `build`, `lint`, `typecheck`, `test`, `dev` (dev as persistent, others cached)
- [x] 2.4 Create `.nvmrc` with `20.18.0`
- [x] 2.5 Update root `.gitignore` (add `.turbo/`, `dist/`, `.env*` except `.env.example`, `*.tsbuildinfo`)
- [x] 2.6 Create `.gitattributes` with `* text=auto eol=lf` and binary rules
- [x] 2.7 Create `.editorconfig` (2 spaces, LF, UTF-8, trim trailing whitespace, final newline)
- [x] 2.8 Install base devDependencies at root: `typescript`, `turbo`, `prettier`, `eslint`, `@types/node`, `tsx`
- [x] 2.9 Commit: `chore(scaffold): initialize pnpm workspace with turborepo`

## 3. TypeScript baseline

- [ ] 3.1 Create `tsconfig.base.json` at root with `strict: true`, `noUncheckedIndexedAccess: true`, `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`, `esModuleInterop: true`, `skipLibCheck: true`, `forceConsistentCasingInFileNames: true`
- [ ] 3.2 Create `packages/tsconfig/` with `package.json` (`@employeek/tsconfig`) and presets: `base.json`, `node.json`, `react.json`
- [ ] 3.3 Verify `tsc --build --dry` at root completes without errors (no projects yet, acceptable)
- [ ] 3.4 Commit: `chore(scaffold): add shared typescript configuration`

## 4. App skeletons

- [ ] 4.1 Create `apps/api/package.json` with name `@employeek/api`, scripts: `dev` (tsx watch), `build` (tsc --build), `typecheck` (tsc --noEmit), `lint`, `test` (placeholder: `echo "no tests yet" && exit 0`)
- [ ] 4.2 Create `apps/api/tsconfig.json` extending `@employeek/tsconfig/node.json`
- [ ] 4.3 Create `apps/api/src/index.ts` with a minimal startup log (`console.log('api skeleton up')`)
- [ ] 4.4 Create `apps/web/package.json` with name `@employeek/web`, scripts identical shape (no Vite yet)
- [ ] 4.5 Create `apps/web/tsconfig.json` extending `@employeek/tsconfig/base.json`
- [ ] 4.6 Create `apps/web/src/index.ts` with a minimal startup log (`console.log('web skeleton up')`)
- [ ] 4.7 Run `pnpm install && pnpm build` at root; both skeletons must produce `dist/`
- [ ] 4.8 Commit: `chore(scaffold): add apps/api and apps/web typescript skeletons`

## 5. Shared packages

- [ ] 5.1 Create `packages/eslint-config/` with `package.json` (`@employeek/eslint-config`) exposing a flat config object with TypeScript + import rules + Prettier compatibility
- [ ] 5.2 Install peer/dev deps in `packages/eslint-config`: `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint-config-prettier`, `eslint-plugin-import`
- [ ] 5.3 Create root `eslint.config.js` that imports `@employeek/eslint-config` and applies it to all workspaces
- [ ] 5.4 Create root `.prettierrc` and `.prettierignore`
- [ ] 5.5 Run `pnpm lint` and `pnpm format --check`; both must pass
- [ ] 5.6 Commit: `chore(scaffold): add shared eslint and prettier configuration`

## 6. Git hooks and commit conventions

- [ ] 6.1 Install devDeps at root: `husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional`
- [ ] 6.2 Add root `package.json` script `prepare: "husky"` and run `pnpm prepare` once
- [ ] 6.3 Create `.husky/pre-commit` running `pnpm lint-staged`
- [ ] 6.4 Create `.husky/commit-msg` running `pnpm commitlint --edit $1`
- [ ] 6.5 Create `.husky/pre-push` running `pnpm typecheck`
- [ ] 6.6 Create `commitlint.config.js` extending `@commitlint/config-conventional`
- [ ] 6.7 Add `lint-staged` config in root `package.json` (ESLint on `*.{ts,tsx}`, Prettier on rest)
- [ ] 6.8 Test: attempt a commit with a bad message and confirm it is rejected; then commit with a valid message
- [ ] 6.9 Commit: `chore(scaffold): enforce conventional commits and pre-commit quality gates`

## 7. Developer documentation

- [ ] 7.1 Create root `CLAUDE.md` with: stack summary, root scripts, commit convention, OpenSpec workflow, "do not touch legacy/" rule
- [ ] 7.2 Replace root `README.md` with: badges, quick start (`pnpm install && pnpm dev`), structure map, links to `CLAUDE.md` and `openspec/`
- [ ] 7.3 Create `.vscode/extensions.json` recommending ESLint, Prettier, EditorConfig
- [ ] 7.4 Commit: `docs(scaffold): add CLAUDE.md and update README for monorepo`

## 8. Validation

- [ ] 8.1 Delete `node_modules/` and `.turbo/` at root; run `pnpm install` from clean — must succeed in < 60 seconds on typical dev machine
- [ ] 8.2 Run in sequence: `pnpm lint`, `pnpm format --check`, `pnpm typecheck`, `pnpm build`, `pnpm test` — all must exit 0
- [ ] 8.3 Run `pnpm dev` and confirm both skeletons print their startup message concurrently; stop with Ctrl+C
- [ ] 8.4 Run `pnpm lint` a second time and confirm Turbo reports a cache hit
- [ ] 8.5 Verify legacy still works: `cd legacy && npm run dev`
- [ ] 8.6 Commit: `chore(scaffold): validate monorepo boots end-to-end`

## 9. Archive handoff

- [ ] 9.1 Run `openspec status --change scaffold-pnpm-turbo-monorepo --json` and confirm all artifacts are `done`
- [ ] 9.2 Run `/opsx:archive` to move the `monorepo-foundation` spec into `openspec/specs/`
- [ ] 9.3 Merge branch `feat/scaffold-monorepo` into `main`
