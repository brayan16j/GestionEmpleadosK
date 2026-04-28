# Tasks — `retire-legacy-express-stack`

## 1. Preparación

- [x] 1.1 Confirmar que la rama actual es `ch8/retire-legacy-express-stack` y working tree está limpio (`git branch --show-current` y `git status --porcelain`).
- [x] 1.2 Verificar que CI está verde sobre `main` antes de empezar el borrado, para tener una baseline limpia. _(`gh` no está instalado en este host. Validación indirecta: el push de `49a48ac` pasó el pre-push hook (typecheck) y `origin/main` está sincronizado con local. Confirmación visual del badge queda al usuario.)_

## 2. Audit de paridad endpoint-a-endpoint

- [x] 2.1 Listar los routers del legacy y confirmar el inventario: `legacy/src/routes/EmpleadosRouter.js`, `legacy/src/routes/EstadoRouter.js`, `legacy/src/routes/TareasRouter.js`. Para cada archivo, anotar los `router.<verb>(path, handler)` que se exportan. _(Total real: **18** endpoints — 6 empleados, 5 estado, 7 tareas. La estimación inicial de 17 era inexacta.)_
- [x] 2.2 Listar las rutas del nuevo API: leer `apps/api/src/routes/empleados.ts`, `apps/api/src/routes/estados.ts`, `apps/api/src/routes/tareas.ts`, `apps/api/src/routes/health.ts` y anotar cada `app.<verb>` declarado. _(Prefixes confirmados en `apps/api/src/app.ts:85-88`: `/empleados`, `/estados` plural, `/tareas`, health sin prefix. Health agrega 2 endpoints nuevos no presentes en legacy.)_
- [x] 2.3 Tomar la matriz de 17 filas en `design.md` (sección "Audit de paridad") y verificar fila por fila contra los archivos de los pasos 2.1 y 2.2. Marcar cada fila como verificada en una tabla local (no necesario editar `design.md` mientras la verificación esté limpia). _(La matriz original tenía 17 filas con varios errores de path/verbo. Se actualizó `design.md` con la matriz verificada de 18 filas y el veredicto final.)_
- [x] 2.4 Si alguna fila NO mapea (endpoint no portado, path divergente, verbo distinto), detener el proceso y abrir un follow-up: documentar en `proposal.md` (sección Open Questions) y decidir con el usuario si se aplaza el borrado o se acepta la deuda. Si todas mapean, continuar. _(Las 18 filas mapean a Fastify. Único cambio breaking documentado: `/estado` → `/estados` (singular → plural) consolidado en change 4, no introducido aquí. Paridad funcional 100%.)_

## 3. Borrado del directorio `legacy/`

- [x] 3.1 Ejecutar `git rm -rf legacy/` desde la raíz del repo. Verificar con `git status` que se eliminan los archivos versionados (`src/**`, `models/**`, `config/**`, `package.json`, `package-lock.json`, `sonar-project.properties`). _(23 archivos versionados eliminados.)_
- [x] 3.2 Eliminar `legacy/node_modules/` del filesystem si quedó (no estaba versionado, pero conviene dejar el directorio limpio): `rm -rf legacy/` después del paso 3.1.
- [x] 3.3 Confirmar que `legacy/` ya no existe: `ls legacy 2>&1` debe responder "No such file or directory".
- [x] 3.4 Hacer commit del borrado: `chore(legacy): remove quarantined Express+Sequelize app`. Cuerpo del commit: explicar que la cuarentena cumplió su función, el API Fastify tiene paridad, y el historial Git preserva el contenido. _(Commit `07bc06b`.)_

## 4. Limpieza de referencias en config

- [x] 4.1 Editar `.prettierignore`: quitar la línea `legacy/`. Verificar con `grep -n "legacy" .prettierignore` que no queda ninguna mención.
- [x] 4.2 Hacer commit: `chore(prettier): drop legacy/ ignore entry`. _(Commit `cd262c9`.)_

## 5. Limpieza de referencias en documentación

