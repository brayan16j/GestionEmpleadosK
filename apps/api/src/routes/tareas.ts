import type { FastifyPluginAsync } from "fastify";
import type {
  CambiarEstadoBody,
  CategoriaParams,
  CreateTareaBody,
  TareaIdParams,
  UpdateTareaBody,
} from "../schemas/tarea.js";

type TareaWithRelations = {
  id: number;
  nombre: string;
  fechaCreacion: Date;
  fechaInicioTarea: Date;
  fechaFinalizacion: Date;
  idEmpleado: number;
  idEstado: number;
  empleado: { nombre: string };
  estado: { nombre: string };
};

function serializeTareaWithRelations(row: TareaWithRelations) {
  return {
    id: row.id,
    nombre: row.nombre,
    fechaCreacion: row.fechaCreacion.toISOString().slice(0, 10),
    fechaInicioTarea: row.fechaInicioTarea.toISOString().slice(0, 10),
    fechaFinalizacion: row.fechaFinalizacion.toISOString().slice(0, 10),
    idEmpleado: row.idEmpleado,
    idEstado: row.idEstado,
    empleadoNombre: row.empleado.nombre,
    estadoNombre: row.estado.nombre,
  };
}

export const tareasRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      schema: {
        tags: ["Tareas"],
        operationId: "listTareas",
        summary: "List all tasks",
        description:
          "Returns all tasks ordered by id ascending. Each item includes the related employee name and status name.",
        response: {
          200: { type: "array", items: { $ref: "Tarea#" } },
        },
      },
    },
    async () => {
      const rows = await app.prisma.tarea.findMany({
        include: { empleado: { select: { nombre: true } }, estado: { select: { nombre: true } } },
        orderBy: { id: "asc" },
      });
      return rows.map(serializeTareaWithRelations);
    },
  );

  app.get<{ Params: CategoriaParams }>(
    "/categoria/:categoria",
    {
      schema: {
        tags: ["Tareas"],
        operationId: "listTareasByCategoria",
        summary: "List tasks by status category",
        description:
          "Returns tasks whose related status category matches the path parameter. Uses a parameterized query (no SQL injection risk).",
        params: { $ref: "CategoriaParams#" },
        response: {
          200: { type: "array", items: { $ref: "Tarea#" } },
        },
      },
    },
    async (req) => {
      const rows = await app.prisma.tarea.findMany({
        where: { estado: { categoria: req.params.categoria } },
        include: { empleado: { select: { nombre: true } }, estado: { select: { nombre: true } } },
        orderBy: { id: "asc" },
      });
      return rows.map(serializeTareaWithRelations);
    },
  );

  app.get<{ Params: TareaIdParams }>(
    "/:id",
    {
      schema: {
        tags: ["Tareas"],
        operationId: "getTarea",
        summary: "Get a task by id",
        description:
          "Returns a single task with related employee and status names. 404 if not found.",
        params: { $ref: "TareaIdParams#" },
        response: { 200: { $ref: "Tarea#" }, 404: { $ref: "Problem#" } },
      },
    },
    async (req) => {
      const row = await app.prisma.tarea.findUnique({
        where: { id: req.params.id },
        include: { empleado: { select: { nombre: true } }, estado: { select: { nombre: true } } },
      });
      if (!row) throw app.httpErrors.notFound(`Tarea ${req.params.id} not found`);
      return serializeTareaWithRelations(row);
    },
  );

  app.post<{ Body: CreateTareaBody }>(
    "/",
    {
      schema: {
        tags: ["Tareas"],
        operationId: "createTarea",
        summary: "Create a task",
        description:
          "Creates a new task. If estadoNombre is omitted, the task defaults to 'pendiente'. 404 if the referenced employee or status does not exist.",
        body: { $ref: "CreateTareaBody#" },
        response: {
          201: { $ref: "Tarea#" },
          400: { $ref: "Problem#" },
          404: { $ref: "Problem#" },
          422: { $ref: "Problem#" },
        },
      },
    },
    async (req, reply) => {
      const estadoNombre = req.body.estadoNombre ?? "pendiente";
      const estado = await app.prisma.estado.findUnique({ where: { nombre: estadoNombre } });
      if (!estado) throw app.httpErrors.notFound(`Estado '${estadoNombre}' not found`);

      const row = await app.prisma.tarea.create({
        data: {
          nombre: req.body.nombre,
          fechaCreacion: new Date(req.body.fechaCreacion),
          fechaInicioTarea: new Date(req.body.fechaInicioTarea),
          fechaFinalizacion: new Date(req.body.fechaFinalizacion),
          idEmpleado: req.body.idEmpleado,
          idEstado: estado.id,
        },
        include: { empleado: { select: { nombre: true } }, estado: { select: { nombre: true } } },
      });
      reply.status(201);
      return serializeTareaWithRelations(row);
    },
  );

  app.put<{ Params: TareaIdParams; Body: UpdateTareaBody }>(
    "/:id",
    {
      schema: {
        tags: ["Tareas"],
        operationId: "updateTarea",
        summary: "Update a task",
        description:
          "Replaces all mutable fields of a task except status. Use PUT /:id/estado to change status. 404 if not found.",
        params: { $ref: "TareaIdParams#" },
        body: { $ref: "UpdateTareaBody#" },
        response: {
          200: { $ref: "Tarea#" },
          400: { $ref: "Problem#" },
          404: { $ref: "Problem#" },
          422: { $ref: "Problem#" },
        },
      },
    },
    async (req) => {
      const row = await app.prisma.tarea.update({
        where: { id: req.params.id },
        data: {
          nombre: req.body.nombre,
          fechaCreacion: new Date(req.body.fechaCreacion),
          fechaInicioTarea: new Date(req.body.fechaInicioTarea),
          fechaFinalizacion: new Date(req.body.fechaFinalizacion),
          idEmpleado: req.body.idEmpleado,
        },
        include: { empleado: { select: { nombre: true } }, estado: { select: { nombre: true } } },
      });
      return serializeTareaWithRelations(row);
    },
  );

  app.put<{ Params: TareaIdParams; Body: CambiarEstadoBody }>(
    "/:id/estado",
    {
      schema: {
        tags: ["Tareas"],
        operationId: "changeTareaEstado",
        summary: "Change task status",
        description:
          "Transitions the task to a new status, validated against the current status's cambiosPermitidos list. 400 if the transition is not allowed.",
        params: { $ref: "TareaIdParams#" },
        body: { $ref: "CambiarEstadoBody#" },
        response: {
          200: { $ref: "Tarea#" },
          400: { $ref: "Problem#" },
          404: { $ref: "Problem#" },
        },
      },
    },
    async (req) => {
      const tarea = await app.prisma.tarea.findUnique({
        where: { id: req.params.id },
        include: { estado: true },
      });
      if (!tarea) throw app.httpErrors.notFound(`Tarea ${req.params.id} not found`);

      const target = await app.prisma.estado.findUnique({ where: { id: req.body.idEstado } });
      if (!target) throw app.httpErrors.notFound(`Estado ${req.body.idEstado} not found`);

      const allowed = (tarea.estado.cambiosPermitidos ?? "")
        .split(",")
        .map((n) => n.trim())
        .filter((n) => n.length > 0);

      if (allowed.length === 0 || !allowed.includes(target.nombre)) {
        throw app.httpErrors.badRequest(
          `Invalid state transition: cannot move from '${tarea.estado.nombre}' to '${target.nombre}'`,
        );
      }

      const updated = await app.prisma.tarea.update({
        where: { id: req.params.id },
        data: { idEstado: target.id },
        include: { empleado: { select: { nombre: true } }, estado: { select: { nombre: true } } },
      });
      return serializeTareaWithRelations(updated);
    },
  );

  app.delete<{ Params: TareaIdParams }>(
    "/:id",
    {
      schema: {
        tags: ["Tareas"],
        operationId: "deleteTarea",
        summary: "Delete a task",
        description: "Deletes the task. 204 on success, 404 if not found.",
        params: { $ref: "TareaIdParams#" },
        response: { 204: { type: "null" }, 404: { $ref: "Problem#" } },
      },
    },
    async (req, reply) => {
      await app.prisma.tarea.delete({ where: { id: req.params.id } });
      reply.status(204).send();
    },
  );
};
