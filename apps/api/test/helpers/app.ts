import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";

export async function createTestApp(): Promise<FastifyInstance> {
  return buildApp({ logger: false });
}

export async function resetDb(app: FastifyInstance): Promise<void> {
  await app.prisma.tarea.deleteMany();
  await app.prisma.empleado.deleteMany();
  // Keep estado catalogue (seeded).
}
