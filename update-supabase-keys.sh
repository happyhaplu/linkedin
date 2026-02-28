#!/bin/bash

echo "=============================================="
echo "Supabase Keys Update Script"
echo "=============================================="
echo ""
echo "Your current keys are INVALID. You need to get fresh keys from:"
echo "https://app.supabase.com/project/rlsyvgjcxxoregwrwuzf/settings/api"
echo ""
echo "=============================================="
echo ""

read -p "Paste your NEW NEXT_PUBLIC_SUPABASE_ANON_KEY: " ANON_KEY
read -p "Paste your NEW SUPABASE_SERVICE_ROLE_KEY: " SERVICE_KEY

# Test the new anon key
echo ""
echo "Testing new anon key..."
TEST_RESULT=$(curl -s -H "apikey: $ANON_KEY" "https://rlsyvgjcxxoregwrwuzf.supabase.co/rest/v1/" 2>&1)

if echo "$TEST_RESULT" | grep -q "Invalid API key"; then
    echo "❌ ERROR: The anon key you provided is INVALID!"
    echo "Please double-check and try again."
    exit 1
fi

echo "✅ Anon key is VALID!"
echo ""
echo "Updating .env.local..."

# Create backup
cp .env.local .env.local.backup.$(date +%Y%m%d_%H%M%S)

# Update .env.local
cat > .env.local << EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://rlsyvgjcxxoregwrwuzf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY

# PostgreSQL Database (Direct Connection)
DATABASE_URL=postgresql://postgres:8uzckV2cuTEaqTzt@db.dyaicmlhvpmkcivlmcgn.supabase.co:5432/postgres

# Redis Configuration (for Campaign Queue System)
REDIS_URL=redis://localhost:6379

# Bull Board (Queue Management Dashboard)
BULL_BOARD_USER=admin
BULL_BOARD_PASSWORD=admin

EOF

echo "✅ .env.local updated successfully!"
echo ""
echo "Now restart your dev server:"
echo "  1. Kill the current server (Ctrl+C in the terminal running 'pnpm dev')"
echo "  2. Run: rm -rf .next"
echo "  3. Run: pnpm dev"
