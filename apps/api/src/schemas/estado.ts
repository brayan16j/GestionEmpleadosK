export const estadoSchema = {
  $id: "Estado",
  type: "object",
  required: ["id", "nombre", "categoria"],
  properties: {
    id: { type: "integer" },
    nombre: { type: "string" },
    categoria: { type: "string" },
    cambiosPermitidos: { type: ["string", "null"] },
  },
} as const;

export const createEstadoBodySchema = {
  $id: "CreateEstadoBody",
  type: "object",
  required: ["nombre", "categoria"],
  additionalProperties: false,
  properties: {
    nombre: { type: "string", minLength: 1, maxLength: 100 },
    categoria: { type: "string", minLength: 1, maxLength: 100 },
    cambiosPermitidos: { type: ["string", "null"] },
  },
} as const;

export const updateEstadoBodySchema = {
  ...createEstadoBodySchema,
  $id: "UpdateEstadoBody",
} as const;

export const estadoIdParamsSchema = {
  $id: "EstadoIdParams",
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "integer", minimum: 1 },
  },
} as const;

export interface CreateEstadoBody {
  nombre: string;
  categoria: string;
  cambiosPermitidos?: string | null;
}

export type UpdateEstadoBody = CreateEstadoBody;

export interface EstadoIdParams {
  id: number;
}
