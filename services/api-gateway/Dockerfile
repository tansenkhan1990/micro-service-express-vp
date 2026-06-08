FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared ./packages/shared
COPY services/api-gateway ./services/api-gateway

RUN npm ci
RUN npm run build --workspace=@microservices/shared
RUN npm run build --workspace=api-gateway

FROM node:22-alpine AS production
WORKDIR /app

RUN addgroup -g 1001 -S app && adduser -u 1001 -S app -G app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY services/api-gateway/package.json ./services/api-gateway/

RUN npm ci --omit=dev --workspace=api-gateway
RUN npm cache clean --force

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/api-gateway/dist ./services/api-gateway/dist

WORKDIR /app/services/api-gateway
USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/index.js"]
