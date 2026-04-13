.PHONY: dev build run tidy clean frontend backend \
        test test-backend test-frontend test-e2e \
        lint lint-backend lint-frontend \
        smoke check

# Development — run both Go backend + Vue frontend simultaneously
dev:
	@echo "🚀 Starting Reach (backend + frontend)…"
	@make backend & make frontend & wait

# Run Go backend only
backend: build
	@echo "🟢 Backend → http://localhost:4000"
	cd backend && ./bin/reach-server

# Run Vue frontend only
frontend:
	@echo "🟢 Frontend → http://localhost:3000"
	cd frontend && npm run dev

# Build the Go binary
build:
	@echo "🔨 Building…"
	cd backend && go build -o bin/reach-server ./cmd/server/
	@echo "✅ Build complete → backend/bin/reach-server"

# Run the compiled binary (reads backend/.env automatically)
run:
	@echo "🚀 Starting Reach backend on :4000"
	cd backend && ./bin/reach-server

# Resolve / tidy Go modules
tidy:
	cd backend && go mod tidy

# Remove build artifacts
clean:
	rm -rf backend/bin

# ── Tests ─────────────────────────────────────────────────────────────────────

# Run ALL tests (backend unit + frontend unit)
test: test-backend test-frontend
	@echo ""
	@echo "✅ All tests passed"

# Backend: Go unit + integration + router smoke tests
test-backend:
	@echo "🧪 Backend tests (Go)…"
	cd backend && go test ./... -count=1 -timeout 60s
	@echo "✅ Backend tests passed"

# Frontend: Vitest unit + component tests
test-frontend:
	@echo "🧪 Frontend tests (Vitest)…"
	cd frontend && npm test
	@echo "✅ Frontend tests passed"

# Frontend: Vitest with coverage report
test-coverage:
	@echo "📊 Frontend test coverage…"
	cd frontend && npx vitest run --coverage

# E2E: Playwright against live servers (uses system Chrome — no install needed)
# Requires both servers to be running: make dev
test-e2e:
	@echo "🎭 E2E tests (Playwright + system Chrome)…"
	npx playwright test
	@echo "✅ E2E tests passed"

# E2E: unauth specs only (no setup dependency — faster CI check)
test-e2e-smoke:
	@echo "🎭 E2E smoke tests (unauthenticated)…"
	npx playwright test --project=unauthenticated

# Smoke test: curl-based API contract + regression tests against live servers
smoke:
	@echo "🔥 Smoke tests (live API)…"
	./scripts/smoke-test.sh

# ── Lint & Static Analysis ────────────────────────────────────────────────────

# Run ALL linters
lint: lint-backend lint-frontend
	@echo ""
	@echo "✅ All linters passed"

# Backend: go vet (built-in) + staticcheck
lint-backend:
	@echo "🔍 Backend lint (go vet + staticcheck)…"
	cd backend && go vet ./...
	cd backend && ~/go/bin/staticcheck ./...
	@echo "✅ Backend lint passed"

# Frontend: ESLint (errors only — warnings allowed)
lint-frontend:
	@echo "🔍 Frontend lint (ESLint)…"
	cd frontend && npx eslint src/ --max-warnings=50
	@echo "✅ Frontend lint passed"

# Type check: vue-tsc (TypeScript strict)
typecheck:
	@echo "🔍 TypeScript type check…"
	cd frontend && npx vue-tsc --noEmit
	@echo "✅ Type check passed"

# Full CI check: build + lint + typecheck + all tests
check: build lint typecheck test
	@echo ""
	@echo "🎉 Full CI check passed — build, lint, types, and tests all green"

