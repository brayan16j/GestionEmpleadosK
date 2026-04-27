import type { paths as Paths, components as Components } from "./generated.js";

export type { paths, components } from "./generated.js";

/** Resolves a named component schema from the OpenAPI contract. */
export type Schema<K extends keyof Components["schemas"]> = Components["schemas"][K];

type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "head" | "options";

/** Resolves the JSON request body type for a given path + method. */
export type RequestBody<
  P extends keyof Paths,
  M extends keyof Paths[P] & HttpMethod,
> = Paths[P][M] extends { requestBody: { content: { "application/json": infer B } } } ? B : never;

type SuccessStatus = 200 | 201 | 202 | 203 | 204;

/** Resolves the JSON response body type for a given path + method + status. */
export type ResponseBody<
  P extends keyof Paths,
  M extends keyof Paths[P] & HttpMethod,
  S extends SuccessStatus = 200,
> = Paths[P][M] extends {
  responses: { [K in S]: { content: { "application/json": infer B } } };
}
  ? B
  : never;
