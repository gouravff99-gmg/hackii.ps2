import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { driversRouter } from "./routes/drivers";
import { geocodingRouter } from "./routes/geocoding";
import { healthRouter } from "./routes/health";
import { ridesRouter } from "./routes/rides";

/** Builds the Express app (no listening) so tests can start it on any port. */
export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  app.use(cors({ origin: env.webOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/drivers", driversRouter);
  app.use("/api/geocoding", geocodingRouter);
  app.use("/api/rides", ridesRouter);
  app.use("/api/admin", adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
