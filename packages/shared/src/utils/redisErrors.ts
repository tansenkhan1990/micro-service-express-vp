export class RedisUnavailableError extends Error {
  readonly cause?: unknown;

  constructor(message = "Redis is unavailable", cause?: unknown) {
    super(message);
    this.name = "RedisUnavailableError";
    this.cause = cause;
  }
}

export const isRedisUnavailableError = (error: unknown): error is RedisUnavailableError =>
  error instanceof RedisUnavailableError;

const CONNECTION_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EPIPE",
  "ECONNRESET",
]);

export const isRedisConnectionError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;

  if ("code" in error && CONNECTION_ERROR_CODES.has(String((error as NodeJS.ErrnoException).code))) {
    return true;
  }

  return (
    error.name === "MaxRetriesPerRequestError" ||
    error.message === "Stream isn't writeable and enableOfflineQueue is false"
  );
};

export const wrapRedisError = (error: unknown): never => {
  if (isRedisConnectionError(error)) {
    throw new RedisUnavailableError(undefined, error);
  }
  throw error;
};
