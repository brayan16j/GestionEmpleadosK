import { describe, it, expect, vi, beforeEach } from "vitest";
import { http } from "@/lib/http";
import { ApiProblem } from "@/lib/problem";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("http()", () => {
  it("resolves with JSON body on 200", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, { status: "ok" }));
    const result = await http<{ status: string }>("GET", "/health");
    expect(result).toEqual({ status: "ok" });
  });

  it("throws ApiProblem on 404 with expected fields", async () => {
    const envelope = {
      type: "https://example.com/not-found",
      title: "Not Found",
      status: 404,
      detail: "Empleado 999 not found",
      instance: "/empleados/999",
      traceId: "abc-123",
    };
    mockFetch.mockResolvedValueOnce(makeResponse(404, envelope));

    await expect(http("GET", "/empleados/999")).rejects.toSatisfy((err: unknown) => {
      if (!(err instanceof ApiProblem)) return false;
      return err.status === 404 && err.title === "Not Found" && err.traceId === "abc-123";
    });
  });

  it("throws ApiProblem with errors[] on 400", async () => {
    const envelope = {
      type: "https://example.com/validation",
      title: "Bad Request",
      status: 400,
      traceId: "def-456",
      errors: [{ path: "body/salario", message: "must be >= 0" }],
    };
    mockFetch.mockResolvedValueOnce(makeResponse(400, envelope));

    await expect(http("POST", "/empleados", { salario: -1 })).rejects.toSatisfy((err: unknown) => {
      if (!(err instanceof ApiProblem)) return false;
      return (
        err.status === 400 &&
        Array.isArray(err.errors) &&
        err.errors.length === 1 &&
        err.errors.at(0)?.path === "body/salario" &&
        err.errors.at(0)?.message === "must be >= 0"
      );
    });
  });

  it("sets Content-Type header when body is provided", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(201, { id: 1 }));
    await http("POST", "/empleados", { nombre: "Ana" });
    const call = mockFetch.mock.calls[0] as [string, RequestInit];
    const options = call[1];
    expect((options.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("does not set Content-Type header when no body", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, []));
    await http("GET", "/empleados");
    const call = mockFetch.mock.calls[0] as [string, RequestInit];
    const options = call[1];
    expect((options.headers as Record<string, string>)?.["Content-Type"]).toBeUndefined();
  });
});
