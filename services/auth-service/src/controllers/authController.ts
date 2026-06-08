import { Request, Response } from "express";
import mongoose from "mongoose";
import { isRedisUnavailableError } from "@microservices/shared";
import User from "../models/User";
import {
  generateAccessToken,
  generateRefreshToken,
  consumeRefreshToken,
  revokeRefreshToken,
  blacklistAccessToken,
} from "../utils/tokens";

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email: string; password: string };

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

    if (error instanceof mongoose.Error.ValidationError) {
      const messages = Object.values(error.errors).map((e) => e.message);
      res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: messages,
      });
      return;
    }

    console.error("[auth-service] Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed.",
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email: string; password: string };

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

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/api/auth",
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
      res.status(503).json({
        success: false,
        message: "Authentication service temporarily unavailable.",
      });
      return;
    }

    console.error("[auth-service] Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed.",
    });
  }
};

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

    const newAccessToken = generateAccessToken(payload.userId);
    const newRefreshToken = await generateRefreshToken(payload.userId);

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
      res.status(503).json({
        success: false,
        message: "Authentication service temporarily unavailable.",
      });
      return;
    }

    console.error("[auth-service] Token refresh error:", error);
    res.status(500).json({
      success: false,
      message: "Token refresh failed.",
    });
  }
};

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

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken", { path: "/api/auth" });

    res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error: unknown) {
    if (isRedisUnavailableError(error)) {
      res.status(503).json({
        success: false,
        message: "Authentication service temporarily unavailable.",
      });
      return;
    }

    console.error("[auth-service] Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Logout failed.",
    });
  }
};
