import "express-async-errors";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import dotenv from "dotenv";
import connectRedis, { disconnectRedis } from "./config/redis";
import { initTokens } from "./utils/tokens";
import { authenticate } from "./middleware/auth";
import { authServiceProxy, userServiceProxy, gatewayHealth } from "./middleware/proxy";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);
app.use(compression());
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/api/health", gatewayHealth);

app.use("/api/auth", authServiceProxy);

app.use("/api/users", authenticate, userServiceProxy);

// Backward-compatible alias from the original monolith
app.use("/api/protected", authenticate, userServiceProxy);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[api-gateway] Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
});

const start = async () => {
  try {
    initTokens();
    await connectRedis();

    const server = app.listen(PORT, () => {
      console.log(`🌐 [api-gateway] running on http://localhost:${PORT}`);
      console.log(`   Auth  → ${process.env.AUTH_SERVICE_URL || "http://localhost:3001"}`);
      console.log(`   Users → ${process.env.USER_SERVICE_URL || "http://localhost:3002"}`);
    });

    const gracefulShutdown = async (signal: string) => {
      console.log(`\n[api-gateway] ${signal} received. Shutting down...`);
      server.close(async () => {
        await disconnectRedis();
        process.exit(0);
      });

      setTimeout(() => process.exit(1), 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    console.error("[api-gateway] Failed to start:", error);
    process.exit(1);
  }
};

start();
