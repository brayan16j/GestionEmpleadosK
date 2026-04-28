import path from "node:path";
import process from "node:process";
import { defineConfig } from "prisma/config";

// In CI .env is absent and vars come from the runner environment — swallow ENOENT.
try {
  process.loadEnvFile(path.resolve(import.meta.dirname, "..", "..", ".env"));
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env at the repo root.");
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: databaseUrl,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
