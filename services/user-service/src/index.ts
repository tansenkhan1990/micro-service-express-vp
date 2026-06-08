import "express-async-errors";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "./config/db";
import userRoutes from "./routes/users";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

app.set("trust proxy", 1);

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/api/health", (_req, res) => {
  const mongoOk = mongoose.connection.readyState === 1;

  res.status(mongoOk ? 200 : 503).json({
    success: mongoOk,
    service: "user-service",
    message: mongoOk ? "User service is running" : "MongoDB is unavailable",
    timestamp: new Date().toISOString(),
    services: {
      mongodb: mongoOk ? "up" : "down",
    },
  });
});

app.use("/api/users", userRoutes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[user-service] Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
});

const start = async () => {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`👤 [user-service] running on http://localhost:${PORT}`);
    });

    const gracefulShutdown = async (signal: string) => {
      console.log(`\n[user-service] ${signal} received. Shutting down...`);
      server.close(async () => {
        await mongoose.connection.close();
        process.exit(0);
      });

      setTimeout(() => process.exit(1), 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    console.error("[user-service] Failed to start:", error);
    process.exit(1);
  }
};

start();
