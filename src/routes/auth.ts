import { Router } from "express";
import { z } from "zod";
import { register, login, refresh, logout } from "../controllers/authController";
import { validate } from "../utils/validate";

// ─── Validation Schemas ────────────────────────
const registerSchema = z.object({
  email: z.string().min(1, "Email is required.").email("Please provide a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

const loginSchema = z.object({
  email: z.string().min(1, "Email is required."),
  password: z.string().min(1, "Password is required."),
});

const router = Router();

// POST /api/auth/register
router.post("/register", validate(registerSchema), register);

// POST /api/auth/login — sets httpOnly cookies
router.post("/login", validate(loginSchema), login);

// POST /api/auth/refresh — reads refreshToken from httpOnly cookie
router.post("/refresh", refresh);

// POST /api/auth/logout — reads refreshToken from httpOnly cookie, clears cookies
router.post("/logout", logout);

export default router;