- [x] 5.1 Editar `CLAUDE.md`:
  - Quitar la línea `legacy/           # QUARANTINE: original Express app, do not touch` de la sección _Repository layout_ (~línea 29).
  - Quitar el bloque `**Port 4000 clash:** the legacy Express app in legacy/ also defaults to port 4000...` de la sección de HTTP API (~línea 135). El nuevo Fastify ya es el único en 4000, no hay clash que documentar.
  - Eliminar completa la sección `## Quarantined code — do not modify` (líneas ~250-260) que listaba `legacy/`. Si la sección incluía además `D:\Proyectos Konecta\FRONTK1\` (el front original fuera del repo), preservar esa entrada; renombrar la sección si queda solo ese ítem. _(Renombrada a "External reference material — do not modify", solo FRONTK1.)_
  - Quitar el bullet `- Never touch legacy/.` de la sección _When Claude is asked to do work_ (~línea 275).
- [x] 5.2 Editar `README.md`:
  - Quitar la línea `legacy/           original Express app (quarantine, do not modify)` del árbol de directorios (~línea 37).
  - Quitar el bullet `- Never modify files under legacy/ — they exist only until the legacy retirement change removes them.` (~línea 58).
- [x] 5.3 Verificación final: `git grep -i "legacy" -- ":(exclude)openspec/changes/archive/" ":(exclude)openspec/changes/retire-legacy-express-stack/"` debe NO devolver coincidencias relacionadas con el directorio borrado. (Mensajes en commit history, refs internas a otras "legacy" no relacionadas, o variables de código que casualmente contengan la palabra son aceptables — revisar caso por caso.) _(Limpieza extra: `eslint.config.js` y `tsconfig.base.json` (excludes de tooling), `.claude/commands/new-change.md` y `.claude/skills/new-change/SKILL.md` (guardrails). Los matches restantes en `openspec/specs/*` son referencias históricas en specs archivadas y se preservan.)_
- [x] 5.4 Hacer commit: `docs: remove legacy/ references from CLAUDE.md and README.md`. _(Commit `13b9286` — incluye además los archivos de tooling identificados en 5.3.)_

## 6. Validación local

- [x] 6.1 Correr `pnpm install` desde la raíz para confirmar que no hay deps huérfanas reportadas tras el borrado (no debería haber, `legacy/` nunca estuvo en `pnpm-workspace.yaml`). _("Already up to date" — sin huérfanas.)_
- [x] 6.2 Correr `pnpm ci:local` (`format:check && lint && typecheck && build`). Debe pasar verde. _(5 tasks Turbo successful, FULL TURBO cached.)_
- [x] 6.3 Correr `pnpm db:up && pnpm db:migrate:deploy && pnpm db:seed && pnpm test`. Debe pasar verde. (Bajar el contenedor con `pnpm db:down` al terminar es opcional.) _(28/28 tests web verdes; API integration tests también pasan dentro del Turbo run; 5 tasks Turbo successful.)_
- [x] 6.4 Correr `npx -y openspec validate --changes`. La change `retire-legacy-express-stack` debe validar. _(✓ change/retire-legacy-express-stack)_

## 7. PR y merge

- [x] 7.1 Pushear la rama: `git push -u origin ch8/retire-legacy-express-stack`. _(Hecho por el usuario.)_
- [x] 7.2 Abrir PR contra `main` con `gh pr create`. Título: `chore: retire legacy Express+Sequelize stack`. Cuerpo: resumen de lo borrado, mencionar que es el cierre del plan ADR-0 (8/8), y que el audit de paridad se completó (link al `design.md` del change). _(PR #12 abierto por el usuario.)_
- [x] 7.3 Esperar que los 5 jobs CI corran verde sobre el PR (`quality`, `test`, `contract-drift`, `openspec-sync`, `commitlint`). _(5/5 jobs verdes.)_
- [x] 7.4 Mergear el PR con squash o merge commit (la convención del repo en los 7 changes anteriores fue merge commit a través de la UI de GitHub). _(Merge commit `099a94d`.)_

## 8. Archivado y cierre

- [x] 8.1 Volver a `main` y `git pull --ff-only` para traer el merge. _(Fast-forwarded a `099a94d`.)_
- [x] 8.2 Marcar todas las tasks anteriores como `[x]`.
- [x] 8.3 Correr `/opsx:archive retire-legacy-express-stack` para mover el change a `openspec/changes/archive/2026-MM-DD-retire-legacy-express-stack/` y propagar el delta REMOVED a `openspec/specs/monorepo-foundation/spec.md`.
- [x] 8.4 Hacer commit y push del archive resultante (si el `/opsx:archive` deja working tree sucio).
- [x] 8.5 Actualizar la memoria del proyecto (`memory/project_employeek_refoundation.md`): marcar el plan ADR-0 como cerrado 8/8 y eliminar la cláusula "no tocar legacy/" de la sección _How to apply_.

## 9. Follow-ups identificados (para changes futuras)

- _Inicialmente vacío._ Si durante el audit (paso 2.4) aparece algún endpoint sin portar, agregarlo aquí con suficiente contexto para que una change futura lo aborde. De lo contrario, esta sección queda como evidencia de que el cierre fue limpio.
