import type { RequestHandler } from "express";
import { z } from "zod";
import { ApiError } from "../utils/ApiError";

export type ValidatedBody<T extends z.ZodTypeAny> = z.infer<T>;

/**
 * Parse and validate request input with zod. Parsed values are stored on
 * `req.validated` (never mutating `req.query`, which is a read-only getter in
 * Express). Controllers read from there with full type safety.
 */
export function validate(schemas: {
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
}): RequestHandler {
  return (req, _res, next) => {
    const parsed = { body: req.body, query: req.query, params: req.params } as Record<
      string,
      unknown
    >;

    for (const source of ["body", "query", "params"] as const) {
      const schema = schemas[source];
      if (!schema) continue;
      const result = schema.safeParse(parsed[source]);
      if (!result.success) {
        next(ApiError.badRequest(`Invalid ${source}`, result.error.flatten()));
        return;
      }
      parsed[source] = result.data;
    }

    req.validated = {
      body: parsed.body,
      query: parsed.query,
      params: parsed.params,
    };
    next();
  };
}

export { z };
