import { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import {
  generateAccessToken,
  generateRefreshToken,
  consumeRefreshToken,
  revokeRefreshToken,
  blacklistAccessToken,
} from "../utils/tokens";
import { isRedisUnavailableError } from "../utils/redisErrors";

// ─── REGISTER ──────────────────────────────────
// POST /api/auth/register
// Body: { email: string, password: string }
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // req.body has already been validated by the Zod middleware in routes
    const { email, password } = req.body as { email: string; password: string };

    // Rely on MongoDB unique index instead of check-then-insert
    // to avoid race conditions with concurrent registration requests
    const user = await User.create({ email, password });

    res.status(201).json({
      success: true,
      message: "Account created successfully.",
      data: {
        userId: user._id,
        email: user.email,
      },
    });
  } catch (error: unknown) {
    // Handle duplicate key error (MongoDB E11000)
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: number }).code === 11000
    ) {
      res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
      return;
    }

    // Handle Mongoose validation errors
    if (error instanceof mongoose.Error.ValidationError) {
      const messages = Object.values(error.errors).map((e) => e.message);
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: messages,
      });
      return;
    }

    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed.",
    });
  }
};

// ─── LOGIN ─────────────────────────────────────
// POST /api/auth/login
// Body: { email: string, password: string }
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // req.body has already been validated by the Zod middleware in routes
    const { email, password } = req.body as { email: string; password: string };

    // Find user and explicitly select password field
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
      return;
    }

    const userId = user._id.toString();

    const accessToken = generateAccessToken(userId);
    const refreshToken = await generateRefreshToken(userId);

    // Set httpOnly cookies so the client doesn't need to manage tokens manually
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/api/auth", // only sent to /api/auth routes (refresh, logout)
    });

    res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        user: {
          userId: user._id,
          email: user.email,
        },
      },
    });
  } catch (error: unknown) {
    if (isRedisUnavailableError(error)) {
      console.error("Login error (Redis unavailable):", error);
      res.status(503).json({
        success: false,
        message: "Authentication service temporarily unavailable.",
      });
      return;
    }

    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed.",
    });
  }
};

// ─── REFRESH TOKEN ─────────────────────────────
// POST /api/auth/refresh
// Reads refreshToken from httpOnly cookie
export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      res.status(401).json({
        success: false,
        message: "No refresh token provided.",
      });
      return;
    }

    const payload = await consumeRefreshToken(refreshToken);
    if (!payload) {
      res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token.",
      });
      return;
    }

    // Old token was atomically consumed — issue new pair
    const newAccessToken = generateAccessToken(payload.userId);
    const newRefreshToken = await generateRefreshToken(payload.userId);

    // Rotate cookies with new tokens
    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/api/auth",
    });

    res.status(200).json({
      success: true,
      message: "Tokens refreshed successfully.",
    });
  } catch (error: unknown) {
    if (isRedisUnavailableError(error)) {
      console.error("Token refresh error (Redis unavailable):", error);
      res.status(503).json({
        success: false,
        message: "Authentication service temporarily unavailable.",
      });
      return;
    }

    console.error("Token refresh error:", error);
    res.status(500).json({
      success: false,
      message: "Token refresh failed.",
    });
  }
};

// ─── LOGOUT ────────────────────────────────────
// POST /api/auth/logout
// Reads refreshToken from httpOnly cookie, clears both cookies
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    const accessToken = req.cookies?.accessToken;

    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    if (accessToken) {
      await blacklistAccessToken(accessToken);
    }

    // Clear both cookies
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken", { path: "/api/auth" });

    res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error: unknown) {
    if (isRedisUnavailableError(error)) {
      console.error("Logout error (Redis unavailable):", error);
      res.status(503).json({
        success: false,
        message: "Authentication service temporarily unavailable.",
      });
      return;
    }

    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Logout failed.",
    });
  }
};
