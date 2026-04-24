import type { FastifyPluginAsync } from "fastify";

import {
  cambiarEstadoBodySchema,
  categoriaParamsSchema,
  createTareaBodySchema,
  tareaIdParamsSchema,
  tareaSchema,
  updateTareaBodySchema,
  type CambiarEstadoBody,
  type CategoriaParams,
  type CreateTareaBody,
  type TareaIdParams,
  type UpdateTareaBody,
} from "../schemas/tarea.js";
import { problemSchema } from "../schemas/problem.js";

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

type TareaPlain = {
  id: number;
  nombre: string;
  fechaCreacion: Date;
  fechaInicioTarea: Date;
  fechaFinalizacion: Date;
  idEmpleado: number;
  idEstado: number;
};

function serializeTareaPlain(row: TareaPlain) {
  return {
    id: row.id,
    nombre: row.nombre,
    fechaCreacion: row.fechaCreacion.toISOString().slice(0, 10),
    fechaInicioTarea: row.fechaInicioTarea.toISOString().slice(0, 10),
    fechaFinalizacion: row.fechaFinalizacion.toISOString().slice(0, 10),
    idEmpleado: row.idEmpleado,
    idEstado: row.idEstado,
  };
}

export const tareasRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      schema: {
        response: {
          200: { type: "array", items: tareaSchema },
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
        params: categoriaParamsSchema,
        response: {
          200: { type: "array", items: tareaSchema },
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
        params: tareaIdParamsSchema,
        response: { 200: tareaSchema, 404: problemSchema },
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
        body: createTareaBodySchema,
        response: { 201: tareaSchema, 400: problemSchema, 404: problemSchema, 422: problemSchema },
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
        params: tareaIdParamsSchema,
        body: updateTareaBodySchema,
        response: { 200: tareaSchema, 400: problemSchema, 404: problemSchema, 422: problemSchema },
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
        params: tareaIdParamsSchema,
        body: cambiarEstadoBodySchema,
        response: { 200: tareaSchema, 400: problemSchema, 404: problemSchema },
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
        params: tareaIdParamsSchema,
        response: { 204: { type: "null" }, 404: problemSchema },
      },
    },
    async (req, reply) => {
      await app.prisma.tarea.delete({ where: { id: req.params.id } });
      reply.status(204).send();
    },
  );

  // Silence the unused import warning for serializeTareaPlain if linting is strict.
  void serializeTareaPlain;
};
