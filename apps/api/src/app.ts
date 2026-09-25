import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import { config } from "./config/env.js";
import { sessionMiddleware } from "./auth/session.js";
import { authRouter } from "./auth/routes.js";
import { kitsRouter } from "./kits/routes.js";

export function createApp() {
  const app = express();

  // Render (and Vercel, one hop further out for proxied /api/* requests)
  // terminates TLS at its own edge and forwards plain HTTP internally, so
  // without this Express sees every request as insecure — express-session
  // silently refuses to send Set-Cookie at all when cookie.secure is true
  // and it can't confirm the connection is actually HTTPS (documented in
  // express-session's own README). Trusting the first hop is enough: it's
  // the proxy directly in front of this container, and it always reports
  // the true origin protocol regardless of what's further upstream.
  app.set("trust proxy", 1);

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
