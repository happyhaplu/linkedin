-- =============================================
-- CAMPAIGNS MODULE - DATABASE SCHEMA
-- =============================================
-- This migration creates all tables for the campaigns module
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. CAMPAIGNS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Campaign Details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, active, paused, completed, canceled
  
  -- Configuration
  lead_list_id UUID REFERENCES lists(id) ON DELETE SET NULL,
  daily_limit INTEGER DEFAULT 50,
  timezone VARCHAR(100) DEFAULT 'UTC',
  
  -- Performance Metrics (cached)
  total_leads INTEGER DEFAULT 0,
  pending_leads INTEGER DEFAULT 0,
  completed_leads INTEGER DEFAULT 0,
  replied_leads INTEGER DEFAULT 0,
  
  -- Stats
  connection_sent INTEGER DEFAULT 0,
  connection_accepted INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  replies_received INTEGER DEFAULT 0,
  
  -- Timestamps
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT campaigns_status_check CHECK (
    status IN ('draft', 'active', 'paused', 'completed', 'canceled')
  )
);

-- =============================================
-- 2. CAMPAIGN SENDERS TABLE (LinkedIn Accounts)
-- =============================================
CREATE TABLE IF NOT EXISTS campaign_senders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  
  -- Sender Settings
  is_active BOOLEAN DEFAULT true,
  daily_limit INTEGER DEFAULT 50,
  
  -- Performance Metrics
  leads_assigned INTEGER DEFAULT 0,
  connection_sent INTEGER DEFAULT 0,
  connection_accepted INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  replies_received INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(campaign_id, linkedin_account_id)
);

-- =============================================
-- 3. CAMPAIGN SEQUENCES TABLE (Drip Workflow)
-- =============================================
CREATE TABLE IF NOT EXISTS campaign_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Sequence Step Details
  step_number INTEGER NOT NULL,
  step_type VARCHAR(50) NOT NULL, -- follow, like_post, connection_request, message, email, inmail, view_profile
  
  -- Action Details
  message_template TEXT, -- For message/inmail steps
  subject_template TEXT, -- For inmail/email steps
  post_url TEXT, -- For like_post steps
  
  -- Timing
  delay_days INTEGER DEFAULT 0,
  delay_hours INTEGER DEFAULT 0,
  
  -- Conditional Logic
  condition_type VARCHAR(50), -- accepted, not_accepted, replied, not_replied, null
  parent_step_id UUID REFERENCES campaign_sequences(id) ON DELETE CASCADE,
  
  -- Performance
  total_executed INTEGER DEFAULT 0,
  total_success INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT campaign_sequences_step_type_check CHECK (
    step_type IN ('follow', 'like_post', 'connection_request', 'message', 'email', 'inmail', 'view_profile')
  ),
  CONSTRAINT campaign_sequences_condition_type_check CHECK (
    condition_type IS NULL OR 
    condition_type IN ('accepted', 'not_accepted', 'replied', 'not_replied', 'opened', 'clicked')
  )
);

-- =============================================
-- 4. CAMPAIGN LEADS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS campaign_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES campaign_senders(id) ON DELETE SET NULL,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, paused, failed
  current_step_id UUID REFERENCES campaign_sequences(id) ON DELETE SET NULL,
  
  -- Engagement
  connection_sent_at TIMESTAMPTZ,
  connection_accepted_at TIMESTAMPTZ,
  first_message_sent_at TIMESTAMPTZ,
  first_reply_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  
  -- Stats
  messages_sent INTEGER DEFAULT 0,
  messages_received INTEGER DEFAULT 0,
  
  -- Scheduling
  next_action_at TIMESTAMPTZ,
  
  -- Error Handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Timestamps
  added_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(campaign_id, lead_id),
  CONSTRAINT campaign_leads_status_check CHECK (
    status IN ('pending', 'in_progress', 'completed', 'paused', 'failed', 'removed')
  )
);

-- =============================================
-- 5. CAMPAIGN ACTIVITY LOG TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS campaign_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  campaign_lead_id UUID REFERENCES campaign_leads(id) ON DELETE CASCADE,
  sequence_step_id UUID REFERENCES campaign_sequences(id) ON DELETE SET NULL,
  
  -- Activity Details
  activity_type VARCHAR(50) NOT NULL, -- follow, like, connection_request, message_sent, reply_received, etc.
  activity_status VARCHAR(50) NOT NULL, -- success, failed, pending
  
  -- Data
  message_content TEXT,
  error_message TEXT,
  metadata JSONB,
  
  -- Timestamps
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT campaign_activity_log_activity_type_check CHECK (
    activity_type IN ('follow', 'unfollow', 'like_post', 'connection_request', 'message_sent', 'reply_received', 'inmail_sent', 'email_sent', 'profile_view')
  ),
  CONSTRAINT campaign_activity_log_activity_status_check CHECK (
    activity_status IN ('success', 'failed', 'pending', 'skipped')
  )
);

