import { http } from "@/lib/http";
import type { Tarea, CreateTareaInput, UpdateTareaInput, CambiarEstadoInput } from "./schemas";

export const listTareas = () => http<Tarea[]>("GET", "/tareas");

export const listTareasByCategoria = (categoria: string) =>
  http<Tarea[]>("GET", `/tareas/categoria/${encodeURIComponent(categoria)}`);

export const getTarea = (id: number) => http<Tarea>("GET", `/tareas/${id}`);

export const createTarea = (body: CreateTareaInput) => http<Tarea>("POST", "/tareas", body);

export const updateTarea = (id: number, body: UpdateTareaInput) =>
  http<Tarea>("PUT", `/tareas/${id}`, body);

export const cambiarEstado = (id: number, body: CambiarEstadoInput) =>
  http<Tarea>("PUT", `/tareas/${id}/estado`, body);

export const deleteTarea = (id: number) => http<void>("DELETE", `/tareas/${id}`);
