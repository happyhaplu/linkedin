.PHONY: dev build run tidy clean frontend backend

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
