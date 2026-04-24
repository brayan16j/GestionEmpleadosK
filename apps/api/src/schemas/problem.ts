export const problemSchema = {
  $id: "Problem",
  type: "object",
  required: ["type", "title", "status", "instance", "traceId"],
  properties: {
    type: { type: "string", format: "uri" },
    title: { type: "string" },
    status: { type: "integer", minimum: 100, maximum: 599 },
    detail: { type: "string" },
    instance: { type: "string" },
    traceId: { type: "string" },
    errors: {
      type: "array",
      items: {
        type: "object",
        required: ["path", "message"],
        properties: {
          path: { type: "string" },
          message: { type: "string" },
        },
      },
    },
  },
} as const;
