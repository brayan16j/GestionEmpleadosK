import { prisma } from "./db/client.js";

const name = "@employeek/api";

try {
  const estadoCount = await prisma.estado.count();
  console.log(`${name} skeleton up — estado count: ${estadoCount}`);
  console.log("ready for Fastify in change rebuild-api-fastify-ajv-errors");
} finally {
  await prisma.$disconnect();
}
