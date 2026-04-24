export const healthResponseSchema = {
  $id: "HealthResponse",
  type: "object",
  required: ["status"],
  properties: {
    status: { type: "string" },
  },
} as const;
