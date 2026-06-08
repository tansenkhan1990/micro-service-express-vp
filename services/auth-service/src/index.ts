import "express-async-errors";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import morgan from "morgan";
import compression from "compression";
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "./config/db";
import connectRedis, { getRedis, pingRedis, disconnectRedis } from "./config/redis";
import { initTokens } from "./utils/tokens";
import authRoutes from "./routes/auth";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/api/health", async (_req, res) => {
  const mongoOk = mongoose.connection.readyState === 1;
  const redisOk = await pingRedis();
  const healthy = mongoOk && redisOk;

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    service: "auth-service",
    message: healthy ? "Auth service is running" : "One or more dependencies are unavailable",
    timestamp: new Date().toISOString(),
    services: {
      mongodb: mongoOk ? "up" : "down",
      redis: redisOk ? "up" : "down",
    },
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[auth-service] Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
});

const start = async () => {
  try {
    initTokens();
    await connectDB();
    await connectRedis();

    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      store: new RedisStore({
        sendCommand: (command: string, ...args: string[]) =>
          getRedis().call(command, ...args) as Promise<number>,
      }),
      message: {
        success: false,
        message: "Too many requests. Please try again later.",
      },
    });

    app.use("/api/auth", authLimiter);
    app.use("/api/auth", authRoutes);

    const server = app.listen(PORT, () => {
      console.log(`🔐 [auth-service] running on http://localhost:${PORT}`);
    });

    const gracefulShutdown = async (signal: string) => {
      console.log(`\n[auth-service] ${signal} received. Shutting down...`);
      server.close(async () => {
        await disconnectRedis();
        await mongoose.connection.close();
        process.exit(0);
      });

      setTimeout(() => process.exit(1), 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    console.error("[auth-service] Failed to start:", error);
    process.exit(1);
  }
};

start();
