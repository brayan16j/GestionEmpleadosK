import type { FastifyPluginAsync } from "fastify";
import type {
  CreateEmpleadoBody,
  EmpleadoIdParams,
  UpdateEmpleadoBody,
} from "../schemas/empleado.js";

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
        tags: ["Empleados"],
        operationId: "listEmpleados",
        summary: "List all employees",
        description: "Returns an array of all employees ordered by id ascending.",
        response: {
          200: { type: "array", items: { $ref: "Empleado#" } },
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
        tags: ["Empleados"],
        operationId: "getEmpleado",
        summary: "Get an employee by id",
        description: "Returns a single employee. 404 if not found.",
        params: { $ref: "EmpleadoIdParams#" },
        response: { 200: { $ref: "Empleado#" }, 404: { $ref: "Problem#" } },
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
        tags: ["Empleados"],
        operationId: "createEmpleado",
        summary: "Create an employee",
        description: "Creates and returns the new employee with status 201.",
        body: { $ref: "CreateEmpleadoBody#" },
        response: { 201: { $ref: "Empleado#" }, 400: { $ref: "Problem#" } },
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
        tags: ["Empleados"],
        operationId: "updateEmpleado",
        summary: "Update an employee",
        description: "Replaces all mutable fields of an employee. 404 if not found.",
        params: { $ref: "EmpleadoIdParams#" },
        body: { $ref: "UpdateEmpleadoBody#" },
        response: {
          200: { $ref: "Empleado#" },
          400: { $ref: "Problem#" },
          404: { $ref: "Problem#" },
        },
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
        tags: ["Empleados"],
        operationId: "deleteEmpleado",
        summary: "Delete an employee",
        description:
          "Deletes the employee. 204 on success, 404 if not found, 422 if the employee owns tasks (FK restrict).",
        params: { $ref: "EmpleadoIdParams#" },
        response: {
          204: { type: "null" },
          404: { $ref: "Problem#" },
          422: { $ref: "Problem#" },
        },
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
        tags: ["Empleados"],
        operationId: "listTareasForEmpleado",
        summary: "List tasks for an employee",
        description:
          "Returns all tasks assigned to the employee. Empty array if none. 404 if the employee does not exist.",
        params: { $ref: "EmpleadoIdParams#" },
        response: {
          200: { type: "array", items: { $ref: "Tarea#" } },
          404: { $ref: "Problem#" },
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
