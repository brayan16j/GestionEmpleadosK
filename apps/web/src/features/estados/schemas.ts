import { z } from "zod";

export const createEstadoSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(100),
  categoria: z.string().min(1, "Categoría requerida").max(100),
  cambiosPermitidos: z.string().max(500).nullish(),
});

export const updateEstadoSchema = createEstadoSchema;

export type CreateEstadoInput = z.infer<typeof createEstadoSchema>;
export type UpdateEstadoInput = z.infer<typeof updateEstadoSchema>;
