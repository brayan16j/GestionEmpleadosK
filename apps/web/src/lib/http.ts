import { ApiProblem, type ProblemEnvelope } from "./problem";

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000";

export async function http<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const envelope = (await response.json()) as ProblemEnvelope;
    console.error(
      `[ApiProblem] ${envelope.status} ${envelope.title} — traceId: ${envelope.traceId}`,
    );
    throw new ApiProblem(envelope);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
