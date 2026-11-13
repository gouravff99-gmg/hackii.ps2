import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 does not catch rejected promises. Wrap every async handler so
 * failures reach the central error middleware instead of hanging the request.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

/** Parse a route param that must be a non-empty string. */
export function requiredParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing route parameter: ${name}`);
  }
  return value;
}
