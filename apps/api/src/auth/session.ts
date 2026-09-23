import session from "express-session";
import MongoStore from "connect-mongo";
import type { Request, Response, NextFunction } from "express";
import { config, isProduction } from "../config/env.js";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export const sessionMiddleware = session({
  name: "aik.sid",
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  store: MongoStore.create({ mongoUrl: config.MONGODB_URI, ttl: SESSION_MAX_AGE_MS / 1000 }),
  cookie: {
    httpOnly: true,
    secure: isProduction,
    // Frontend and backend are expected to run on different origins in
    // production (Next.js + Express deployed separately), so the cookie
    // needs SameSite=None there; relaxed to Lax for local http dev.
    sameSite: isProduction ? "none" : "lax",
    maxAge: SESSION_MAX_AGE_MS,
  },
});

/** Rejects signed-out visitors and any session that's expired or otherwise
 * lost its userId, with a clean structured 401 rather than letting a route
 * handler hit `undefined` (Section 1). */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Sign in required" } });
    return;
  }
  next();
}
