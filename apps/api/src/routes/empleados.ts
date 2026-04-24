import type { FastifyPluginAsync } from "fastify";

import {
  createEmpleadoBodySchema,
  empleadoIdParamsSchema,
  empleadoSchema,
  updateEmpleadoBodySchema,
  type CreateEmpleadoBody,
  type EmpleadoIdParams,
  type UpdateEmpleadoBody,
} from "../schemas/empleado.js";
import { tareaSchema } from "../schemas/tarea.js";
import { problemSchema } from "../schemas/problem.js";

function serializeEmpleado(row: {
  id: number;
  nombre: string;
  fechaIngreso: Date;
  salario: { toFixed: (n: number) => string };
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    nombre: row.nombre,
    fechaIngreso: row.fechaIngreso.toISOString().slice(0, 10),
    salario: row.salario.toFixed(2),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const empleadosRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      schema: {
        response: {
          200: { type: "array", items: empleadoSchema },
        },
      },
    },
    async () => {
      const rows = await app.prisma.empleado.findMany({ orderBy: { id: "asc" } });
      return rows.map(serializeEmpleado);
    },
  );

  app.get<{ Params: EmpleadoIdParams }>(
    "/:id",
    {
      schema: {
        params: empleadoIdParamsSchema,
        response: { 200: empleadoSchema, 404: problemSchema },
      },
    },
    async (req) => {
      const row = await app.prisma.empleado.findUnique({ where: { id: req.params.id } });
      if (!row) throw app.httpErrors.notFound(`Empleado ${req.params.id} not found`);
      return serializeEmpleado(row);
    },
  );

  app.post<{ Body: CreateEmpleadoBody }>(
    "/",
    {
      schema: {
        body: createEmpleadoBodySchema,
        response: { 201: empleadoSchema, 400: problemSchema },
      },
    },
    async (req, reply) => {
      const row = await app.prisma.empleado.create({
        data: {
          nombre: req.body.nombre,
          fechaIngreso: new Date(req.body.fechaIngreso),
          salario: req.body.salario,
        },
      });
      reply.status(201);
      return serializeEmpleado(row);
    },
  );

  app.put<{ Params: EmpleadoIdParams; Body: UpdateEmpleadoBody }>(
    "/:id",
    {
      schema: {
        params: empleadoIdParamsSchema,
        body: updateEmpleadoBodySchema,
        response: { 200: empleadoSchema, 400: problemSchema, 404: problemSchema },
      },
    },
    async (req) => {
      const row = await app.prisma.empleado.update({
        where: { id: req.params.id },
        data: {
          nombre: req.body.nombre,
          fechaIngreso: new Date(req.body.fechaIngreso),
          salario: req.body.salario,
        },
      });
      return serializeEmpleado(row);
    },
  );

  app.delete<{ Params: EmpleadoIdParams }>(
    "/:id",
    {
      schema: {
        params: empleadoIdParamsSchema,
        response: { 204: { type: "null" }, 404: problemSchema, 422: problemSchema },
      },
    },
    async (req, reply) => {
      await app.prisma.empleado.delete({ where: { id: req.params.id } });
      reply.status(204).send();
    },
  );

  app.get<{ Params: EmpleadoIdParams }>(
    "/:id/tareas",
    {
      schema: {
        params: empleadoIdParamsSchema,
        response: {
          200: { type: "array", items: tareaSchema },
          404: problemSchema,
        },
      },
    },
    async (req) => {
      const empleado = await app.prisma.empleado.findUnique({ where: { id: req.params.id } });
      if (!empleado) throw app.httpErrors.notFound(`Empleado ${req.params.id} not found`);
      const rows = await app.prisma.tarea.findMany({
        where: { idEmpleado: req.params.id },
        include: { empleado: { select: { nombre: true } }, estado: { select: { nombre: true } } },
        orderBy: { id: "asc" },
      });
      return rows.map((t) => ({
        id: t.id,
        nombre: t.nombre,
        fechaCreacion: t.fechaCreacion.toISOString().slice(0, 10),
        fechaInicioTarea: t.fechaInicioTarea.toISOString().slice(0, 10),
        fechaFinalizacion: t.fechaFinalizacion.toISOString().slice(0, 10),
        idEmpleado: t.idEmpleado,
        idEstado: t.idEstado,
        empleadoNombre: t.empleado.nombre,
        estadoNombre: t.estado.nombre,
      }));
    },
  );
};
