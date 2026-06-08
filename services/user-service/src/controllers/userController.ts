import { Response } from "express";
import { AuthRequest } from "@microservices/shared";
import User from "../models/User";

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select("email createdAt updatedAt");

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Profile retrieved successfully.",
      data: {
        userId: user._id,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("[user-service] Profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve profile.",
    });
  }
};

export const getDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select("email createdAt");

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Welcome to your dashboard!",
      data: {
        userId: user._id,
        email: user.email,
        stats: {
          status: "active",
          memberSince: user.createdAt,
          lastLogin: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("[user-service] Dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load dashboard.",
    });
  }
};
