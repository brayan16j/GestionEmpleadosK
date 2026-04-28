import path from "node:path";
import process from "node:process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export async function setup(): Promise<void> {
  if (!process.env.NODE_ENV) process.env.NODE_ENV = "test";

  // In CI .env is absent and vars come from the runner environment — swallow ENOENT.
  try {
    process.loadEnvFile(path.resolve(import.meta.dirname, "..", "..", "..", "..", ".env"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    const estadoCount = await prisma.estado.count();
    if (estadoCount < 3) {
      throw new Error(
        `Expected at least 3 seeded estados, found ${estadoCount}. Run \`pnpm db:migrate:deploy && pnpm db:seed\` before tests.`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

export async function teardown(): Promise<void> {
  // nothing
}
