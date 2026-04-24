import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp } from "./helpers/app.js";

describe("RFC 7807 envelope", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  test("problem envelope has all required fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/empleados",
      payload: { salario: -1 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.headers["content-type"]).toMatch(/application\/problem\+json/);
    const body = res.json();
    expect(body).toMatchObject({
      type: expect.any(String),
      title: expect.any(String),
      status: 400,
      instance: "/empleados",
      traceId: expect.any(String),
    });
  });

  test("404 returns a Not Found envelope", async () => {
    const res = await app.inject({ method: "GET", url: "/empleados/999999" });
    expect(res.statusCode).toBe(404);
    expect(res.json().title).toBe("Not Found");
  });

  test("traceId equals reqId (Fastify-generated)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/empleados",
      payload: {},
    });
    const body = res.json();
    expect(body.traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
