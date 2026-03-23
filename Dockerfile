# ============================================================================
# Reach — Multi-stage Docker Build
# Stage 1: Build Vue frontend
# Stage 2: Build Go backend
# Stage 3: Minimal runtime with both
# ============================================================================

# ── Stage 1: Frontend Build ─────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts

COPY frontend/ ./
RUN npm run build

# ── Stage 2: Backend Build ──────────────────────────────────────────────────
FROM golang:1.22-alpine AS backend-build

RUN apk add --no-cache git ca-certificates

WORKDIR /app/backend

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o /reach-server ./cmd/server/

# ── Stage 3: Runtime ────────────────────────────────────────────────────────
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata wget

# Create non-root user
RUN addgroup -S reach && adduser -S reach -G reach

WORKDIR /app

# Copy the Go binary
COPY --from=backend-build /reach-server ./reach-server

# Copy the built Vue SPA into /app/public
COPY --from=frontend-build /app/frontend/dist ./public

# Set SPA_DIR so the backend knows where the static files are
ENV SPA_DIR=/app/public
ENV PORT=4000

# Switch to non-root user
USER reach

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
    CMD wget -qO- http://localhost:4000/health || exit 1

ENTRYPOINT ["./reach-server"]
