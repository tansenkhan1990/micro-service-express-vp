# ─── Build Stage ────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package files and install ALL dependencies (including devDependencies)
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy source and compile TypeScript
COPY src/ ./src/
RUN npm run build

# ─── Production Stage ────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S app && adduser -u 1001 -S app -G app

# Copy package files and install ONLY production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output from build stage
COPY --from=builder /app/dist ./dist

# Use non-root user
USER app

# Expose the app port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the app
CMD ["node", "dist/index.js"]
