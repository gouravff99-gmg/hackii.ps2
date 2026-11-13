import type { ErrorRequestHandler, RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

function send(res: Parameters<ErrorRequestHandler>[2], status: number, body: ErrorBody) {
  res.status(status).json(body);
}

export const notFoundHandler: RequestHandler = (req, res) => {
  send(res, 404, {
    error: {
      code: "not_found",
      message: `Route ${req.method} ${req.originalUrl} does not exist`,
    },
  });
};

/** Central error handler. Guarantees a JSON shape and never leaks stack traces. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    send(res, err.status, { error: { code: err.code, message: err.message, details: err.details } });
    return;
  }

  if (err instanceof ZodError) {
    send(res, 400, {
      error: { code: "validation_error", message: "Invalid request", details: err.flatten() },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") {
      send(res, 404, { error: { code: "not_found", message: "Record not found" } });
      return;
    }
    if (err.code === "P2002") {
      send(res, 409, {
        error: { code: "conflict", message: "A record with that value already exists" },
      });
      return;
    }
    if (err.code === "P2003") {
      send(res, 409, {
        error: { code: "conflict", message: "Related record does not exist" },
      });
      return;
    }
  }

  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P1001")
  ) {
    console.error("[db] connection error:", err.message);
    send(res, 503, {
      error: {
        code: "database_unavailable",
        message: "Database is unavailable. Check DATABASE_URL and that PostgreSQL is running.",
      },
    });
    return;
  }

  console.error("[error]", err);
  send(res, 500, {
    error: {
      code: "internal_error",
      message: env.isProduction
        ? "Internal server error"
        : err instanceof Error
          ? err.message
          : "Internal server error",
    },
  });
};
