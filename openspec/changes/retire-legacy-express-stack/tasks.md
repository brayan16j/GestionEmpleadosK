# Tasks — `retire-legacy-express-stack`

## 1. Preparación

- [ ] 1.1 Confirmar que la rama actual es `ch8/retire-legacy-express-stack` y working tree está limpio (`git branch --show-current` y `git status --porcelain`).
- [ ] 1.2 Verificar que CI está verde sobre `main` antes de empezar el borrado, para tener una baseline limpia.

## 2. Audit de paridad endpoint-a-endpoint

- [ ] 2.1 Listar los routers del legacy y confirmar el inventario: `legacy/src/routes/EmpleadosRouter.js`, `legacy/src/routes/EstadoRouter.js`, `legacy/src/routes/TareasRouter.js`. Para cada archivo, anotar los `router.<verb>(path, handler)` que se exportan.
- [ ] 2.2 Listar las rutas del nuevo API: leer `apps/api/src/routes/empleados.ts`, `apps/api/src/routes/estados.ts`, `apps/api/src/routes/tareas.ts`, `apps/api/src/routes/health.ts` y anotar cada `app.<verb>` declarado.
- [ ] 2.3 Tomar la matriz de 17 filas en `design.md` (sección "Audit de paridad") y verificar fila por fila contra los archivos de los pasos 2.1 y 2.2. Marcar cada fila como verificada en una tabla local (no necesario editar `design.md` mientras la verificación esté limpia).
- [ ] 2.4 Si alguna fila NO mapea (endpoint no portado, path divergente, verbo distinto), detener el proceso y abrir un follow-up: documentar en `proposal.md` (sección Open Questions) y decidir con el usuario si se aplaza el borrado o se acepta la deuda. Si todas mapean, continuar.

## 3. Borrado del directorio `legacy/`

- [ ] 3.1 Ejecutar `git rm -rf legacy/` desde la raíz del repo. Verificar con `git status` que se eliminan los archivos versionados (`src/**`, `models/**`, `config/**`, `package.json`, `package-lock.json`, `sonar-project.properties`).
- [ ] 3.2 Eliminar `legacy/node_modules/` del filesystem si quedó (no estaba versionado, pero conviene dejar el directorio limpio): `rm -rf legacy/` después del paso 3.1.
- [ ] 3.3 Confirmar que `legacy/` ya no existe: `ls legacy 2>&1` debe responder "No such file or directory".
- [ ] 3.4 Hacer commit del borrado: `chore(legacy): remove quarantined Express+Sequelize app`. Cuerpo del commit: explicar que la cuarentena cumplió su función, el API Fastify tiene paridad, y el historial Git preserva el contenido.

## 4. Limpieza de referencias en config

- [ ] 4.1 Editar `.prettierignore`: quitar la línea `legacy/`. Verificar con `grep -n "legacy" .prettierignore` que no queda ninguna mención.
- [ ] 4.2 Hacer commit: `chore(prettier): drop legacy/ ignore entry`.

## 5. Limpieza de referencias en documentación

- [ ] 5.1 Editar `CLAUDE.md`:
  - Quitar la línea `legacy/           # QUARANTINE: original Express app, do not touch` de la sección _Repository layout_ (~línea 29).
  - Quitar el bloque `**Port 4000 clash:** the legacy Express app in legacy/ also defaults to port 4000...` de la sección de HTTP API (~línea 135). El nuevo Fastify ya es el único en 4000, no hay clash que documentar.
  - Eliminar completa la sección `## Quarantined code — do not modify` (líneas ~250-260) que listaba `legacy/`. Si la sección incluía además `D:\Proyectos Konecta\FRONTK1\` (el front original fuera del repo), preservar esa entrada; renombrar la sección si queda solo ese ítem.
  - Quitar el bullet `- Never touch legacy/.` de la sección _When Claude is asked to do work_ (~línea 275).
- [ ] 5.2 Editar `README.md`:
  - Quitar la línea `legacy/           original Express app (quarantine, do not modify)` del árbol de directorios (~línea 37).
  - Quitar el bullet `- Never modify files under legacy/ — they exist only until the legacy retirement change removes them.` (~línea 58).
- [ ] 5.3 Verificación final: `git grep -i "legacy" -- ":(exclude)openspec/changes/archive/" ":(exclude)openspec/changes/retire-legacy-express-stack/"` debe NO devolver coincidencias relacionadas con el directorio borrado. (Mensajes en commit history, refs internas a otras "legacy" no relacionadas, o variables de código que casualmente contengan la palabra son aceptables — revisar caso por caso.)
- [ ] 5.4 Hacer commit: `docs: remove legacy/ references from CLAUDE.md and README.md`.

## 6. Validación local

- [ ] 6.1 Correr `pnpm install` desde la raíz para confirmar que no hay deps huérfanas reportadas tras el borrado (no debería haber, `legacy/` nunca estuvo en `pnpm-workspace.yaml`).
- [ ] 6.2 Correr `pnpm ci:local` (`format:check && lint && typecheck && build`). Debe pasar verde.
- [ ] 6.3 Correr `pnpm db:up && pnpm db:migrate:deploy && pnpm db:seed && pnpm test`. Debe pasar verde. (Bajar el contenedor con `pnpm db:down` al terminar es opcional.)
- [ ] 6.4 Correr `npx -y openspec validate --changes`. La change `retire-legacy-express-stack` debe validar.

## 7. PR y merge

- [ ] 7.1 Pushear la rama: `git push -u origin ch8/retire-legacy-express-stack`.
- [ ] 7.2 Abrir PR contra `main` con `gh pr create`. Título: `chore: retire legacy Express+Sequelize stack`. Cuerpo: resumen de lo borrado, mencionar que es el cierre del plan ADR-0 (8/8), y que el audit de paridad se completó (link al `design.md` del change).
- [ ] 7.3 Esperar que los 5 jobs CI corran verde sobre el PR (`quality`, `test`, `contract-drift`, `openspec-sync`, `commitlint`).
- [ ] 7.4 Mergear el PR con squash o merge commit (la convención del repo en los 7 changes anteriores fue merge commit a través de la UI de GitHub).

## 8. Archivado y cierre

- [ ] 8.1 Volver a `main` y `git pull --ff-only` para traer el merge.
- [ ] 8.2 Marcar todas las tasks anteriores como `[x]`.
- [ ] 8.3 Correr `/opsx:archive retire-legacy-express-stack` para mover el change a `openspec/changes/archive/2026-MM-DD-retire-legacy-express-stack/` y propagar el delta REMOVED a `openspec/specs/monorepo-foundation/spec.md`.
- [ ] 8.4 Hacer commit y push del archive resultante (si el `/opsx:archive` deja working tree sucio).
- [ ] 8.5 Actualizar la memoria del proyecto (`memory/project_employeek_refoundation.md`): marcar el plan ADR-0 como cerrado 8/8 y eliminar la cláusula "no tocar legacy/" de la sección _How to apply_.

## 9. Follow-ups identificados (para changes futuras)

- _Inicialmente vacío._ Si durante el audit (paso 2.4) aparece algún endpoint sin portar, agregarlo aquí con suficiente contexto para que una change futura lo aborde. De lo contrario, esta sección queda como evidencia de que el cierre fue limpio.
