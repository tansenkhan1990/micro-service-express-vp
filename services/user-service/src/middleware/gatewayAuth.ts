import { Response, NextFunction } from "express";
import { AuthRequest } from "@microservices/shared";

/**
 * Trusts the API gateway to pass the authenticated user ID.
 * In production, restrict network access so only the gateway can reach this service.
 */
export const requireGatewayAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const userId = req.headers["x-user-id"];

  if (!userId || typeof userId !== "string") {
    res.status(401).json({
      success: false,
      message: "Access denied. Missing gateway authentication.",
    });
    return;
  }

  req.userId = userId;
  next();
};
