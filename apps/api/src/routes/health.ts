import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        operationId: "livenessCheck",
        summary: "Liveness probe",
        description: "Always returns 200. Does not touch the database.",
        response: {
          200: { $ref: "HealthResponse#" },
        },
      },
    },
    async () => ({ status: "ok" }),
  );

  app.get(
    "/health/ready",
    {
      schema: {
        tags: ["Health"],
        operationId: "readinessCheck",
        summary: "Readiness probe",
        description: "Returns 200 when the database is reachable, 503 otherwise.",
        response: {
          200: { $ref: "HealthResponse#" },
          503: { $ref: "Problem#" },
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
