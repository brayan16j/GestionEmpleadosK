export const empleadoSchema = {
  $id: "Empleado",
  type: "object",
  required: ["id", "nombre", "fechaIngreso", "salario", "createdAt", "updatedAt"],
  properties: {
    id: { type: "integer" },
    nombre: { type: "string" },
    fechaIngreso: { type: "string", format: "date" },
    salario: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

export const createEmpleadoBodySchema = {
  $id: "CreateEmpleadoBody",
  type: "object",
  required: ["nombre", "fechaIngreso", "salario"],
  additionalProperties: false,
  properties: {
    nombre: { type: "string", minLength: 1, maxLength: 200 },
    fechaIngreso: { type: "string", format: "date" },
    salario: { type: "number", minimum: 0 },
  },
} as const;

export const updateEmpleadoBodySchema = {
  ...createEmpleadoBodySchema,
  $id: "UpdateEmpleadoBody",
} as const;

export const empleadoIdParamsSchema = {
  $id: "EmpleadoIdParams",
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "integer", minimum: 1 },
  },
} as const;

export interface CreateEmpleadoBody {
  nombre: string;
  fechaIngreso: string;
  salario: number;
}

export type UpdateEmpleadoBody = CreateEmpleadoBody;

export interface EmpleadoIdParams {
  id: number;
}
