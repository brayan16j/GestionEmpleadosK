import { http } from "@/lib/http";
import type { Schema } from "@employeek/api-types";
import type { CreateEmpleadoInput, UpdateEmpleadoInput } from "./schemas";

export type Empleado = Schema<"Empleado">;

export const listEmpleados = () => http<Empleado[]>("GET", "/empleados");

export const getEmpleado = (id: number) => http<Empleado>("GET", `/empleados/${id}`);

export const createEmpleado = (body: CreateEmpleadoInput) =>
  http<Empleado>("POST", "/empleados", body);

export const updateEmpleado = (id: number, body: UpdateEmpleadoInput) =>
  http<Empleado>("PUT", `/empleados/${id}`, body);

export const deleteEmpleado = (id: number) => http<void>("DELETE", `/empleados/${id}`);

export const listTareasForEmpleado = (id: number) =>
  http<Schema<"Tarea">[]>("GET", `/empleados/${id}/tareas`);
