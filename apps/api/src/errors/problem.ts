import { STATUS_CODES } from "node:http";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";

const PROBLEM_BASE = "https://employeek.local/problems";

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
  traceId: string;
  errors?: Array<{ path: string; message: string }>;
}

interface MapResult {
  problem: Problem;
  logLevel: "warn" | "error";
  logError?: unknown;
}

function mapError(err: unknown, req: FastifyRequest): MapResult {
  const instance = req.url;
  const traceId = req.id;

  if (isFastifyValidationError(err)) {
    return {
      problem: {
        type: `${PROBLEM_BASE}/validation`,
        title: "Validation failed",
        status: 400,
        detail: "One or more request fields failed validation",
        instance,
        traceId,
        errors: err.validation.map((v) => ({
          path: `${err.validationContext ?? "body"}${v.instancePath || ""}`.replace(/^\//, ""),
          message: v.message ?? "invalid",
        })),
      },
      logLevel: "warn",
    };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") {
      return {
        problem: {
          type: `${PROBLEM_BASE}/not-found`,
          title: "Not Found",
          status: 404,
          detail: "The requested record does not exist",
          instance,
          traceId,
        },
        logLevel: "warn",
      };
    }
    if (err.code === "P2002") {
      const target = (err.meta?.target as string[] | undefined)?.join(", ") ?? "unique field";
      return {
        problem: {
          type: `${PROBLEM_BASE}/conflict`,
          title: "Conflict",
          status: 409,
          detail: `A record with the same ${target} already exists`,
          instance,
          traceId,
        },
        logLevel: "warn",
      };
    }
    if (err.code === "P2003") {
      const field = (err.meta?.field_name as string | undefined) ?? "foreign key";
      return {
        problem: {
          type: `${PROBLEM_BASE}/foreign-key-violation`,
          title: "Unprocessable Entity",
          status: 422,
          detail: `Foreign key constraint failed on ${field}`,
          instance,
          traceId,
        },
        logLevel: "warn",
      };
    }
  }

  if (isHttpError(err)) {
    const title = STATUS_CODES[err.statusCode] ?? "HTTP Error";
    return {
      problem: {
        type: `${PROBLEM_BASE}/${slug(title)}`,
        title,
        status: err.statusCode,
        detail: err.statusCode >= 500 ? "An unexpected error occurred" : err.message,
        instance,
        traceId,
      },
      logLevel: err.statusCode >= 500 ? "error" : "warn",
      logError: err.statusCode >= 500 ? err : undefined,
    };
  }

  return {
    problem: {
      type: `${PROBLEM_BASE}/internal`,
      title: "Internal Server Error",
      status: 500,
      detail: "An unexpected error occurred",
      instance,
      traceId,
    },
    logLevel: "error",
    logError: err,
  };
}

export async function problemErrorHandler(
  err: FastifyError | Error,
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { problem, logLevel, logError } = mapError(err, req);

  if (logLevel === "error") {
    req.log.error({ err: logError ?? err, problem }, "request failed");
  } else {
    req.log.warn({ problem }, "request rejected");
  }

  reply.status(problem.status).type("application/problem+json").send(problem);
}

function isFastifyValidationError(err: unknown): err is FastifyError & {
  validation: Array<{ instancePath?: string; message?: string }>;
  validationContext?: string;
} {
  return (
    typeof err === "object" &&
    err !== null &&
    Array.isArray((err as { validation?: unknown }).validation)
  );
}

function isHttpError(err: unknown): err is Error & { statusCode: number } {
  return (
    typeof err === "object" &&
    err !== null &&
    typeof (err as { statusCode?: unknown }).statusCode === "number"
  );
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
