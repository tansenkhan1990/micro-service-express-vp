import { Request, Response } from "express";
import { createProxyMiddleware, Options } from "http-proxy-middleware";
import { AuthRequest } from "@microservices/shared";

const proxyOptions = (target: string): Options => ({
  target,
  changeOrigin: true,
  cookieDomainRewrite: "",
});

export const authServiceProxy = createProxyMiddleware(
  proxyOptions(process.env.AUTH_SERVICE_URL || "http://localhost:3001")
);

export const userServiceProxy = createProxyMiddleware({
  ...proxyOptions(process.env.USER_SERVICE_URL || "http://localhost:3002"),
  on: {
    proxyReq: (proxyReq, req) => {
      const userId = (req as AuthRequest).userId;
      if (userId) {
        proxyReq.setHeader("x-user-id", userId);
      }
    },
  },
});

export const checkDownstreamHealth = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(`${url}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
};

export const gatewayHealth = async (_req: Request, res: Response): Promise<void> => {
  const authUrl = process.env.AUTH_SERVICE_URL || "http://localhost:3001";
  const userUrl = process.env.USER_SERVICE_URL || "http://localhost:3002";
  const redisOk = await import("../config/redis").then((m) => m.pingRedis());

  const [authOk, userOk] = await Promise.all([
    checkDownstreamHealth(authUrl),
    checkDownstreamHealth(userUrl),
  ]);

  const healthy = redisOk && authOk && userOk;

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    service: "api-gateway",
    message: healthy ? "All services are running" : "One or more services are unavailable",
    timestamp: new Date().toISOString(),
    services: {
      redis: redisOk ? "up" : "down",
      authService: authOk ? "up" : "down",
      userService: userOk ? "up" : "down",
    },
  });
};
