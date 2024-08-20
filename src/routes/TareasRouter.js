import { Router } from "express";
import { cambiarEstadoTarea, createTareas, deleteTarea, getTarea, getTareas, getTareasByCategoria, updateTarea } from "../controllers/tareasController.js";
import { validaTarea } from "../validators/validaTareas.js";

const TareasRouter = Router();

TareasRouter.get('/tareas', getTareas);
TareasRouter.get('/tareas/categoria/:categoria', getTareasByCategoria);
TareasRouter.post('/tareas', validaTarea, createTareas);
TareasRouter.put('/tareas/:id', updateTarea);
TareasRouter.put('/tareas/:id/estado', cambiarEstadoTarea);
TareasRouter.delete('/tareas/:id', deleteTarea);
TareasRouter.get('/tareas/:id', getTarea);

export default TareasRouter;