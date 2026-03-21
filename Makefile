.PHONY: dev build run tidy clean

# Development — build and run with live .env
dev: build run

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
