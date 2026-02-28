#!/bin/bash

# Run the profile fields migration
echo "🚀 Running profile fields migration..."
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Run the migration
psql "$DATABASE_URL" < migrations/add-profile-fields.sql

echo ""
echo "✅ Migration complete!"
echo ""
echo "📋 New profile fields added:"
echo "   - profile_name"
echo "   - profile_picture_url"
echo "   - headline"
echo "   - job_title"
echo "   - company"
echo "   - location"
echo "   - profile_url"
echo "   - connections_count"
echo "   - about"
echo ""
echo "🔄 Next: Reconnect your LinkedIn accounts to sync profile data!"
