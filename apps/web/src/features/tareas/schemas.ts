import { z } from "zod";

export const createTareaSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(200),
  fechaCreacion: z.string().min(1, "Fecha de creación requerida"),
  fechaInicioTarea: z.string().min(1, "Fecha de inicio requerida"),
  fechaFinalizacion: z.string().min(1, "Fecha de finalización requerida"),
  idEmpleado: z.coerce.number().int().min(1, "Empleado requerido"),
  estadoNombre: z.string().min(1).max(100).optional(),
});

export const updateTareaSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(200),
  fechaCreacion: z.string().min(1, "Fecha de creación requerida"),
  fechaInicioTarea: z.string().min(1, "Fecha de inicio requerida"),
  fechaFinalizacion: z.string().min(1, "Fecha de finalización requerida"),
  idEmpleado: z.coerce.number().int().min(1, "Empleado requerido"),
});

export const cambiarEstadoSchema = z.object({
  idEstado: z.coerce.number().int().min(1, "Estado requerido"),
});

export type CreateTareaInput = z.infer<typeof createTareaSchema>;
export type UpdateTareaInput = z.infer<typeof updateTareaSchema>;
export type CambiarEstadoInput = z.infer<typeof cambiarEstadoSchema>;
