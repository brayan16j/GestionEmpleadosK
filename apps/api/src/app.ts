import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import fastifyEnv from "@fastify/env";
import fastifySensible from "@fastify/sensible";
import fastifyCors from "@fastify/cors";

import { envJsonSchema } from "./config/env.js";
import { registerOpenApi } from "./openapi.js";
import { prisma } from "./db/client.js";
import { problemErrorHandler } from "./errors/problem.js";
import { empleadosRoutes } from "./routes/empleados.js";
import { estadosRoutes } from "./routes/estados.js";
import { tareasRoutes } from "./routes/tareas.js";
import { healthRoutes } from "./routes/health.js";

export interface BuildAppOptions {
  logger?: FastifyServerOptions["logger"];
}

function resolveLogger(opts: BuildAppOptions): FastifyServerOptions["logger"] {
  if (opts.logger !== undefined) return opts.logger;
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === "test") return false;
  if (nodeEnv === "production") return { level: process.env.LOG_LEVEL ?? "info" };
  return {
    level: process.env.LOG_LEVEL ?? "debug",
    transport: {
      target: "pino-pretty",
      options: { translateTime: "HH:MM:ss.l", ignore: "pid,hostname" },
    },
  };
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: resolveLogger(opts),
    genReqId: () => crypto.randomUUID(),
  });

  await app.register(fastifyEnv, {
    schema: envJsonSchema,
    dotenv: false,
    confKey: "config",
  });

  await app.register(fastifySensible);

  await app.register(fastifyCors, {
    origin: app.config.CORS_ORIGINS.split(",").map((o) => o.trim()),
    credentials: true,
  });

  await registerOpenApi(app);

  app.decorate("prisma", prisma);

  app.setErrorHandler(problemErrorHandler);

  app.addHook("onRoute", (routeOptions) => {
    const method = routeOptions.method;
    if (method === "HEAD" || method === "OPTIONS") return;
    // skip routes registered by swagger plugins
    if (routeOptions.url.startsWith("/docs")) return;

    const schema = routeOptions.schema as
      | {
          response?: Record<string, unknown>;
          operationId?: string;
        }
      | undefined;

    const hasTwoXx =
      schema?.response &&
      Object.keys(schema.response).some((code) => /^2\d\d$/.test(code) || code === "2xx");
    if (!hasTwoXx) {
      throw new Error(
        `Route ${String(method)} ${routeOptions.url} is missing a response[2xx] schema`,
      );
    }

    if (!schema?.operationId) {
      throw new Error(`Route ${String(method)} ${routeOptions.url} is missing an operationId`);
    }
  });

  await app.register(healthRoutes);
  await app.register(empleadosRoutes, { prefix: "/empleados" });
  await app.register(estadosRoutes, { prefix: "/estados" });
  await app.register(tareasRoutes, { prefix: "/tareas" });

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  return app;
}
