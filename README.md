# Express Auth API

A production-ready REST API built with **Express.js**, **TypeScript**, **MongoDB**, and **Redis** featuring JWT authentication via **httpOnly cookies** with automatic **token rotation** and immediate **logout revocation**.

## 🚀 Quick Start

### With Docker (recommended)

```bash
# Development — MongoDB + Redis + API with hot reload (no .env needed)
docker compose --profile dev up --build
```

Wait until you see:

```
✅ MongoDB connected successfully
✅ Redis connected successfully
🚀 Server running on http://localhost:3000
```

Open a **second terminal** to run the [test commands](#testing-the-api) below.

```bash
# Production (needs .env with real secrets)
cp .env.example .env   # edit with your secrets first
docker compose --profile prod up -d --build
```

> **Note:** `docker compose up` without a profile only starts **MongoDB and Redis** — not the API. Use `--profile dev` or `--profile prod` to start the server.

### Without Docker

```bash
cp .env.example .env   # edit with your MongoDB URI, Redis URL + secrets
docker compose up -d mongo redis   # start dependencies
npm install
npm run dev            # → http://localhost:3000
```

> **Prerequisites:** Node.js ≥ 18. MongoDB and Redis must be running (Docker command above, or install locally).

## Features

- 🔐 **Register** — `POST /api/auth/register`
- 🔑 **Login** — `POST /api/auth/login` (sets httpOnly cookies, no manual token handling)
- 🔄 **Refresh Token** — `POST /api/auth/refresh` (atomic token rotation via Redis `GETDEL`)
- 🚪 **Logout** — `POST /api/auth/logout` (clears cookies, revokes refresh token, blacklists access token)
- 🛡️ **Protected Routes** — `GET /api/protected/profile`, `GET /api/protected/dashboard`
- 🍪 **httpOnly Cookies** — Tokens stored in secure, JS-inaccessible cookies
- ✅ **Zod Validation** — Request body validation with structured error responses
- 🚦 **Distributed Rate Limiting** — Redis-backed, 20 requests per 15 min on auth routes (works across instances)
- ⚡ **Redis Token Store** — Refresh tokens stored in Redis with automatic TTL expiry
- 🚫 **Access Token Blacklist** — Logout immediately invalidates access tokens (no 15-min window)
- 📝 **HTTP Logging** — Morgan for request logging (dev/prod formats)
- 🗜️ **Compression** — Gzip response compression
- 🔒 **Security Headers** — Helmet for secure HTTP headers
- ⏱️ **Token Expiry** — Configurable JWT expiration (default: 15 min access, 7 days refresh)
- 🔄 **Token Rotation** — One-time-use refresh tokens prevent replay and race conditions
- 🏥 **Health Check** — Verifies MongoDB and Redis connectivity
- 🛑 **Graceful Shutdown** — Handles SIGTERM/SIGINT, closes MongoDB and Redis cleanly

## Architecture

```
express_rest_api_vp/
├── src/
│   ├── config/
│   │   ├── db.ts              # MongoDB connection with event handlers
│   │   └── redis.ts           # Redis client singleton (connect, ping, disconnect)
│   ├── controllers/
│   │   └── authController.ts  # Register, login, refresh, logout logic
│   ├── middleware/
│   │   └── auth.ts            # Cookie-based JWT auth + blacklist check
│   ├── models/
│   │   └── User.ts            # User schema (bcrypt password hashing)
│   ├── routes/
│   │   ├── auth.ts            # Public auth routes + Zod validation
│   │   └── private.ts         # Protected routes
│   ├── types/
│   │   └── express.ts         # Shared type declarations (AuthRequest)
│   ├── utils/
│   │   ├── tokens.ts          # JWT generation, verification, rotation, blacklist
│   │   ├── redisErrors.ts     # RedisUnavailableError + connection error detection
│   │   ├── validate.ts        # Zod validation middleware
│   │   └── AppError.ts        # Custom operational error class
│   └── index.ts               # App entry point + middleware stack
├── .env.example               # Environment variable template
├── .eslintrc.json             # ESLint config (TypeScript)
├── .prettierrc                # Prettier config
├── Dockerfile                 # Multi-stage Docker build
├── .dockerignore              # Docker build exclusions
├── docker-compose.yml         # Docker Compose (MongoDB + Redis + API)
├── package.json
├── tsconfig.json
└── README.md
```

## Prerequisites

- **Node.js** >= 18 (or **Docker**)
- **MongoDB** (local, Atlas, or Docker)
- **Redis** 6.2+ (local or Docker — required for tokens, rate limiting, and blacklist)
- **npm**

## Getting Started

### Option A: Local (Node.js)

#### 1. Install

```bash
npm install
```

#### 2. Configure Environment

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:3000

MONGO_URI=mongodb://localhost:27017/express-auth

REDIS_PASSWORD=your_redis_password_here
REDIS_URL=redis://:your_redis_password_here@localhost:6379

ACCESS_TOKEN_SECRET=your_access_token_secret_here
ACCESS_TOKEN_EXPIRY=15m

REFRESH_TOKEN_SECRET=your_refresh_token_secret_here
REFRESH_TOKEN_EXPIRY=7d
```

> Generate secure secrets:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

#### 3. Start dependencies

```bash
# Start MongoDB and Redis via Docker (run API locally)
docker compose up -d mongo redis
```

When using Docker for Redis, the default password is `changeme` (see `docker-compose.yml`). Your `.env` must match:

```env
REDIS_PASSWORD=changeme
REDIS_URL=redis://:changeme@localhost:6379
```

#### 4. Run

```bash
# Development (nodemon + ts-node, auto-restart)
npm run dev

# Production
npm run build
npm start
```

### Option B: Docker Compose

No local Node.js, MongoDB, or Redis install needed — everything runs in containers.

#### Development (hot reload)

```bash
# Start MongoDB + Redis + dev API with hot reload
# Dev secrets are auto-provided; no .env needed
docker compose --profile dev up --build

# Stop
Ctrl+C
docker compose --profile dev down
```

Changes to `src/` trigger automatic restart thanks to the mounted volume and nodemon.

#### Production

```bash
# Copy and configure environment (secrets are required)
cp .env.example .env
# Edit .env with your actual secrets

# Start MongoDB + Redis + production API
docker compose --profile prod up -d --build

# Check logs
docker compose logs -f app

# Stop
docker compose --profile prod down
```

#### Useful Commands

```bash
# Start only MongoDB and Redis (run API locally)
docker compose up -d mongo redis

# View logs for a specific service
docker compose logs -f app-dev

# Rebuild and restart
docker compose --profile dev up --build --force-recreate

# Tear down everything including volumes
docker compose --profile dev down -v
```

## Testing the API

Once the server is running, use a **second terminal** to send requests. All auth uses **httpOnly cookies** — curl saves them in `cookies.txt` automatically.

### Step-by-step

**1. Health check** — confirm MongoDB and Redis are connected:

```bash
curl http://localhost:3000/api/health
```

Expected (`200`):

```json
{
  "success": true,
  "message": "API is running",
  "services": { "mongodb": "up", "redis": "up" }
}
```

**2. Register a user:**

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secret123"}'
```

**3. Login** — saves cookies to `cookies.txt`:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@example.com","password":"secret123"}'
```

**4. Access a protected route:**

```bash
curl http://localhost:3000/api/protected/profile -b cookies.txt
```

**5. Refresh tokens:**

```bash
curl -X POST http://localhost:3000/api/auth/refresh -b cookies.txt -c cookies.txt
```

**6. Logout:**

```bash
curl -X POST http://localhost:3000/api/auth/logout -b cookies.txt -c cookies.txt
```

**7. Verify logout** — should return `401`:

```bash
curl http://localhost:3000/api/protected/profile -b cookies.txt
```

### Full flow (copy-paste)

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secret123"}'

curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@example.com","password":"secret123"}'

curl http://localhost:3000/api/protected/profile -b cookies.txt

curl -X POST http://localhost:3000/api/auth/refresh -b cookies.txt -c cookies.txt

curl -X POST http://localhost:3000/api/auth/logout -b cookies.txt -c cookies.txt

curl http://localhost:3000/api/protected/profile -b cookies.txt   # expect 401
```

### Troubleshooting

| Problem | Fix |
|---------|-----|
| `Port 3000 is already in use` | `kill $(lsof -ti :3000)` or change `PORT` in `.env` |
| `REDIS_URL is not defined` | Copy `.env.example` to `.env` and fill in values |
| Health check shows `redis: down` | `docker compose up -d redis` |
| Health check shows `mongodb: down` | `docker compose up -d mongo` |
| API not reachable, only mongo/redis running | Use `docker compose --profile dev up --build` |
| `Authentication service temporarily unavailable` (503) | Redis is down or unreachable — check `REDIS_URL` |
| Login returns 401 | Wrong email/password, or user not registered yet |

### Stop the project

```bash
# Docker dev
docker compose --profile dev down

# Docker prod
docker compose --profile prod down

# Dependencies only (local API)
docker compose down
```

## API Reference

All auth tokens are managed via **httpOnly cookies** — your client just needs to include credentials. In `fetch`, set `credentials: "include"`. In axios, set `withCredentials: true`.

### Public Routes

#### 1. Register — `POST /api/auth/register`

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "securepass123"}'
```

**Response (201):**
```json
{
  "success": true,
  "message": "Account created successfully.",
  "data": {
    "userId": "60f7b1c0a1b2c3d4e5f6a7b8",
    "email": "user@example.com"
  }
}
```

**Error (409) — duplicate email:**
```json
{
  "success": false,
  "message": "An account with this email already exists."
}
```

---

#### 2. Login — `POST /api/auth/login`

Sets `accessToken` (15 min) and `refreshToken` (7 days) as httpOnly cookies.

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email": "user@example.com", "password": "securepass123"}'
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "user": {
      "userId": "60f7b1c0a1b2c3d4e5f6a7b8",
      "email": "user@example.com"
    }
  }
}
```

