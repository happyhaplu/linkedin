#!/bin/bash

echo "Running network tables migration..."
echo ""

# Read environment variables
source .env.local 2>/dev/null || true

# Get Supabase credentials from env
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
SUPABASE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

# Extract project ref from URL
PROJECT_REF=$(echo $SUPABASE_URL | sed 's/https:\/\/\(.*\)\.supabase\.co/\1/')

echo "Please run this migration manually in your Supabase SQL Editor:"
echo ""
echo "Go to: https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
echo ""
echo "Then paste and run the SQL from: migrations/create-network-tables.sql"
echo ""
echo "OR run these specific ALTER TABLE commands:"
echo ""
cat << 'EOF'
-- Add missing columns to network_connections table
ALTER TABLE network_connections 
  ADD COLUMN IF NOT EXISTS connection_linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS connection_profile_id TEXT;

-- Drop old constraint if exists
ALTER TABLE network_connections 
  DROP CONSTRAINT IF EXISTS network_connections_linkedin_account_id_connection_profile_id_key;

-- Add unique constraint
ALTER TABLE network_connections 
  ADD CONSTRAINT network_connections_linkedin_account_id_connection_profile_id_key 
  UNIQUE(linkedin_account_id, connection_profile_id);
EOF
