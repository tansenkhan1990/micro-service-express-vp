import Redis from "ioredis";

let redis: Redis | null = null;
let connecting: Promise<Redis> | null = null;

const createClient = (): Redis => {
  const url = process.env.REDIS_URL;

  if (!url) {
    throw new Error("REDIS_URL is not defined in environment variables");
  }

  return new Redis(url, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 10_000,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });
};

const waitForReady = (client: Redis): Promise<void> =>
  new Promise((resolve, reject) => {
    if (client.status === "ready") {
      resolve();
      return;
    }

    client.once("ready", () => resolve());
    client.once("error", (err) => reject(err));
  });

const connectRedis = async (): Promise<Redis> => {
  if (redis?.status === "ready") {
    return redis;
  }

  if (connecting) {
    return connecting;
  }

  connecting = (async () => {
    const client = createClient();

    client.on("connect", () => {
      console.log("✅ [api-gateway] Redis connected");
    });

    client.on("error", (err) => {
      console.error("❌ [api-gateway] Redis error:", err.message);
    });

    await waitForReady(client);
    redis = client;
    return client;
  })();

  try {
    return await connecting;
  } catch (error) {
    redis = null;
    throw error;
  } finally {
    connecting = null;
  }
};

export const getRedis = (): Redis => {
  if (!redis) {
    throw new Error("Redis client not initialized. Call connectRedis() first.");
  }
  return redis;
};

export const pingRedis = async (): Promise<boolean> => {
  try {
    const result = await getRedis().ping();
    return result === "PONG";
  } catch {
    return false;
  }
};

export const disconnectRedis = async (): Promise<void> => {
  if (redis) {
    await redis.quit();
    redis = null;
    console.log("[api-gateway] Redis connection closed.");
  }
  connecting = null;
};

export default connectRedis;
