import path from "node:path";
import process from "node:process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

process.loadEnvFile(path.resolve(import.meta.dirname, "..", "..", "..", "..", ".env"));

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env at the repo root.");
}

declare global {
  var __prisma: PrismaClient | undefined;
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalThis.__prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
