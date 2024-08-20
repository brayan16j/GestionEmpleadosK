import { Router } from "express";
import { createEstado, deleteEstado, getEstado, getEstados, updateEstado } from "../controllers/estadoController.js";
import { validaEstado } from "../validators/validaEstados.js";

const EstadoRouter = Router();

EstadoRouter.get('/estado', getEstados);
EstadoRouter.get('/estado/:id', getEstado);
EstadoRouter.post('/estado', validaEstado, createEstado);
EstadoRouter.put('/estado/:id', updateEstado);
EstadoRouter.delete('/estado/:id', deleteEstado);

export default EstadoRouter;