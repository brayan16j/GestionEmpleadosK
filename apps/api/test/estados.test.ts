import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, resetDb } from "./helpers/app.js";

describe("estados", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(app);
  });

  afterEach(async () => {
    // Remove any test estados that were created (keep only seeded ones)
    await app.prisma.estado.deleteMany({
      where: { nombre: { notIn: ["pendiente", "en-progreso", "finalizada"] } },
    });
  });

  test("GET /estados returns seeded rows", async () => {
    const res = await app.inject({ method: "GET", url: "/estados" });
    expect(res.statusCode).toBe(200);
    const rows = res.json() as Array<{ nombre: string }>;
    const names = rows.map((r) => r.nombre);
    expect(names).toEqual(expect.arrayContaining(["pendiente", "en-progreso", "finalizada"]));
  });

  test("GET /estados/:id returns 404 for unknown id", async () => {
    const res = await app.inject({ method: "GET", url: "/estados/999999" });
    expect(res.statusCode).toBe(404);
  });

  test("POST /estados creates a new estado", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/estados",
      payload: { nombre: "cancelada", categoria: "cerrada" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ nombre: "cancelada", categoria: "cerrada" });
  });

  test("POST /estados with duplicate nombre returns 409", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/estados",
      payload: { nombre: "pendiente", categoria: "activa" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().title).toBe("Conflict");
  });

  test("PUT /estados/:id updates an existing estado", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/estados",
      payload: { nombre: "cancelada", categoria: "cerrada" },
    });
    const id = (created.json() as { id: number }).id;
    const res = await app.inject({
      method: "PUT",
      url: `/estados/${id}`,
      payload: { nombre: "cancelada", categoria: "cerrada", cambiosPermitidos: null },
    });
    expect(res.statusCode).toBe(200);
  });

  test("DELETE /estados/:id returns 204 for an unused estado", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/estados",
      payload: { nombre: "temporary", categoria: "activa" },
    });
    const id = (created.json() as { id: number }).id;
    const res = await app.inject({ method: "DELETE", url: `/estados/${id}` });
    expect(res.statusCode).toBe(204);
  });

  test("DELETE /estados/:id returns 422 when referenced by a tarea", async () => {
    const emp = await app.inject({
      method: "POST",
      url: "/empleados",
      payload: { nombre: "X", fechaIngreso: "2026-01-15", salario: 1 },
    });
    const empId = (emp.json() as { id: number }).id;
    await app.inject({
      method: "POST",
      url: "/tareas",
      payload: {
        nombre: "t1",
        fechaCreacion: "2026-04-23",
        fechaInicioTarea: "2026-04-23",
        fechaFinalizacion: "2026-04-30",
        idEmpleado: empId,
      },
    });
    const pendiente = await app.prisma.estado.findUniqueOrThrow({ where: { nombre: "pendiente" } });
    const res = await app.inject({ method: "DELETE", url: `/estados/${pendiente.id}` });
    expect(res.statusCode).toBe(422);
  });
});
