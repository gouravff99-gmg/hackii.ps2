import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { Role } from "@ps02/shared";
import { readBearerToken, verifyToken } from "../lib/jwt";
import { ApiError } from "../utils/ApiError";

/** Require a valid bearer token. Rejects with 401 when absent/invalid. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = readBearerToken(req.headers.authorization);
  if (!token) {
    next(ApiError.unauthorized());
    return;
  }
  try {
    req.auth = verifyToken(token);
    next();
  } catch (err) {
    next(err);
  }
};

/** Attach the principal when a valid token exists, but never reject. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = readBearerToken(req.headers.authorization);
  if (token) {
    try {
      req.auth = verifyToken(token);
    } catch {
      req.auth = undefined;
    }
  }
  next();
};

/**
 * Server-side role gate. The role always comes from the signed token, never
 * from the request body, so a client cannot escalate privileges.
 */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(ApiError.unauthorized());
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(ApiError.forbidden("Your role cannot access this resource"));
      return;
    }
    next();
  };
}

/** Convenience accessor for handlers that are already behind requireAuth. */
export function currentAuth(req: Request) {
  if (!req.auth) throw ApiError.unauthorized();
  return req.auth;
}
