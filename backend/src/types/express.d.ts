import type { AuthPrincipal } from "../lib/jwt";

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth / optionalAuth. Never trust role data from the client body. */
      auth?: AuthPrincipal;
      /** Populated by the validate() middleware with zod-parsed values. */
      validated: {
        body: unknown;
        query: unknown;
        params: unknown;
      };
    }
  }
}

export {};
