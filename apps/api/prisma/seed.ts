import path from "node:path";
import process from "node:process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// In CI .env is absent and vars come from the runner environment — swallow ENOENT.
try {
  process.loadEnvFile(path.resolve(import.meta.dirname, "..", "..", "..", ".env"));
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const estados = [
  { nombre: "pendiente", categoria: "activa", cambiosPermitidos: "en-progreso,finalizada" },
  { nombre: "en-progreso", categoria: "activa", cambiosPermitidos: "finalizada" },
  { nombre: "finalizada", categoria: "cerrada", cambiosPermitidos: null },
];

async function main() {
  for (const estado of estados) {
    await prisma.estado.upsert({
      where: { nombre: estado.nombre },
      create: estado,
      update: estado,
    });
  }
  const total = await prisma.estado.count();
  console.log(`seed: estado catalogue synced (${total} rows total)`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
