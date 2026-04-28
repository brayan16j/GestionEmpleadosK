# Spec — `monorepo-foundation` (delta from `retire-legacy-express-stack`)

Delta a la spec canónica `monorepo-foundation`. Retira el contrato de cuarentena de `legacy/` ahora que el directorio es eliminado del repositorio.

---

## REMOVED Requirements

### Requirement: Legacy code quarantined under `legacy/`

**Reason:** El directorio `legacy/` se elimina del repositorio en este change. El API Fastify (`apps/api`) tiene paridad funcional con los 17 endpoints del Express+Sequelize legado y está cubierto por tests de integración y CI; la cuarentena cumplió su función como referencia durante la reescritura y ahora es deuda muerta. El historial de Git preserva el contenido completo del directorio para cualquier consulta futura.

**Migration:** Cualquier desarrollador que estuviera corriendo el legacy con `cd legacy && npm install && npm run dev` debe usar el nuevo stack: `pnpm install` desde la raíz seguido de `pnpm dev` (que arranca `apps/api` en el puerto 4000 y `apps/web` en el 5173). Para inspeccionar el código legado de forma puntual, usar `git show <sha>:legacy/<path>` apuntando a cualquier commit anterior al borrado, o `git log -- legacy/` para navegar el historial.
