import crypto from "crypto";
import jwt from "jsonwebtoken";
import { getRedis } from "../config/redis";
import { wrapRedisError } from "./redisErrors";

interface TokenPayload {
  userId: string;
  jti: string;
}

// Module-level secrets — set by initTokens() after dotenv.config() has loaded .env
let ACCESS_TOKEN_SECRET: string;
let REFRESH_TOKEN_SECRET: string;

const getTokenTTL = (token: string): number => {
  const decoded = jwt.decode(token) as { exp: number } | null;
  if (!decoded?.exp) {
    throw new Error("Failed to decode token expiration");
  }

  const ttl = decoded.exp - Math.floor(Date.now() / 1000);
  if (ttl <= 0) {
    throw new Error("Token already expired");
  }

  return ttl;
};

const refreshKey = (jti: string): string => `refresh:${jti}`;

/**
 * Initialize token secrets from environment variables.
 * Must be called after dotenv.config() has loaded the .env file.
 */
export const initTokens = (): void => {
  const accessSecret = process.env.ACCESS_TOKEN_SECRET;
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET;

  if (!accessSecret) {
    throw new Error("Missing required environment variable: ACCESS_TOKEN_SECRET");
  }
  if (!refreshSecret) {
    throw new Error("Missing required environment variable: REFRESH_TOKEN_SECRET");
  }

  ACCESS_TOKEN_SECRET = accessSecret;
  REFRESH_TOKEN_SECRET = refreshSecret;
};

// Generate a short-lived access token with a unique jti for blacklist support
export const generateAccessToken = (userId: string): string => {
  const expiresIn = process.env.ACCESS_TOKEN_EXPIRY || "15m";

  return jwt.sign({ userId, jti: crypto.randomUUID() }, ACCESS_TOKEN_SECRET, {
    expiresIn,
  } as jwt.SignOptions);
};

// Generate a long-lived refresh token and persist it in Redis keyed by jti
export const generateRefreshToken = async (userId: string): Promise<string> => {
  const expiresIn = process.env.REFRESH_TOKEN_EXPIRY || "7d";
  const jti = crypto.randomUUID();

  const token = jwt.sign({ userId, jti }, REFRESH_TOKEN_SECRET, {
    expiresIn,
  } as jwt.SignOptions);

  const ttl = getTokenTTL(token);

  try {
    await getRedis().set(refreshKey(jti), userId, "EX", ttl);
  } catch (error) {
    wrapRedisError(error);
  }

  return token;
};

// Verify access token and return the payload
export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as TokenPayload;
};

// Check if an access token has been revoked (e.g. on logout)
export const isAccessTokenBlacklisted = async (jti: string): Promise<boolean> => {
  try {
    const result = await getRedis().get(`blacklist:access:${jti}`);
    return result !== null;
  } catch (error) {
    return wrapRedisError(error);
  }
};

// Revoke an access token immediately by blacklisting its jti until natural expiry
export const blacklistAccessToken = async (token: string): Promise<void> => {
  let payload: TokenPayload & { exp: number };

  try {
    payload = jwt.verify(token, ACCESS_TOKEN_SECRET) as TokenPayload & { exp: number };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
      return;
    }
    throw error;
  }

  const ttl = payload.exp - Math.floor(Date.now() / 1000);
  if (ttl <= 0) return;

  try {
    await getRedis().set(`blacklist:access:${payload.jti}`, "1", "EX", ttl);
  } catch (error) {
    wrapRedisError(error);
  }
};

// Atomically consume a refresh token (one-time use) to prevent rotation races
export const consumeRefreshToken = async (token: string): Promise<TokenPayload | null> => {
  let payload: TokenPayload;

  try {
    payload = jwt.verify(token, REFRESH_TOKEN_SECRET) as TokenPayload;
  } catch {
    return null;
  }

  try {
    const userId = await getRedis().getdel(refreshKey(payload.jti));
    if (!userId || userId !== payload.userId) return null;
    return payload;
  } catch (error) {
    return wrapRedisError(error);
  }
};

// Remove refresh token from Redis (used during logout)
export const revokeRefreshToken = async (token: string): Promise<void> => {
  let payload: TokenPayload;

  try {
    payload = jwt.verify(token, REFRESH_TOKEN_SECRET) as TokenPayload;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return;
    }
    throw error;
  }

  try {
    await getRedis().del(refreshKey(payload.jti));
  } catch (error) {
    wrapRedisError(error);
  }
};