The `Set-Cookie` headers will include `accessToken` and `refreshToken`.

---

#### 3. Refresh Token — `POST /api/auth/refresh`

Reads `refreshToken` from the cookie, atomically consumes it via Redis `GETDEL`, and issues a new token pair. Use `-b cookies.txt -c cookies.txt` to send and receive cookies with curl.

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -b cookies.txt -c cookies.txt
```

**Response (200):**
```json
{
  "success": true,
  "message": "Tokens refreshed successfully."
}
```

New `accessToken` and `refreshToken` cookies are set automatically.

---

#### 4. Logout — `POST /api/auth/logout`

Clears both cookies, revokes the refresh token in Redis, and blacklists the access token so it cannot be reused.

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt -c cookies.txt
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully."
}
```

---

### Protected Routes (cookie-based)

Protected routes read the `accessToken` from the httpOnly cookie automatically. No `Authorization` header needed.

#### Get Profile — `GET /api/protected/profile`

```bash
curl -X GET http://localhost:3000/api/protected/profile \
  -b cookies.txt
```

**Response (200):**
```json
{
  "success": true,
  "message": "This is a protected route.",
  "data": {
    "userId": "60f7b1c0a1b2c3d4e5f6a7b8",
    "timestamp": "2025-03-17T12:00:00.000Z"
  }
}
```

