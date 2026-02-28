#!/bin/bash

# Network Tables Migration Script
# This script creates the network_connections, connection_requests, and network_sync_logs tables

echo "🚀 Starting Network Tables Migration..."

# Load environment variables
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

# Check if SUPABASE_URL is set
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "❌ Error: NEXT_PUBLIC_SUPABASE_URL is not set"
  echo "Please set it in your .env.local file"
  exit 1
fi

echo "📋 Applying network tables migration..."

# Run the migration using psql or Supabase CLI
# If you have psql installed:
# psql "$DATABASE_URL" < migrations/create-network-tables.sql

# If using Supabase CLI (recommended):
if command -v supabase &> /dev/null; then
  echo "✅ Using Supabase CLI..."
  supabase db push
else
  echo "⚠️  Supabase CLI not found"
  echo "Please run the migration manually:"
  echo "1. Go to your Supabase Dashboard"
  echo "2. Navigate to SQL Editor"
  echo "3. Copy and execute the contents of migrations/create-network-tables.sql"
  echo ""
  echo "Or install Supabase CLI:"
  echo "npm install -g supabase"
fi

echo "✅ Migration script completed!"
echo ""
echo "Next steps:"
echo "1. Verify tables were created in your Supabase dashboard"
echo "2. Connect a LinkedIn account at /linkedin-account"
echo "3. Go to /my-network to start managing your network"
