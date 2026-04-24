export const tareaSchema = {
  $id: "Tarea",
  type: "object",
  required: [
    "id",
    "nombre",
    "fechaCreacion",
    "fechaInicioTarea",
    "fechaFinalizacion",
    "idEmpleado",
    "idEstado",
  ],
  properties: {
    id: { type: "integer" },
    nombre: { type: "string" },
    fechaCreacion: { type: "string", format: "date" },
    fechaInicioTarea: { type: "string", format: "date" },
    fechaFinalizacion: { type: "string", format: "date" },
    idEmpleado: { type: "integer" },
    idEstado: { type: "integer" },
    empleadoNombre: { type: "string" },
    estadoNombre: { type: "string" },
  },
} as const;

export const createTareaBodySchema = {
  $id: "CreateTareaBody",
  type: "object",
  required: ["nombre", "fechaCreacion", "fechaInicioTarea", "fechaFinalizacion", "idEmpleado"],
  additionalProperties: false,
  properties: {
    nombre: { type: "string", minLength: 1, maxLength: 200 },
    fechaCreacion: { type: "string", format: "date" },
    fechaInicioTarea: { type: "string", format: "date" },
    fechaFinalizacion: { type: "string", format: "date" },
    idEmpleado: { type: "integer", minimum: 1 },
    estadoNombre: { type: "string", minLength: 1, maxLength: 100 },
  },
} as const;

export const updateTareaBodySchema = {
  $id: "UpdateTareaBody",
  type: "object",
  required: ["nombre", "fechaCreacion", "fechaInicioTarea", "fechaFinalizacion", "idEmpleado"],
  additionalProperties: false,
  properties: {
    nombre: { type: "string", minLength: 1, maxLength: 200 },
    fechaCreacion: { type: "string", format: "date" },
    fechaInicioTarea: { type: "string", format: "date" },
    fechaFinalizacion: { type: "string", format: "date" },
    idEmpleado: { type: "integer", minimum: 1 },
  },
} as const;

export const cambiarEstadoBodySchema = {
  $id: "CambiarEstadoBody",
  type: "object",
  required: ["idEstado"],
  additionalProperties: false,
  properties: {
    idEstado: { type: "integer", minimum: 1 },
  },
} as const;

export const tareaIdParamsSchema = {
  $id: "TareaIdParams",
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "integer", minimum: 1 },
  },
} as const;

export const categoriaParamsSchema = {
  $id: "CategoriaParams",
  type: "object",
  required: ["categoria"],
  properties: {
    categoria: { type: "string", minLength: 1, maxLength: 100 },
  },
} as const;

export interface CreateTareaBody {
  nombre: string;
  fechaCreacion: string;
  fechaInicioTarea: string;
  fechaFinalizacion: string;
  idEmpleado: number;
  estadoNombre?: string;
}

export interface UpdateTareaBody {
  nombre: string;
  fechaCreacion: string;
  fechaInicioTarea: string;
  fechaFinalizacion: string;
  idEmpleado: number;
}

export interface CambiarEstadoBody {
  idEstado: number;
}

export interface TareaIdParams {
  id: number;
}

export interface CategoriaParams {
  categoria: string;
}
