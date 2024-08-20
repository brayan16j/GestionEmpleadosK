import { Router } from "express";
import { createEmpleado, 
         deleteEmpleado, 
         getEmpleado, getEmpleadoTareas, getEmpleados, updateEmpleado } from "../controllers/empleadosController.js";
import { validaCrea } from "../validators/empleados.js";

const EmpleadosRouter = Router();

EmpleadosRouter.get('/empleados', getEmpleados);
EmpleadosRouter.post('/empleados', validaCrea, createEmpleado);
EmpleadosRouter.put('/empleados/:id', updateEmpleado);
EmpleadosRouter.delete('/empleados/:id', deleteEmpleado);

EmpleadosRouter.get('/empleados/:id', getEmpleado);

EmpleadosRouter.get('/empleados/:id/tareas', getEmpleadoTareas); // principio de api res

export default EmpleadosRouter;