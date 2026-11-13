import type { Request } from "express";
import { currentAuth } from "../middleware/auth";
import type { Viewer } from "../services/rides";

/** Build the authorization view of a request from its signed token only. */
export function viewerFrom(req: Request): Viewer {
  const auth = currentAuth(req);
  return { id: auth.sub, role: auth.role, driverId: auth.driverId };
}
