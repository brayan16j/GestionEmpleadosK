import type { FastifyPluginAsync } from "fastify";

import {
  createEstadoBodySchema,
  estadoIdParamsSchema,
  estadoSchema,
  updateEstadoBodySchema,
  type CreateEstadoBody,
  type EstadoIdParams,
  type UpdateEstadoBody,
} from "../schemas/estado.js";
import { problemSchema } from "../schemas/problem.js";

export const estadosRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      schema: {
        response: {
          200: { type: "array", items: estadoSchema },
        },
      },
    },
    async () => app.prisma.estado.findMany({ orderBy: { id: "asc" } }),
  );

  app.get<{ Params: EstadoIdParams }>(
    "/:id",
    {
      schema: {
        params: estadoIdParamsSchema,
        response: { 200: estadoSchema, 404: problemSchema },
      },
    },
    async (req) => {
      const row = await app.prisma.estado.findUnique({ where: { id: req.params.id } });
      if (!row) throw app.httpErrors.notFound(`Estado ${req.params.id} not found`);
      return row;
    },
  );

  app.post<{ Body: CreateEstadoBody }>(
    "/",
    {
      schema: {
        body: createEstadoBodySchema,
        response: { 201: estadoSchema, 400: problemSchema, 409: problemSchema },
      },
    },
    async (req, reply) => {
      const row = await app.prisma.estado.create({
        data: {
          nombre: req.body.nombre,
          categoria: req.body.categoria,
          cambiosPermitidos: req.body.cambiosPermitidos ?? null,
        },
      });
      reply.status(201);
      return row;
    },
  );

  app.put<{ Params: EstadoIdParams; Body: UpdateEstadoBody }>(
    "/:id",
    {
      schema: {
        params: estadoIdParamsSchema,
        body: updateEstadoBodySchema,
        response: { 200: estadoSchema, 400: problemSchema, 404: problemSchema, 409: problemSchema },
      },
    },
    async (req) => {
      return app.prisma.estado.update({
        where: { id: req.params.id },
        data: {
          nombre: req.body.nombre,
          categoria: req.body.categoria,
          cambiosPermitidos: req.body.cambiosPermitidos ?? null,
        },
      });
    },
  );

  app.delete<{ Params: EstadoIdParams }>(
    "/:id",
    {
      schema: {
        params: estadoIdParamsSchema,
        response: { 204: { type: "null" }, 404: problemSchema, 422: problemSchema },
      },
    },
    async (req, reply) => {
      await app.prisma.estado.delete({ where: { id: req.params.id } });
      reply.status(204).send();
    },
  );
};
