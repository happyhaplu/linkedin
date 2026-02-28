#!/bin/bash

# LinkedIn Automation - Complete Database Setup Script
# This script sets up all required database tables in Supabase

echo "🚀 LinkedIn Automation - Database Setup"
echo "========================================"
echo ""

# Load environment variables
if [ ! -f .env.local ]; then
    echo "❌ Error: .env.local file not found!"
    echo "Please create .env.local with your Supabase credentials"
    exit 1
fi

source .env.local

# Check if required variables are set
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: Missing Supabase credentials in .env.local"
    echo "Required variables:"
    echo "  - NEXT_PUBLIC_SUPABASE_URL"
    echo "  - SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

echo "✓ Environment variables loaded"
echo ""

# Extract project ID from Supabase URL
PROJECT_ID=$(echo $NEXT_PUBLIC_SUPABASE_URL | sed 's|https://||' | sed 's|.supabase.co||')

echo "📊 Database Setup Instructions"
echo "========================================"
echo ""
echo "Please follow these steps to set up your database:"
echo ""
echo "1. Open Supabase SQL Editor:"
echo "   https://app.supabase.com/project/$PROJECT_ID/sql"
echo ""
echo "2. Execute the following SQL files in order:"
echo ""
echo "   Step 1: Core Tables (LinkedIn Accounts & Proxies)"
echo "   ------------------------------------------------"
echo "   Copy and paste contents of: lib/supabase/schema.sql"
echo ""
echo "   Step 2: Campaign Tables"
echo "   ----------------------"
echo "   Copy and paste contents of: lib/supabase/schema-campaigns.sql"
echo ""
echo "3. Click 'RUN' for each SQL script"
echo ""
echo "4. Verify tables were created:"
echo "   - linkedin_accounts"
echo "   - proxies"
echo "   - campaigns"
echo "   - campaign_activities"
echo "   - account_health_logs"
echo ""
echo "========================================"
echo ""
echo "📦 Installed NPM Packages:"
echo "   - bcryptjs (password encryption)"
echo "   - axios (HTTP requests)"
echo "   - socks-proxy-agent (proxy support)"
echo ""
echo "🎯 Features Implemented:"
echo "   ✅ Account Connection (Credentials, Extension, Proxy)"
echo "   ✅ Password Encryption (bcrypt)"
echo "   ✅ Proxy Management & Testing"
echo "   ✅ Account Health Monitoring"
echo "   ✅ Campaign Management"
echo "   ✅ Campaign Assignment to Accounts"
echo "   ✅ Session Management"
echo "   ✅ Row Level Security (RLS)"
echo ""
echo "🚀 After database setup, run:"
echo "   npm run dev"
echo ""
echo "Then navigate to: http://localhost:3000/linkedin-account"
echo ""
