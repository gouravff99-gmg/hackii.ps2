import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { env } from "./config/env";
<<<<<<< HEAD
import { errorHandler, notFoundHandler } from "./middleware/error";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { driversRouter } from "./routes/drivers";
import { healthRouter } from "./routes/health";
import { ridesRouter } from "./routes/rides";
=======
import { healthRouter } from "./routes/health";
>>>>>>> 2c9d961896379c7a559888f959bc1f6d16bab32a

/** Builds the Express app (no listening) so tests can start it on any port. */
export function createApp() {
  const app = express();
<<<<<<< HEAD

  app.disable("x-powered-by");
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

=======
>>>>>>> 2c9d961896379c7a559888f959bc1f6d16bab32a
  app.use(cors({ origin: env.webOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  // All REST routes live under /api. Add new routers here.
  app.use("/api", healthRouter);
<<<<<<< HEAD
  app.use("/api/auth", authRouter);
  app.use("/api/drivers", driversRouter);
  app.use("/api/rides", ridesRouter);
  app.use("/api/admin", adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
=======

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  });
>>>>>>> 2c9d961896379c7a559888f959bc1f6d16bab32a

  return app;
}
