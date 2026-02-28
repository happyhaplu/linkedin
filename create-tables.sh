#!/bin/bash

# Supabase credentials
SUPABASE_URL="https://rlsyvgjcxxoregwrwuzf.supabase.co"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsc3l2Z2pjeHhvcmVnd3J3dXpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcwNjU3NCwiZXhwIjoyMDg1MjgyNTc0fQ.0O0T_lTunWIVXVY1y8d5_51-hzb8s40TFmvYsu51QqQ"

echo "🚀 Creating database tables..."
echo ""

# Function to execute SQL statement
execute_sql() {
    local table_name=$1
    local sql=$2
    
    echo "📝 Creating table: $table_name"
    
    response=$(curl -s -X POST \
        "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
        -H "apikey: ${SERVICE_KEY}" \
        -H "Authorization: Bearer ${SERVICE_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"query\": $(echo "$sql" | jq -Rs .)}")
    
    if echo "$response" | grep -q "error"; then
        echo "⚠️  Note: $response"
    else
        echo "✅ $table_name table processed"
    fi
    echo ""
}

# Create Proxies table first (referenced by linkedin_accounts)
echo "Creating proxies table..."
cat > /tmp/create_proxies.sql << 'EOF'
CREATE TABLE IF NOT EXISTS proxies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('http', 'https', 'socks4', 'socks5')),
  host VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL,
  username VARCHAR(255),
  password_encrypted TEXT,
  is_active BOOLEAN DEFAULT true,
  last_tested_at TIMESTAMP WITH TIME ZONE,
  test_status VARCHAR(50) CHECK (test_status IN ('success', 'failed', 'not_tested')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_proxies_user_id ON proxies(user_id);
ALTER TABLE proxies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own proxies" ON proxies;
CREATE POLICY "Users can view their own proxies" ON proxies FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own proxies" ON proxies;
CREATE POLICY "Users can insert their own proxies" ON proxies FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own proxies" ON proxies;
CREATE POLICY "Users can update their own proxies" ON proxies FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own proxies" ON proxies;
CREATE POLICY "Users can delete their own proxies" ON proxies FOR DELETE USING (auth.uid() = user_id);
EOF

# Create LinkedIn Accounts table
echo "Creating linkedin_accounts table..."
cat > /tmp/create_linkedin_accounts.sql << 'EOF'
CREATE TABLE IF NOT EXISTS linkedin_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_encrypted TEXT,
  connection_method VARCHAR(50) NOT NULL CHECK (connection_method IN ('credentials', 'extension', 'proxy')),
  status VARCHAR(50) NOT NULL DEFAULT 'connecting' CHECK (status IN ('active', 'paused', 'error', 'pending', 'connecting')),
  proxy_id UUID REFERENCES proxies(id) ON DELETE SET NULL,
  assigned_campaigns TEXT[],
  two_fa_enabled BOOLEAN DEFAULT false,
  two_fa_secret TEXT,
  session_cookies JSONB,
  error_message TEXT,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  sending_limits JSONB DEFAULT '{"connection_requests_per_day": 25, "messages_per_day": 40, "inmails_per_day": 40}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_user_id ON linkedin_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_status ON linkedin_accounts(status);
ALTER TABLE linkedin_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own LinkedIn accounts" ON linkedin_accounts;
CREATE POLICY "Users can view their own LinkedIn accounts" ON linkedin_accounts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own LinkedIn accounts" ON linkedin_accounts;
CREATE POLICY "Users can insert their own LinkedIn accounts" ON linkedin_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own LinkedIn accounts" ON linkedin_accounts;
CREATE POLICY "Users can update their own LinkedIn accounts" ON linkedin_accounts FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own LinkedIn accounts" ON linkedin_accounts;
CREATE POLICY "Users can delete their own LinkedIn accounts" ON linkedin_accounts FOR DELETE USING (auth.uid() = user_id);
EOF

# Create Campaigns table
echo "Creating campaigns table..."
cat > /tmp/create_campaigns.sql << 'EOF'
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  target_audience JSONB,
  message_template TEXT,
  connection_request_template TEXT,
  daily_limit INTEGER DEFAULT 50,
  total_sent INTEGER DEFAULT 0,
  total_accepted INTEGER DEFAULT 0,
  total_replied INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own campaigns" ON campaigns;
CREATE POLICY "Users can view their own campaigns" ON campaigns FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own campaigns" ON campaigns;
CREATE POLICY "Users can insert their own campaigns" ON campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own campaigns" ON campaigns;
CREATE POLICY "Users can update their own campaigns" ON campaigns FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own campaigns" ON campaigns;
CREATE POLICY "Users can delete their own campaigns" ON campaigns FOR DELETE USING (auth.uid() = user_id);
EOF

# Create Campaign Activities table
echo "Creating campaign_activities table..."
cat > /tmp/create_campaign_activities.sql << 'EOF'
CREATE TABLE IF NOT EXISTS campaign_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  lead_id UUID,
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN ('connection_request', 'message', 'follow_up', 'like', 'comment')),
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'sent', 'accepted', 'rejected', 'failed')),
  content TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  executed_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_campaign_activities_campaign_id ON campaign_activities(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_activities_account_id ON campaign_activities(linkedin_account_id);
ALTER TABLE campaign_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view campaign activities for their campaigns" ON campaign_activities;
CREATE POLICY "Users can view campaign activities for their campaigns" ON campaign_activities FOR SELECT USING (
  EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_activities.campaign_id AND campaigns.user_id = auth.uid())
);
EOF

# Create Account Health Logs table
echo "Creating account_health_logs table..."
cat > /tmp/create_health_logs.sql << 'EOF'
CREATE TABLE IF NOT EXISTS account_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  error_message TEXT,
  session_valid BOOLEAN,
  response_time INTEGER,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_account_health_logs_account_id ON account_health_logs(linkedin_account_id);
ALTER TABLE account_health_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view health logs for their accounts" ON account_health_logs;
CREATE POLICY "Users can view health logs for their accounts" ON account_health_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM linkedin_accounts WHERE linkedin_accounts.id = account_health_logs.linkedin_account_id AND linkedin_accounts.user_id = auth.uid())
);
EOF

echo "✨ SQL files created in /tmp"
echo ""
echo "📊 To execute, you have two options:"
echo ""
echo "Option 1: Use Supabase SQL Editor (Recommended)"
echo "  1. Go to: https://app.supabase.com/project/rlsyvgjcxxoregwrwuzf/editor/sql"
echo "  2. Copy and paste the content of each file from /tmp/create_*.sql"
echo "  3. Click 'Run' for each file"
echo ""
echo "Option 2: Use psql (if you have PostgreSQL client installed)"
echo "  Get your connection string from Supabase settings and run:"
echo "  cat /tmp/create_*.sql | psql 'YOUR_CONNECTION_STRING'"
echo ""
echo "Files created:"
ls -lah /tmp/create_*.sql
