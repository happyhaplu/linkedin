-- Campaigns Table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Campaign Activities Table (for tracking each action)
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

-- Account Health Logs Table
CREATE TABLE IF NOT EXISTS account_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  error_message TEXT,
  session_valid BOOLEAN,
  response_time INTEGER,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_activities_campaign_id ON campaign_activities(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_activities_account_id ON campaign_activities(linkedin_account_id);
CREATE INDEX IF NOT EXISTS idx_account_health_logs_account_id ON account_health_logs(linkedin_account_id);

-- RLS Policies for campaigns
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own campaigns" 
  ON campaigns FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own campaigns" 
  ON campaigns FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns" 
  ON campaigns FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns" 
  ON campaigns FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS Policies for campaign_activities
ALTER TABLE campaign_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaign activities for their campaigns" 
  ON campaign_activities FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_activities.campaign_id 
      AND campaigns.user_id = auth.uid()
    )
  );

-- RLS Policies for account_health_logs
ALTER TABLE account_health_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view health logs for their accounts" 
  ON account_health_logs FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM linkedin_accounts 
      WHERE linkedin_accounts.id = account_health_logs.linkedin_account_id 
      AND linkedin_accounts.user_id = auth.uid()
    )
  );
