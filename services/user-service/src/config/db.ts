import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    throw new Error("MONGO_URI is not defined in environment variables");
  }

  mongoose.connection.on("connected", () => {
    console.log("✅ [user-service] MongoDB connected");
  });

  mongoose.connection.on("error", (err) => {
    console.error("❌ [user-service] MongoDB error:", err.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("⚠️  [user-service] MongoDB disconnected");
  });

  await mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
  });
};

export default connectDB;
