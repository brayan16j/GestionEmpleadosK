import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, resetDb } from "./helpers/app.js";

describe("empleados", () => {
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

  async function createSampleEmpleado() {
    const res = await app.inject({
      method: "POST",
      url: "/empleados",
      payload: { nombre: "Ana", fechaIngreso: "2026-01-15", salario: 3500.5 },
    });
    return res.json() as { id: number };
  }

  test("POST /empleados creates and returns 201", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/empleados",
      payload: { nombre: "Ana", fechaIngreso: "2026-01-15", salario: 3500.5 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      id: expect.any(Number),
      nombre: "Ana",
      fechaIngreso: "2026-01-15",
      salario: "3500.50",
    });
  });

  test("POST /empleados with negative salary returns 400 problem envelope", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/empleados",
      payload: { nombre: "Ana", fechaIngreso: "2026-01-15", salario: -10 },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.status).toBe(400);
    expect(body.title).toBe("Validation failed");
    expect(body.traceId).toBeTruthy();
    expect(body.errors).toBeDefined();
  });

  test("GET /empleados lists existing rows", async () => {
    await createSampleEmpleado();
    const res = await app.inject({ method: "GET", url: "/empleados" });
    expect(res.statusCode).toBe(200);
    const rows = res.json() as unknown[];
    expect(rows.length).toBe(1);
  });

  test("GET /empleados/:id returns 404 for unknown id", async () => {
    const res = await app.inject({ method: "GET", url: "/empleados/999999" });
    expect(res.statusCode).toBe(404);
    expect(res.json().title).toBe("Not Found");
  });

  test("PUT /empleados/:id with missing field returns 400", async () => {
    const emp = await createSampleEmpleado();
    const res = await app.inject({
      method: "PUT",
      url: `/empleados/${emp.id}`,
      payload: { salario: 4000 },
    });
    expect(res.statusCode).toBe(400);
  });

  test("PUT /empleados/:id updates an existing row", async () => {
    const emp = await createSampleEmpleado();
    const res = await app.inject({
      method: "PUT",
      url: `/empleados/${emp.id}`,
      payload: { nombre: "Ana Maria", fechaIngreso: "2026-01-15", salario: 4000 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: emp.id, nombre: "Ana Maria", salario: "4000.00" });
  });

  test("DELETE /empleados/:id returns 204", async () => {
    const emp = await createSampleEmpleado();
    const res = await app.inject({ method: "DELETE", url: `/empleados/${emp.id}` });
    expect(res.statusCode).toBe(204);
  });

  test("DELETE /empleados/:id with related tareas returns 422", async () => {
    const emp = await createSampleEmpleado();
    await app.inject({
      method: "POST",
      url: "/tareas",
      payload: {
        nombre: "t1",
        fechaCreacion: "2026-04-23",
        fechaInicioTarea: "2026-04-23",
        fechaFinalizacion: "2026-04-30",
        idEmpleado: emp.id,
      },
    });
    const res = await app.inject({ method: "DELETE", url: `/empleados/${emp.id}` });
    expect(res.statusCode).toBe(422);
    expect(res.json().title).toBe("Unprocessable Entity");
  });

  test("GET /empleados/:id/tareas returns 404 for unknown empleado", async () => {
    const res = await app.inject({ method: "GET", url: "/empleados/999999/tareas" });
    expect(res.statusCode).toBe(404);
  });

  test("GET /empleados/:id/tareas returns empty array when none exist", async () => {
    const emp = await createSampleEmpleado();
    const res = await app.inject({ method: "GET", url: `/empleados/${emp.id}/tareas` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});
