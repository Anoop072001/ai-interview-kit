import { Router } from "express";
import { z } from "zod";
import { User } from "../models/User.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import { requireAuth } from "./session.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const authRouter = Router();

authRouter.post("/register", asyncHandler(async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.issues[0]?.message } });
    return;
  }
  const { email, password } = parsed.data;

  const existing = await User.findOne({ email });
  if (existing) {
    res.status(409).json({ error: { code: "EMAIL_TAKEN", message: "An account with this email already exists" } });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({ email, passwordHash });

  req.session.userId = user.id;
  res.status(201).json({ user: { id: user.id, email: user.email } });
}));

authRouter.post("/login", asyncHandler(async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.issues[0]?.message } });
    return;
  }
  const { email, password } = parsed.data;

  const user = await User.findOne({ email });
  const valid = user && (await verifyPassword(password, user.passwordHash));
  if (!user || !valid) {
    res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Incorrect email or password" } });
    return;
  }

  req.session.userId = user.id;
  res.json({ user: { id: user.id, email: user.email } });
}));

authRouter.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: { code: "LOGOUT_FAILED", message: "Could not end session" } });
      return;
    }
    res.clearCookie("aik.sid");
    res.status(204).end();
  });
});

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.session.userId);
    if (!user) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Sign in required" } });
      return;
    }
    res.json({ user: { id: user.id, email: user.email } });
  })
);
