# EmployeeK

[![CI](https://github.com/brayan16j/GestionEmpleadosK/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/brayan16j/GestionEmpleadosK/actions/workflows/ci.yml)

Full-stack employee and task management app.

- **Backend:** Fastify + Prisma + PostgreSQL _(under construction)_
- **Frontend:** React + Vite _(under construction)_
- **Monorepo:** pnpm workspaces + Turborepo
- **Language:** TypeScript (strict)
- **Node:** 20 LTS

## Quick start

```bash
# Node 20 LTS (install via nvm/fnm/Volta)
nvm use   # uses .nvmrc

# pnpm is provisioned by Corepack
corepack enable
corepack prepare pnpm@9.15.4 --activate

# Install and run
pnpm install
pnpm dev
```

## Repository layout

```
apps/
  api/            backend
  web/            frontend
packages/
  eslint-config/  shared ESLint flat config
  tsconfig/       shared TypeScript presets
openspec/         change artifacts and living specifications
infra/            infrastructure (docker, scripts)
```

## Scripts

| Command             | Does                             |
| ------------------- | -------------------------------- |
| `pnpm dev`          | Run all apps in development      |
| `pnpm build`        | Build all apps (cached)          |
| `pnpm lint`         | ESLint across the monorepo       |
| `pnpm typecheck`    | TypeScript across the monorepo   |
| `pnpm test`         | Run all test suites              |
| `pnpm format`       | Prettier --write across the repo |
| `pnpm format:check` | Prettier --check (used in CI)    |

## Contributing

- Commits follow [Conventional Commits](https://www.conventionalcommits.org/); this is enforced by a commit-msg hook.
- Changes larger than a small fix go through the OpenSpec workflow under `openspec/`. See [`CLAUDE.md`](./CLAUDE.md) for the full contract.

## License

Private — Konecta.