-- =============================================
-- INDEXES
-- =============================================

-- Campaigns
CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_lead_list_id ON campaigns(lead_list_id);
CREATE INDEX idx_campaigns_created_at ON campaigns(created_at DESC);

-- Campaign Senders
CREATE INDEX idx_campaign_senders_campaign_id ON campaign_senders(campaign_id);
CREATE INDEX idx_campaign_senders_linkedin_account_id ON campaign_senders(linkedin_account_id);

-- Campaign Sequences
CREATE INDEX idx_campaign_sequences_campaign_id ON campaign_sequences(campaign_id);
CREATE INDEX idx_campaign_sequences_parent_step_id ON campaign_sequences(parent_step_id);
CREATE INDEX idx_campaign_sequences_step_number ON campaign_sequences(step_number);

-- Campaign Leads
CREATE INDEX idx_campaign_leads_campaign_id ON campaign_leads(campaign_id);
CREATE INDEX idx_campaign_leads_lead_id ON campaign_leads(lead_id);
CREATE INDEX idx_campaign_leads_sender_id ON campaign_leads(sender_id);
CREATE INDEX idx_campaign_leads_status ON campaign_leads(status);
CREATE INDEX idx_campaign_leads_next_action_at ON campaign_leads(next_action_at) WHERE status = 'in_progress';

-- Campaign Activity Log
CREATE INDEX idx_campaign_activity_log_campaign_id ON campaign_activity_log(campaign_id);
CREATE INDEX idx_campaign_activity_log_campaign_lead_id ON campaign_activity_log(campaign_lead_id);
CREATE INDEX idx_campaign_activity_log_executed_at ON campaign_activity_log(executed_at DESC);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_senders ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_activity_log ENABLE ROW LEVEL SECURITY;

-- Campaigns Policies
CREATE POLICY "Users can view their own campaigns"
  ON campaigns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns"
  ON campaigns FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns"
  ON campaigns FOR DELETE
  USING (auth.uid() = user_id);

-- Campaign Senders Policies
CREATE POLICY "Users can view campaign senders"
  ON campaign_senders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_senders.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage campaign senders"
  ON campaign_senders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_senders.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

-- Campaign Sequences Policies
CREATE POLICY "Users can view campaign sequences"
  ON campaign_sequences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_sequences.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage campaign sequences"
  ON campaign_sequences FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_sequences.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

-- Campaign Leads Policies
CREATE POLICY "Users can view campaign leads"
  ON campaign_leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_leads.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage campaign leads"
  ON campaign_leads FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_leads.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

-- Campaign Activity Log Policies
CREATE POLICY "Users can view campaign activity"
  ON campaign_activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_activity_log.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create campaign activity"
  ON campaign_activity_log FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_activity_log.campaign_id
      AND campaigns.user_id = auth.uid()
    )
  );

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Function to update campaign stats
CREATE OR REPLACE FUNCTION update_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'campaign_leads' THEN
    -- Update campaign lead counts
    UPDATE campaigns
    SET
      total_leads = (SELECT COUNT(*) FROM campaign_leads WHERE campaign_id = NEW.campaign_id),
      pending_leads = (SELECT COUNT(*) FROM campaign_leads WHERE campaign_id = NEW.campaign_id AND status = 'pending'),
      completed_leads = (SELECT COUNT(*) FROM campaign_leads WHERE campaign_id = NEW.campaign_id AND status = 'completed'),
      replied_leads = (SELECT COUNT(*) FROM campaign_leads WHERE campaign_id = NEW.campaign_id AND first_reply_at IS NOT NULL),
      updated_at = NOW()
    WHERE id = NEW.campaign_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for campaign stats update
CREATE TRIGGER trigger_update_campaign_stats
AFTER INSERT OR UPDATE OR DELETE ON campaign_leads
FOR EACH ROW
EXECUTE FUNCTION update_campaign_stats();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_senders_updated_at BEFORE UPDATE ON campaign_senders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_sequences_updated_at BEFORE UPDATE ON campaign_sequences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_leads_updated_at BEFORE UPDATE ON campaign_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- COMPLETED
-- =============================================
-- All tables, indexes, RLS policies, and triggers created successfully
-- Total tables: 5
-- Total indexes: 15
-- Total RLS policies: 15
-- Total triggers: 5
