import jwt from "jsonwebtoken";
import { getRedis } from "../config/redis";
import { wrapRedisError } from "@microservices/shared";

interface TokenPayload {
  userId: string;
  jti: string;
}

let ACCESS_TOKEN_SECRET: string;

export const initTokens = (): void => {
  const accessSecret = process.env.ACCESS_TOKEN_SECRET;

  if (!accessSecret) {
    throw new Error("Missing required environment variable: ACCESS_TOKEN_SECRET");
  }

  ACCESS_TOKEN_SECRET = accessSecret;
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as TokenPayload;
};

export const isAccessTokenBlacklisted = async (jti: string): Promise<boolean> => {
  try {
    const result = await getRedis().get(`blacklist:access:${jti}`);
    return result !== null;
  } catch (error) {
    return wrapRedisError(error);
  }
};
