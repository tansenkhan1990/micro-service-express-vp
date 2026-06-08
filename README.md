# Microservices Express API

A microservice-ready monorepo built with **Express.js**, **TypeScript**, **MongoDB**, and **Redis**. Features JWT authentication via **httpOnly cookies**, token rotation, and an **API gateway** pattern — ready for local Docker development and deployment to **AWS EKS** via **GitHub Actions**.

## Features

- **api-gateway** — single entry point, JWT validation, request proxying
- **auth-service** — register, login, refresh, logout with httpOnly cookies
- **user-service** — protected profile and dashboard endpoints
- **Token rotation** — one-time-use refresh tokens stored in Redis
- **Access token blacklist** — immediate logout revocation
- **Rate limiting** — Redis-backed on auth routes
- **Health checks** — per-service and aggregated gateway health
- **CI/CD** — GitHub Actions build + deploy to AWS ECR/EKS

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │           api-gateway :3000          │
                    │   JWT auth · routing · health check  │
                    └──────────┬──────────────┬───────────┘
                               │              │
              /api/auth/*      │              │  /api/users/*
                               ▼              ▼
                    ┌──────────────────┐  ┌──────────────────┐
                    │  auth-service    │  │  user-service    │
                    │      :3001       │  │      :3002       │
                    │ register · login │  │ profile · dashbd  │
                    │ refresh · logout │  │                  │
                    └────────┬─────────┘  └────────┬─────────┘
                             │                     │
                             └──────────┬──────────┘
                                        ▼
                              ┌──────────────────┐
                              │  MongoDB · Redis  │
                              └──────────────────┘
```

**Request flow for protected routes:**

1. Client sends request to `api-gateway` with `accessToken` cookie
2. Gateway verifies JWT and checks Redis blacklist
3. Gateway proxies to `user-service` with `X-User-Id` header
4. User service returns profile/dashboard data

## Project Structure

```
micro-service-express-vp/
├── packages/
│   └── shared/                    # Shared types, validation, Redis errors
├── services/
│   ├── api-gateway/               # Entry point (:3000)
│   │   ├── src/
│   │   └── Dockerfile
│   ├── auth-service/              # Authentication (:3001)
│   │   ├── src/
│   │   └── Dockerfile
│   └── user-service/              # User data (:3002)
│       ├── src/
│       └── Dockerfile
├── k8s/                           # Kubernetes manifests (AWS EKS)
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.example.yaml
│   ├── auth-service/
│   ├── user-service/
│   └── api-gateway/
├── .github/workflows/
│   ├── ci.yml                     # Build on push/PR
│   └── deploy.yml                 # Build images → ECR → EKS
├── docker-compose.yml
├── .env.example
└── package.json                   # npm workspaces root
```

## Prerequisites

- **Node.js** ≥ 18 (22 recommended)
- **npm**
- **Docker** + Docker Compose (for containerized dev/prod)
- **MongoDB** and **Redis** (via Docker Compose or external)

## Quick Start (Docker — recommended)

```bash
# Clone and start all services with hot reload
docker compose --profile dev up --build
```

> `docker compose up` without `--profile dev` only starts **MongoDB and Redis** — not the API services.

Wait until you see:

```
🌐 [api-gateway] running on http://localhost:3000
🔐 [auth-service] running on http://localhost:3001
👤 [user-service] running on http://localhost:3002
```

Stop with `Ctrl+C`, then:

```bash
npm run docker:down
# or
docker compose --profile dev down
```

### Test the API

```bash
# Health check (gateway checks all downstream services)
curl http://localhost:3000/api/health

# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret123"}'

# Login (saves httpOnly cookies)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret123"}' \
  -c cookies.txt

# Protected routes (gateway validates JWT)
curl http://localhost:3000/api/users/profile -b cookies.txt
curl http://localhost:3000/api/users/dashboard -b cookies.txt

# Refresh tokens
curl -X POST http://localhost:3000/api/auth/refresh -b cookies.txt -c cookies.txt

# Logout
curl -X POST http://localhost:3000/api/auth/logout -b cookies.txt
```

## Local Development (Node.js)

Use this when you want to run services directly on your machine with hot reload.

```bash
# 1. Configure environment
cp .env.example .env

# 2. Start MongoDB + Redis
docker compose up -d mongo redis

# 3. Install dependencies (creates node_modules — do NOT commit this)
npm install

# 4. Build shared package
npm run build --workspace=@microservices/shared

# 5. Start each service in a separate terminal
npm run dev:auth      # http://localhost:3001
npm run dev:user      # http://localhost:3002
npm run dev:gateway   # http://localhost:3000  ← use this as entry point
```

### Environment Variables

Copy `.env.example` to `.env` and fill in values:

```env
PORT=3000
CORS_ORIGIN=http://localhost:3000

AUTH_SERVICE_URL=http://localhost:3001
USER_SERVICE_URL=http://localhost:3002

MONGO_URI=mongodb://localhost:27017/express-auth

REDIS_PASSWORD=changeme
REDIS_URL=redis://:changeme@localhost:6379

ACCESS_TOKEN_SECRET=your_access_token_secret_here
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_SECRET=your_refresh_token_secret_here
REFRESH_TOKEN_EXPIRY=7d
```

Generate secure JWT secrets:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

> When using Docker for Redis locally, the default password is `changeme` (see `docker-compose.yml`).

## API Routes

All client requests go through the **api-gateway** on port `3000`.

| Method | Route | Service | Auth |
|--------|-------|---------|------|
| `POST` | `/api/auth/register` | auth-service | Public |
| `POST` | `/api/auth/login` | auth-service | Public |
| `POST` | `/api/auth/refresh` | auth-service | Refresh cookie |
| `POST` | `/api/auth/logout` | auth-service | Cookies |
| `GET` | `/api/users/profile` | user-service | Access cookie (via gateway) |
| `GET` | `/api/users/dashboard` | user-service | Access cookie (via gateway) |
| `GET` | `/api/health` | all services | Public |

Individual service health endpoints (internal):

- `http://localhost:3001/api/health` — auth-service
- `http://localhost:3002/api/health` — user-service
- `http://localhost:3000/api/health` — gateway (aggregated)

## Production (Docker)

```bash
cp .env.example .env   # fill in real secrets
docker compose --profile prod up -d --build
```

## Dependencies & `node_modules`

| Location | Need `node_modules`? |
|----------|----------------------|
| Your machine (local dev) | **Yes** — run `npm install` |
| GitHub repo | **No** — never commit it (in `.gitignore`) |
| Docker / EKS | **No** — installed during image build |

Commit `package.json` and `package-lock.json`. Anyone who clones the repo runs `npm install` to recreate `node_modules`.

Build output (`dist/`) is also gitignored — run `npm run build` to generate it.

## CI/CD (GitHub Actions)

### CI (`ci.yml`)

Runs on every push/PR to `main`:

1. `npm ci`
2. Build `@microservices/shared`
3. Build all three services

### Deploy (`deploy.yml`)

Runs on push to `main` (or manual trigger):

1. Build Docker images for all 3 services
2. Push to **AWS ECR**
3. Deploy to **AWS EKS** via `kubectl`

## Deploy to AWS EKS

### 1. Create ECR repositories

```bash
aws ecr create-repository --repository-name auth-service
aws ecr create-repository --repository-name user-service
aws ecr create-repository --repository-name api-gateway
```

### 2. Add GitHub Secrets

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret |
| `AWS_REGION` | e.g. `us-east-1` |
| `ECR_REGISTRY` | `123456789012.dkr.ecr.us-east-1.amazonaws.com` |
| `EKS_CLUSTER_NAME` | Your EKS cluster name |

### 3. Create Kubernetes secrets

```bash
cp k8s/secrets.example.yaml k8s/secrets.yaml
# Edit with real JWT secrets — do NOT commit secrets.yaml
kubectl apply -f k8s/secrets.yaml
```

### 4. Deploy

Push to `main`, or trigger manually: **Actions → Deploy to AWS EKS → Run workflow**

## Scripts

| Command | Description |
|---------|-------------|
| `npm install` | Install all workspace dependencies |
| `npm run build` | Build shared package + all services |
| `npm run dev:gateway` | Start API gateway locally |
| `npm run dev:auth` | Start auth service locally |
| `npm run dev:user` | Start user service locally |
| `npm run docker:dev` | Docker Compose dev (hot reload) |
| `npm run docker:prod` | Docker Compose production |
| `npm run docker:down` | Stop all Docker services |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Container name already in use | `docker compose --profile dev down` then `docker rm -f api-gateway-dev auth-service-dev user-service-dev` |
| Port 3000 in use | `kill $(lsof -ti :3000)` or change `PORT` in `.env` |
| `REDIS_URL is not defined` | Add Redis vars to `.env` (see `.env.example`) |
| Gateway returns 503 on health | Ensure auth-service and user-service are running |
| `npm run dev:gateway` fails | Run `npm install` and `npm run build --workspace=@microservices/shared` first |

## Evolving Further

This monorepo is structured to grow into full microservices:

- **Split databases** — separate MongoDB per service
- **Message queue** — SQS/Kafka for async events (e.g. user registered → send email)
- **Service mesh** — Istio/Linkerd for mTLS between services
- **API versioning** — version routes in the gateway
- **New services** — add `services/notification-service/` following the same pattern

## License

MIT
