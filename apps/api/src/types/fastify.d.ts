import type { PrismaClient } from "@prisma/client";
import type { Env } from "../config/env.js";

declare module "fastify" {
  interface FastifyInstance {
    config: Env;
    prisma: PrismaClient;
  }
}
