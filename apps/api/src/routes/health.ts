import type { FastifyPluginAsync } from "fastify";

import { healthResponseSchema } from "../schemas/health.js";
import { problemSchema } from "../schemas/problem.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/health",
    {
      schema: {
        response: {
          200: healthResponseSchema,
        },
      },
    },
    async () => ({ status: "ok" }),
  );

  app.get(
    "/health/ready",
    {
      schema: {
        response: {
          200: healthResponseSchema,
          503: problemSchema,
        },
      },
    },
    async () => {
      try {
        await app.prisma.$queryRaw`SELECT 1`;
        return { status: "ok" };
      } catch (err) {
        throw app.httpErrors.serviceUnavailable(
          err instanceof Error ? err.message : "database unreachable",
        );
      }
    },
  );
};
