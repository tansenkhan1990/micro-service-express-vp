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
import privateRoutes from "./routes/private";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust the first proxy (Docker / reverse proxy) so rate limiting uses the real client IP
app.set("trust proxy", 1);

// ─── Middleware ─────────────────────────────────
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

// HTTP request logging (dev: colorized concise, prod: combined)
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ─── Routes (protected) ─────────────────────────
app.use("/api/protected", privateRoutes);

// ─── Global error handler ──────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);

  res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
});

// ─── Health check ──────────────────────────────
app.get("/api/health", async (_req, res) => {
  const mongoOk = mongoose.connection.readyState === 1;
  const redisOk = await pingRedis();
  const healthy = mongoOk && redisOk;

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    message: healthy ? "API is running" : "One or more services are unavailable",
    timestamp: new Date().toISOString(),
    services: {
      mongodb: mongoOk ? "up" : "down",
      redis: redisOk ? "up" : "down",
    },
  });
});

// ─── Start server ──────────────────────────────
const start = async () => {
  try {
    initTokens();

    await connectDB();
    await connectRedis();

    // Rate limiting for auth routes — backed by Redis for multi-instance support
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
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📚 Health check: http://localhost:${PORT}/api/health`);
    });

    server.on("error", async (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.error(`❌ Port ${PORT} is already in use.`);
        console.error(`   Kill it with: kill $(lsof -ti :${PORT})`);
      } else {
        console.error("❌ Server error:", err);
      }
      await disconnectRedis();
      await mongoose.connection.close();
      process.exit(1);
    });

    const gracefulShutdown = async (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await disconnectRedis();
        await mongoose.connection.close();
        console.log("MongoDB connection closed.");
        process.exit(0);
      });

      setTimeout(() => {
        console.error("Forced shutdown after timeout.");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    process.on("unhandledRejection", (reason: Error) => {
      console.error("❌ Unhandled Rejection:", reason);
      gracefulShutdown("unhandledRejection");
    });

    process.on("uncaughtException", (error: Error) => {
      console.error("❌ Uncaught Exception:", error);
      gracefulShutdown("uncaughtException");
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

start();