#### Get Dashboard — `GET /api/protected/dashboard`

```bash
curl -X GET http://localhost:3000/api/protected/dashboard \
  -b cookies.txt
```

---

See [Testing the API](#testing-the-api) above for the full step-by-step walkthrough.

---

### Health Check

```bash
curl http://localhost:3000/api/health
```

**Response (200) — all services healthy:**
```json
{
  "success": true,
  "message": "API is running",
  "timestamp": "2025-03-17T12:00:00.000Z",
  "services": {
    "mongodb": "up",
    "redis": "up"
  }
}
```

**Response (503) — one or more services down:**
```json
{
  "success": false,
  "message": "One or more services are unavailable",
  "timestamp": "2025-03-17T12:00:00.000Z",
  "services": {
    "mongodb": "up",
    "redis": "down"
  }
}
```

## Docker

See [Getting Started → Option B](#option-b-docker-compose) above for Docker Compose instructions.

### Image Details

- **Base:** `node:22-alpine` (~50 MB compressed)
- **Build:** Multi-stage — TypeScript compiled in builder stage, production stage has only runtime deps
- **Security:** Runs as non-root user `app` (UID 1001)
- **Health check:** `GET /api/health` every 30s

### docker-compose.yml

| Service | Description | Profile |
|---------|-------------|---------|
| `mongo` | MongoDB 7 with persistent volume | *(always)* |
| `redis` | Redis 7 with password auth and persistent volume | *(always)* |
| `app` | Production API (compiled JS) | `--profile prod` |
| `app-dev` | Development API (hot reload) | `--profile dev` |

## Authentication Flow

```
┌──────────┐           ┌──────────┐           ┌──────────┐           ┌──────────┐
│  Client  │           │  Server  │           │ MongoDB  │           │  Redis   │
└────┬─────┘           └────┬─────┘           └────┬─────┘           └────┬─────┘
     │                      │                      │                      │
     │  POST /login         │                      │                      │
     │  {email, password}   │                      │                      │
     │─────────────────────>│                      │                      │
     │                      │  Find user + verify  │                      │
     │                      │─────────────────────>│                      │
     │                      │<─────────────────────│                      │
     │                      │  SET refresh:{jti}   │                      │
     │                      │─────────────────────────────────────────────>│
     │  Set-Cookie:          │                      │                      │
     │   accessToken (httpOnly, 15min)              │                      │
     │   refreshToken (httpOnly, 7d, /api/auth)     │                      │
     │<─────────────────────│                      │                      │
     │                      │                      │                      │
     │  GET /protected/profile                      │                      │
     │  Cookie: accessToken │                      │                      │
     │─────────────────────>│                      │                      │
     │                      │  Verify JWT +        │                      │
     │                      │  check blacklist     │                      │
     │                      │─────────────────────────────────────────────>│
     │  200 OK              │                      │                      │
     │<─────────────────────│                      │                      │
     │                      │                      │                      │
     │  POST /refresh       │                      │                      │
     │  Cookie: refreshToken│                      │                      │
     │─────────────────────>│                      │                      │
     │                      │  GETDEL refresh:{jti}│                      │
     │                      │  (atomic consume)    │                      │
     │                      │─────────────────────────────────────────────>│
     │                      │  SET new refresh:{jti}                      │
     │                      │─────────────────────────────────────────────>│
     │  Set-Cookie: new tokens                     │                      │
     │<─────────────────────│                      │                      │
     │                      │                      │                      │
     │  POST /logout        │                      │                      │
     │  Cookie: both tokens │                      │                      │
     │─────────────────────>│                      │                      │
     │                      │  DEL refresh:{jti}   │                      │
     │                      │  SET blacklist:access:{jti}                 │
     │                      │─────────────────────────────────────────────>│
     │  Clear-Cookie        │                      │                      │
     │<─────────────────────│                      │                      │
```

## Redis Usage

| Key pattern | Purpose | TTL |
|-------------|---------|-----|
| `refresh:{jti}` | Active refresh token → userId | Matches refresh token expiry |
| `blacklist:access:{jti}` | Revoked access token marker | Remaining token lifetime |
| `rl:{ip}` | Rate limit counter (via rate-limit-redis) | 15 minutes |

## Cookie Details

| Cookie | httpOnly | secure | sameSite | path | maxAge |
|--------|----------|--------|----------|------|--------|
| `accessToken` | ✅ | prod only | `lax` | `/` | 15 min |
| `refreshToken` | ✅ | prod only | `lax` | `/api/auth` | 7 days |

- `secure` is enabled automatically in production (`NODE_ENV=production`)
- `refreshToken` is scoped to `/api/auth` so it's only sent on refresh/logout requests
- CORS `credentials: true` is enabled — clients must use `withCredentials`
- Both token types include a unique `jti` claim for revocation tracking

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (`development` / `production`) | `development` |
| `PORT` | Server port | `3000` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |
| `MONGO_URI` | MongoDB connection string | Required |
| `REDIS_PASSWORD` | Redis authentication password | Required (local) |
| `REDIS_URL` | Redis connection URL (include password) | Required |
| `ACCESS_TOKEN_SECRET` | Secret for signing access tokens | Required |
| `ACCESS_TOKEN_EXPIRY` | Access token lifespan | `15m` |
| `REFRESH_TOKEN_SECRET` | Secret for signing refresh tokens | Required |
| `REFRESH_TOKEN_EXPIRY` | Refresh token lifespan | `7d` |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled JS in production |
| `npm run lint` | Run ESLint on `src/` |
| `npm run format` | Format code with Prettier |

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| **Express.js** | HTTP server & routing |
| **TypeScript** | Type safety |
| **Mongoose** | MongoDB ODM |
| **ioredis** | Redis client for tokens, blacklist, and rate limiting |
| **rate-limit-redis** | Distributed rate limit store |
| **cookie-parser** | Parse httpOnly cookies |
| **helmet** | Secure HTTP headers |
| **cors** | Cross-origin requests |
| **express-rate-limit** | Rate limiting |
| **morgan** | HTTP request logging |
| **compression** | Gzip response compression |
| **zod** | Request body validation |
| **jsonwebtoken** | JWT signing & verification |
| **bcryptjs** | Password hashing |
| **dotenv** | Environment variable loading |
| **express-async-errors** | Async error handling |

## Error Handling

- **Zod validation errors** — 400 with structured field-level messages
- **Duplicate email** — 409 on registration
- **Invalid credentials** — 401 (same message for bad email or password)
- **Expired access token** — 401 with hint to use `/refresh`
- **Revoked access token** — 401 (blacklisted after logout)
- **Invalid/expired refresh token** — 401
- **Rate limit exceeded** — 429
- **Redis unavailable** — 503 on auth operations (login, refresh, logout, protected routes)
- **Unhandled errors** — 500 (safe messages in production)
