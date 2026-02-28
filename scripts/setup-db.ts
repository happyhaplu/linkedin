import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = 'https://rlsyvgjcxxoregwrwuzf.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsc3l2Z2pjeHhvcmVnd3J3dXpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcwNjU3NCwiZXhwIjoyMDg1MjgyNTc0fQ.0O0T_lTunWIVXVY1y8d5_51-hzb8s40TFmvYsu51QqQ'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createTable(tableName: string, sql: string) {
  console.log(`\n📝 Creating ${tableName} table...`)
  
  // Use the Management API to execute raw SQL
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    },
    body: JSON.stringify({ query: sql })
  })

  if (!response.ok) {
    const error = await response.text()
    console.log(`⚠️  Response: ${error}`)
    
    // Try alternative approach - create via schema
    console.log(`   Trying alternative method...`)
    return false
  }

  console.log(`✅ ${tableName} table created successfully`)
  return true
}

async function setupDatabase() {
  console.log('🚀 Setting up database tables...\n')

  const tables = [
    {
      name: 'proxies',
      sql: `
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
      `
    },
    {
      name: 'linkedin_accounts',
      sql: `
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
      `
    },
    {
      name: 'campaigns',
      sql: `
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
      `
    },
    {
      name: 'campaign_activities',
      sql: `
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
      `
    },
    {
      name: 'account_health_logs',
      sql: `
        CREATE TABLE IF NOT EXISTS account_health_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
          status VARCHAR(50) NOT NULL,
          error_message TEXT,
          session_valid BOOLEAN,
          response_time INTEGER,
          checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    }
  ]

  for (const table of tables) {
    await createTable(table.name, table.sql)
  }

  console.log('\n✨ Database setup script completed!')
  console.log('\nIf tables were not created automatically, please:')
  console.log('1. Go to: https://app.supabase.com/project/rlsyvgjcxxoregwrwuzf/editor/sql')
  console.log('2. Run the SQL files in lib/supabase/ directory')
}

setupDatabase().catch(console.error)
