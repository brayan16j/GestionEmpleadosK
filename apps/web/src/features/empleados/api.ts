import { http } from "@/lib/http";
import type { Empleado, CreateEmpleadoInput, UpdateEmpleadoInput } from "./schemas";
import type { Tarea } from "@/features/tareas/schemas";

export const listEmpleados = () => http<Empleado[]>("GET", "/empleados");

export const getEmpleado = (id: number) => http<Empleado>("GET", `/empleados/${id}`);

export const createEmpleado = (body: CreateEmpleadoInput) =>
  http<Empleado>("POST", "/empleados", body);

export const updateEmpleado = (id: number, body: UpdateEmpleadoInput) =>
  http<Empleado>("PUT", `/empleados/${id}`, body);

export const deleteEmpleado = (id: number) => http<void>("DELETE", `/empleados/${id}`);

export const listTareasForEmpleado = (id: number) =>
  http<Tarea[]>("GET", `/empleados/${id}/tareas`);
