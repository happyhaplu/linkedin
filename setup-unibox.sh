#!/bin/bash

# Setup Messages & Conversations Tables in Supabase
# This script runs the SQL migration to create the unified inbox tables

echo "🚀 Setting up Unified Inbox tables in Supabase..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo "Please set it in your .env.local file or export it:"
    echo "export DATABASE_URL='postgresql://...'"
    exit 1
fi

# Run the migration
echo "📝 Running migration: create-messages-tables.sql"

# If you have psql installed:
# psql "$DATABASE_URL" -f migrations/create-messages-tables.sql

# Alternative: Use Supabase CLI
echo ""
echo "To run this migration, use one of these methods:"
echo ""
echo "1. Using psql (if installed):"
echo "   psql \"\$DATABASE_URL\" -f migrations/create-messages-tables.sql"
echo ""
echo "2. Using Supabase Dashboard:"
echo "   - Go to https://supabase.com/dashboard"
echo "   - Select your project"
echo "   - Go to SQL Editor"
echo "   - Paste the contents of migrations/create-messages-tables.sql"
echo "   - Click 'Run'"
echo ""
echo "3. Using Supabase CLI:"
echo "   supabase db push"
echo ""
echo "📄 Migration file location: migrations/create-messages-tables.sql"
echo ""
echo "✅ Once the migration is run, your unified inbox will be ready!"
