import { z } from "zod";

export const createEmpleadoSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(200),
  fechaIngreso: z.string().min(1, "Fecha de ingreso requerida"),
  salario: z.coerce.number().min(0, "El salario debe ser mayor o igual a 0"),
});

export const updateEmpleadoSchema = createEmpleadoSchema;

export type CreateEmpleadoInput = z.infer<typeof createEmpleadoSchema>;
export type UpdateEmpleadoInput = z.infer<typeof updateEmpleadoSchema>;

export interface Empleado {
  id: number;
  nombre: string;
  fechaIngreso: string;
  salario: string;
  createdAt: string;
  updatedAt: string;
}
