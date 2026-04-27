import type { FastifyPluginAsync } from "fastify";
import type { CreateEstadoBody, EstadoIdParams, UpdateEstadoBody } from "../schemas/estado.js";

export const estadosRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      schema: {
        tags: ["Estados"],
        operationId: "listEstados",
        summary: "List all statuses",
        description: "Returns all status catalogue entries ordered by id ascending.",
        response: {
          200: { type: "array", items: { $ref: "Estado#" } },
        },
      },
    },
    async () => app.prisma.estado.findMany({ orderBy: { id: "asc" } }),
  );

  app.get<{ Params: EstadoIdParams }>(
    "/:id",
    {
      schema: {
        tags: ["Estados"],
        operationId: "getEstado",
        summary: "Get a status by id",
        description: "Returns a single status entry. 404 if not found.",
        params: { $ref: "EstadoIdParams#" },
        response: { 200: { $ref: "Estado#" }, 404: { $ref: "Problem#" } },
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
        tags: ["Estados"],
        operationId: "createEstado",
        summary: "Create a status",
        description: "Creates a new status entry. 409 if the name already exists.",
        body: { $ref: "CreateEstadoBody#" },
        response: {
          201: { $ref: "Estado#" },
          400: { $ref: "Problem#" },
          409: { $ref: "Problem#" },
        },
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
        tags: ["Estados"],
        operationId: "updateEstado",
        summary: "Update a status",
        description: "Replaces all mutable fields of a status entry. 404 if not found.",
        params: { $ref: "EstadoIdParams#" },
        body: { $ref: "UpdateEstadoBody#" },
        response: {
          200: { $ref: "Estado#" },
          400: { $ref: "Problem#" },
          404: { $ref: "Problem#" },
          409: { $ref: "Problem#" },
        },
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
        tags: ["Estados"],
        operationId: "deleteEstado",
        summary: "Delete a status",
        description:
          "Deletes the status. 204 on success, 404 if not found, 422 if referenced by any task (FK restrict).",
        params: { $ref: "EstadoIdParams#" },
        response: {
          204: { type: "null" },
          404: { $ref: "Problem#" },
          422: { $ref: "Problem#" },
        },
      },
    },
    async (req, reply) => {
      await app.prisma.estado.delete({ where: { id: req.params.id } });
      reply.status(204).send();
    },
  );
};
