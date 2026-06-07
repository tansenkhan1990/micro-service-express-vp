import { Request } from "express";

/**
 * Extend Express Request interface to include userId added by auth middleware.
 * This is separated from the middleware to avoid circular dependencies
 * and to make the type available project-wide.
 */
export interface AuthRequest extends Request {
  userId?: string;
}
