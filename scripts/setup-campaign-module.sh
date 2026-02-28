#!/bin/bash

# Campaign Module Setup Script
# Run this after installing dependencies

echo "🚀 Setting up Campaign Module..."
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "⚠️  .env.local not found. Creating from .env.example..."
    cp .env.example .env.local 2>/dev/null || echo "No .env.example found. Please create .env.local manually."
fi

# Check for Redis
echo "📡 Checking Redis..."
if command -v redis-cli &> /dev/null; then
    redis-cli ping &> /dev/null
    if [ $? -eq 0 ]; then
        echo "✅ Redis is running"
    else
        echo "⚠️  Redis is not running. Starting Redis..."
        redis-server --daemonize yes 2>/dev/null || echo "❌ Failed to start Redis. Install with: brew install redis (Mac) or sudo apt install redis (Linux)"
    fi
else
    echo "⚠️  Redis not found. You need Redis for the campaign queue system."
    echo "   Install options:"
    echo "   - Mac: brew install redis"
    echo "   - Linux: sudo apt install redis"
    echo "   - Docker: docker run -d -p 6379:6379 redis:alpine"
    echo ""
fi

# Add Redis URL to .env.local if not present
if ! grep -q "REDIS_URL" .env.local 2>/dev/null; then
    echo "" >> .env.local
    echo "# Campaign Module - Redis Queue" >> .env.local
    echo "REDIS_URL=redis://localhost:6379" >> .env.local
    echo "✅ Added REDIS_URL to .env.local"
fi

# Add Bull Board credentials if not present
if ! grep -q "BULL_BOARD_USER" .env.local 2>/dev/null; then
    echo "BULL_BOARD_USER=admin" >> .env.local
    echo "BULL_BOARD_PASSWORD=change-this-password" >> .env.local
    echo "✅ Added Bull Board credentials to .env.local"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Check if Playwright browsers are installed
echo ""
echo "🎭 Checking Playwright browsers..."
if [ ! -d "$HOME/.cache/ms-playwright" ]; then
    echo "Installing Playwright browsers..."
    npx playwright install chromium
else
    echo "✅ Playwright browsers installed"
fi

# Run database migrations
echo ""
echo "🗄️  Database functions..."
echo "Please run the SQL in migrations/campaign_functions.sql in your Supabase SQL Editor"
echo "This creates helper functions for atomic operations."

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Ensure Redis is running: redis-cli ping"
echo "   2. Run SQL migrations in Supabase SQL Editor"
echo "   3. Start the worker: npm run campaign-worker"
echo "   4. Start Next.js dev server: npm run dev"
echo "   5. Create a campaign and start it via API or UI"
echo ""
echo "📚 Documentation:"
echo "   - Quick Start: CAMPAIGN_QUICKSTART.md"
echo "   - Execution Plan: CAMPAIGN_EXECUTION_PLAN.md"
echo "   - Implementation Status: CAMPAIGN_IMPLEMENTATION_STATUS.md"
echo ""
echo "🎯 Test the system:"
echo "   1. Create a campaign with 1-2 test leads"
echo "   2. POST to /api/campaigns/[id]/start"
echo "   3. Watch worker logs for job processing"
echo "   4. Check database for status updates"
echo ""
