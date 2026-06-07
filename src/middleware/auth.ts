import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { verifyAccessToken, isAccessTokenBlacklisted } from "../utils/tokens";
import { isRedisUnavailableError } from "../utils/redisErrors";
import { AuthRequest } from "../types/express";

// Middleware to protect routes — requires a valid access token in httpOnly cookie
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.cookies?.accessToken;

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    if (await isAccessTokenBlacklisted(payload.jti)) {
      res.status(401).json({
        success: false,
        message: "Access token has been revoked.",
      });
      return;
    }

    req.userId = payload.userId;
    next();
  } catch (error: unknown) {
    if (isRedisUnavailableError(error)) {
      console.error("Redis blacklist check failed:", error);
      res.status(503).json({
        success: false,
        message: "Authentication service temporarily unavailable.",
      });
      return;
    }

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: "Access token expired. Use /refresh to get a new one.",
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: "Invalid access token.",
      });
      return;
    }

    res.status(401).json({
      success: false,
      message: "Invalid access token.",
    });
  }
};
