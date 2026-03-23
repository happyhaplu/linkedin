# Reach — LinkedIn Automation Platform

Full-stack LinkedIn automation & outreach platform built with **Go** (Fiber) + **Vue 3** (Vite).

## Stack

| Layer | Technology |
|---|---|
| **Backend** | Go 1.22, Fiber v2, GORM, PostgreSQL |
| **Frontend** | Vue 3.5, Vite 8, Pinia, TailwindCSS 4 |
| **Queue** | Postgres-backed job queue (FOR UPDATE SKIP LOCKED) |
| **Automation** | Playwright-Go (headless Chromium) |
| **Auth** | External — [accounts.gour.io](https://accounts.gour.io) (JWT HS256) |

## Modules

- **LinkedIn Accounts** — Multi-account management, cookie auth, health monitoring
- **Campaigns** — Sequence builder, connection + message automation, A/B testing
- **Leads** — CSV import, lists, custom fields, enrichment
- **My Network** — Connections, requests, sync
- **Unibox** — Unified inbox across all accounts
- **Analytics** — Funnel, daily activity, per-campaign stats
- **Proxies** — HTTP/SOCKS proxy management per account

## Development

```bash
# Prerequisites: Go 1.22+, Node 20+, PostgreSQL 16+

# 1. Clone
git clone https://github.com/happyhaplu/linkedin.git reach
cd reach

# 2. Backend
cp backend/.env.example backend/.env   # edit with your values
cd backend && go mod tidy && cd ..

# 3. Frontend
cd frontend && npm install && cd ..

# 4. Run both
make dev
# → Backend on http://localhost:4000
# → Frontend on http://localhost:3000 (proxies /api → :4000)
```

## Deployment (Coolify / Docker Compose)

### Quick Deploy on Coolify

1. **Add new service** → Docker Compose
2. **Connect your GitHub repo** (`happyhaplu/linkedin`)
3. **Set environment variables** in Coolify UI (see `.env.example`):

| Variable | Required | Example |
|---|---|---|
| `POSTGRES_PASSWORD` | ✅ | Strong random password |
| `JWT_SECRET` | ✅ | 64-char random string |
| `ACCOUNTS_URL` | ✅ | `https://accounts.gour.io` |
| `APP_URL` | ✅ | `https://reach.yourdomain.com` |
| `FRONTEND_URL` | ✅ | `https://reach.yourdomain.com` |
| `COOKIE_SECURE` | ✅ | `true` (production) |

4. **Deploy** — Coolify builds the multi-stage Docker image automatically.

### Manual Docker Compose

```bash
cp .env.example .env
# Edit .env with production values

docker-compose up -d
# → App on http://localhost:4000 (serves both API + frontend SPA)
# → PostgreSQL on internal network
```

### Architecture

```
┌────────────────────────────────────────────┐
│           Docker Compose                    │
│                                            │
│  ┌─────────────────────────────────────┐   │
│  │  app (Go + Vue SPA)                 │   │
│  │  :4000                              │   │
│  │  ├── /api/*    → Go handlers        │   │
│  │  ├── /auth/*   → Go auth handlers   │   │
│  │  ├── /health   → healthcheck        │   │
│  │  └── /*        → Vue SPA (static)   │   │
│  └────────────┬────────────────────────┘   │
│               │                            │
│  ┌────────────▼────────────────────────┐   │
│  │  postgres (PostgreSQL 16)           │   │
│  │  :5432 (internal only)              │   │
│  │  Volume: pgdata                     │   │
│  └─────────────────────────────────────┘   │
└────────────────────────────────────────────┘
```

The Docker image is a **3-stage build**:
1. **Node** — builds Vue SPA → `dist/`
2. **Go** — compiles backend binary
3. **Alpine** — minimal runtime with binary + static files (~30MB)

## Project Structure

```
reach/
├── backend/                  # Go backend
│   ├── cmd/server/           # Entrypoint
│   ├── internal/
│   │   ├── automation/       # Playwright browser automation
│   │   ├── config/           # Environment config
│   │   ├── database/         # GORM connection + AutoMigrate
│   │   ├── handler/          # HTTP handlers (Fiber)
│   │   ├── middleware/       # Auth, logging, CORS
│   │   ├── models/           # GORM models (19 tables)
│   │   ├── queue/            # Postgres-backed job queue
│   │   ├── repository/       # Data access layer
│   │   ├── router/           # Route registration
│   │   ├── service/          # Business logic
│   │   └── workers/          # Background workers
│   ├── go.mod
│   └── go.sum
├── frontend/                 # Vue 3 SPA
│   ├── src/
│   │   ├── components/       # Shared UI components
│   │   ├── views/            # Page views
│   │   ├── stores/           # Pinia state stores
│   │   ├── composables/      # Vue composables
│   │   ├── router/           # Vue Router
│   │   └── services/         # API client (Axios)
│   ├── package.json
│   └── vite.config.ts
├── Dockerfile                # Multi-stage production build
├── docker-compose.yml        # Coolify-ready compose
├── .env.example              # Environment template
├── Makefile                  # Dev commands
└── README.md
```

## License

Private — All rights reserved.
