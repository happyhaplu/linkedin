-- LinkedIn Accounts Table
CREATE TABLE IF NOT EXISTS linkedin_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password_encrypted TEXT,
  connection_method VARCHAR(50) NOT NULL CHECK (connection_method IN ('credentials', 'extension', 'proxy')),
  status VARCHAR(50) NOT NULL DEFAULT 'connecting' CHECK (status IN ('active', 'paused', 'error', 'pending', 'connecting')),
  proxy_id UUID REFERENCES proxies(id) ON DELETE SET NULL,
  assigned_campaigns TEXT[], -- Array of campaign IDs
  two_fa_enabled BOOLEAN DEFAULT false,
  two_fa_secret TEXT,
  session_cookies JSONB,
  error_message TEXT,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  sending_limits JSONB DEFAULT '{"connection_requests_per_day": 25, "messages_per_day": 40, "inmails_per_day": 40}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Proxies Table
CREATE TABLE IF NOT EXISTS proxies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_user_id ON linkedin_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_status ON linkedin_accounts(status);
CREATE INDEX IF NOT EXISTS idx_proxies_user_id ON proxies(user_id);

-- RLS (Row Level Security) Policies
ALTER TABLE linkedin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxies ENABLE ROW LEVEL SECURITY;

-- Policies for linkedin_accounts
CREATE POLICY "Users can view their own LinkedIn accounts" 
  ON linkedin_accounts FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own LinkedIn accounts" 
  ON linkedin_accounts FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own LinkedIn accounts" 
  ON linkedin_accounts FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own LinkedIn accounts" 
  ON linkedin_accounts FOR DELETE 
  USING (auth.uid() = user_id);

-- Policies for proxies
CREATE POLICY "Users can view their own proxies" 
  ON proxies FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own proxies" 
  ON proxies FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own proxies" 
  ON proxies FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own proxies" 
  ON proxies FOR DELETE 
  USING (auth.uid() = user_id);
