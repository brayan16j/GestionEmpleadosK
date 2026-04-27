import { http } from "@/lib/http";
import type { Schema } from "@employeek/api-types";
import type { CreateEstadoInput, UpdateEstadoInput } from "./schemas";

export type Estado = Schema<"Estado">;

export const listEstados = () => http<Estado[]>("GET", "/estados");

export const getEstado = (id: number) => http<Estado>("GET", `/estados/${id}`);

export const createEstado = (body: CreateEstadoInput) => http<Estado>("POST", "/estados", body);

export const updateEstado = (id: number, body: UpdateEstadoInput) =>
  http<Estado>("PUT", `/estados/${id}`, body);

export const deleteEstado = (id: number) => http<void>("DELETE", `/estados/${id}`);
