import { Response, Router } from "express";
import { authenticate } from "../middleware/auth";
import { AuthRequest } from "../types/express";

const router = Router();

// All routes in this file are protected
router.use(authenticate);

// GET /api/protected/profile — get current user's profile
router.get("/profile", (req: AuthRequest, res: Response): void => {
  res.status(200).json({
    success: true,
    message: "This is a protected route.",
    data: {
      userId: req.userId,
      timestamp: new Date().toISOString(),
    },
  });
});

// GET /api/protected/dashboard — example protected resource
router.get("/dashboard", (req: AuthRequest, res: Response): void => {
  res.status(200).json({
    success: true,
    message: "Welcome to your dashboard!",
    data: {
      userId: req.userId,
      stats: {
        status: "active",
        lastLogin: new Date().toISOString(),
      },
    },
  });
});

export default router;
