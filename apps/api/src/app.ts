import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import { config } from "./config/env.js";
import { sessionMiddleware } from "./auth/session.js";
import { authRouter } from "./auth/routes.js";
import { kitsRouter } from "./kits/routes.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.FRONTEND_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(sessionMiddleware);

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/auth", authRouter);
  app.use("/kits", kitsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "No such route" } });
  });

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    // Last-resort handler: every route above is expected to catch its own
    // errors and return a structured response (Section 13), so reaching
    // here means something unexpected slipped through.
    console.error(err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
  };
  app.use(errorHandler);

  return app;
}
