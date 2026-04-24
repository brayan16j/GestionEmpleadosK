import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, resetDb } from "./helpers/app.js";

describe("tareas", () => {
  let app: FastifyInstance;
  let empleadoId: number;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(app);
    const res = await app.inject({
      method: "POST",
      url: "/empleados",
      payload: { nombre: "Test Empleado", fechaIngreso: "2026-01-15", salario: 1000 },
    });
    empleadoId = (res.json() as { id: number }).id;
  });

  async function createTarea(overrides: Record<string, unknown> = {}) {
    const res = await app.inject({
      method: "POST",
      url: "/tareas",
      payload: {
        nombre: "tarea1",
        fechaCreacion: "2026-04-23",
        fechaInicioTarea: "2026-04-23",
        fechaFinalizacion: "2026-04-30",
        idEmpleado: empleadoId,
        ...overrides,
      },
    });
    return res;
  }

  test("POST /tareas defaults initial estado to pendiente", async () => {
    const res = await createTarea();
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.estadoNombre).toBe("pendiente");
  });

  test("POST /tareas with unknown estadoNombre returns 404", async () => {
    const res = await createTarea({ estadoNombre: "no-existe" });
    expect(res.statusCode).toBe(404);
  });

  test("POST /tareas with invalid idEmpleado returns 422 (FK violation)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/tareas",
      payload: {
        nombre: "t",
        fechaCreacion: "2026-04-23",
        fechaInicioTarea: "2026-04-23",
        fechaFinalizacion: "2026-04-30",
        idEmpleado: 999999,
      },
    });
    expect(res.statusCode).toBe(422);
  });

  test("GET /tareas returns related names", async () => {
    await createTarea();
    const res = await app.inject({ method: "GET", url: "/tareas" });
    expect(res.statusCode).toBe(200);
    const rows = res.json() as Array<{ empleadoNombre: string; estadoNombre: string }>;
    expect(rows[0].empleadoNombre).toBe("Test Empleado");
    expect(rows[0].estadoNombre).toBe("pendiente");
  });

  test("GET /tareas/:id returns 404 for unknown id", async () => {
    const res = await app.inject({ method: "GET", url: "/tareas/999999" });
    expect(res.statusCode).toBe(404);
  });

  test("PUT /tareas/:id updates non-estado fields", async () => {
    const created = await createTarea();
    const id = (created.json() as { id: number }).id;
    const res = await app.inject({
      method: "PUT",
      url: `/tareas/${id}`,
      payload: {
        nombre: "renamed",
        fechaCreacion: "2026-04-23",
        fechaInicioTarea: "2026-04-23",
        fechaFinalizacion: "2026-04-30",
        idEmpleado: empleadoId,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().nombre).toBe("renamed");
  });

  test("DELETE /tareas/:id returns 204", async () => {
    const created = await createTarea();
    const id = (created.json() as { id: number }).id;
    const res = await app.inject({ method: "DELETE", url: `/tareas/${id}` });
    expect(res.statusCode).toBe(204);
  });

  test("PUT /tareas/:id/estado allows pendiente -> en-progreso", async () => {
    const created = await createTarea();
    const id = (created.json() as { id: number }).id;
    const enProgreso = await app.prisma.estado.findUniqueOrThrow({
      where: { nombre: "en-progreso" },
    });
    const res = await app.inject({
      method: "PUT",
      url: `/tareas/${id}/estado`,
      payload: { idEstado: enProgreso.id },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().estadoNombre).toBe("en-progreso");
  });

  test("PUT /tareas/:id/estado rejects finalizada -> pendiente", async () => {
    const created = await createTarea();
    const id = (created.json() as { id: number }).id;
    // pendiente -> en-progreso -> finalizada
    const enProgreso = await app.prisma.estado.findUniqueOrThrow({
      where: { nombre: "en-progreso" },
    });
    const finalizada = await app.prisma.estado.findUniqueOrThrow({
      where: { nombre: "finalizada" },
    });
    const pendiente = await app.prisma.estado.findUniqueOrThrow({
      where: { nombre: "pendiente" },
    });
    await app.inject({
      method: "PUT",
      url: `/tareas/${id}/estado`,
      payload: { idEstado: enProgreso.id },
    });
    await app.inject({
      method: "PUT",
      url: `/tareas/${id}/estado`,
      payload: { idEstado: finalizada.id },
    });
    const res = await app.inject({
      method: "PUT",
      url: `/tareas/${id}/estado`,
      payload: { idEstado: pendiente.id },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().detail).toMatch(/Invalid state transition/);
  });

  test("GET /tareas/categoria/:categoria returns matching tareas", async () => {
    await createTarea();
    const res = await app.inject({ method: "GET", url: "/tareas/categoria/activa" });
    expect(res.statusCode).toBe(200);
    const rows = res.json() as unknown[];
    expect(rows.length).toBe(1);
  });

  test("GET /tareas/categoria/:categoria is not SQL-injectable", async () => {
    await createTarea();
    const injected = encodeURIComponent("' OR 1=1 --");
    const res = await app.inject({ method: "GET", url: `/tareas/categoria/${injected}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});
