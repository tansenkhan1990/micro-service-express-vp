import { Router } from "express";
import { z } from "zod";
import { validate } from "@microservices/shared";
import { register, login, refresh, logout } from "../controllers/authController";

const registerSchema = z.object({
  email: z.string().min(1, "Email is required.").email("Please provide a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

const loginSchema = z.object({
  email: z.string().min(1, "Email is required."),
  password: z.string().min(1, "Password is required."),
});

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/refresh", refresh);
router.post("/logout", logout);

export default router;
