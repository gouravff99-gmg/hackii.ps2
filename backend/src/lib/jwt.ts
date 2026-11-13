import jwt from "jsonwebtoken";
import type { Role } from "@ps02/shared";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

/** Claims we issue. `driverId` is present for DRIVER accounts only. */
export interface TokenPayload {
  sub: string;
  role: Role;
  driverId?: string;
}

/** The authenticated principal attached to a request after token verification. */
export type AuthPrincipal = TokenPayload;

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): TokenPayload {
  let decoded: string | jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch {
    throw ApiError.unauthorized("Session expired or token is invalid");
  }

  if (typeof decoded === "string" || !decoded.sub || !decoded.role) {
    throw ApiError.unauthorized("Token is missing required claims");
  }

  return {
    sub: String(decoded.sub),
    role: decoded.role as Role,
    driverId: typeof decoded.driverId === "string" ? decoded.driverId : undefined,
  };
}

/** Extract a bearer token from an Authorization header or a socket handshake. */
export function readBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (!value || scheme.toLowerCase() !== "bearer") return null;
  return value;
}
