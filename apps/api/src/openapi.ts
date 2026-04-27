import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import type { FastifyInstance } from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import {
  empleadoSchema,
  createEmpleadoBodySchema,
  updateEmpleadoBodySchema,
  empleadoIdParamsSchema,
} from "./schemas/empleado.js";
import {
  estadoSchema,
  createEstadoBodySchema,
  updateEstadoBodySchema,
  estadoIdParamsSchema,
} from "./schemas/estado.js";
import {
  tareaSchema,
  createTareaBodySchema,
  updateTareaBodySchema,
  cambiarEstadoBodySchema,
  tareaIdParamsSchema,
  categoriaParamsSchema,
} from "./schemas/tarea.js";
import { healthResponseSchema } from "./schemas/health.js";
import { problemSchema } from "./schemas/problem.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8")) as {
  version: string;
};

export async function registerOpenApi(app: FastifyInstance): Promise<void> {
  // Register schemas so @fastify/swagger exposes them as components.schemas
  for (const schema of [
    healthResponseSchema,
    problemSchema,
    empleadoSchema,
    createEmpleadoBodySchema,
    updateEmpleadoBodySchema,
    empleadoIdParamsSchema,
    estadoSchema,
    createEstadoBodySchema,
    updateEstadoBodySchema,
    estadoIdParamsSchema,
    tareaSchema,
    createTareaBodySchema,
    updateTareaBodySchema,
    cambiarEstadoBodySchema,
    tareaIdParamsSchema,
    categoriaParamsSchema,
  ]) {
    app.addSchema(schema);
  }

  await app.register(fastifySwagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "EmployeeK API",
        version: pkg.version,
        description:
          "REST API for EmployeeK — employee and task management. Fastify 5 + Prisma + AJV + RFC 7807 error envelopes.",
      },
      servers: [{ url: `http://localhost:${app.config.PORT}`, description: "Local dev" }],
      tags: [
        { name: "Health", description: "Liveness and readiness checks" },
        { name: "Empleados", description: "Employee resource" },
        { name: "Estados", description: "Status catalogue" },
        { name: "Tareas", description: "Task resource" },
      ],
    },
    refResolver: {
      buildLocalReference(
        json: { $id?: string; title?: string },
        _baseUri: unknown,
        _fragment: unknown,
        i: number,
      ) {
        return (json.$id as string | undefined) ?? (json.title as string | undefined) ?? `def-${i}`;
      },
    },
  });

  if (app.config.OPENAPI_UI_ENABLED) {
    await app.register(fastifySwaggerUi, {
      routePrefix: "/docs",
      uiConfig: { docExpansion: "list", deepLinking: true },
    });
  }
}
