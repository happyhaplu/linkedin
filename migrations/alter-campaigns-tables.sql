-- =============================================
-- CAMPAIGNS MODULE - ALTER EXISTING TABLES
-- =============================================
-- This migration updates the existing campaigns table and creates new related tables

-- =============================================
-- 1. ALTER CAMPAIGNS TABLE - Add Missing Columns
-- =============================================

-- Add lead_list_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='campaigns' AND column_name='lead_list_id'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN lead_list_id UUID REFERENCES lists(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add timezone column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='campaigns' AND column_name='timezone'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN timezone VARCHAR(100) DEFAULT 'UTC';
  END IF;
END $$;

-- Add performance metrics columns
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='campaigns' AND column_name='total_leads'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN total_leads INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='campaigns' AND column_name='pending_leads'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN pending_leads INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='campaigns' AND column_name='completed_leads'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN completed_leads INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='campaigns' AND column_name='replied_leads'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN replied_leads INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add stats columns (rename if needed)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='campaigns' AND column_name='connection_sent'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN connection_sent INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='campaigns' AND column_name='connection_accepted'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN connection_accepted INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='campaigns' AND column_name='messages_sent'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN messages_sent INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='campaigns' AND column_name='replies_received'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN replies_received INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add paused_at column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='campaigns' AND column_name='paused_at'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN paused_at TIMESTAMPTZ;
  END IF;
END $$;

-- =============================================
-- 2. CREATE NEW TABLES
-- =============================================

-- Campaign Senders
CREATE TABLE IF NOT EXISTS campaign_senders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  
  is_active BOOLEAN DEFAULT true,
  daily_limit INTEGER DEFAULT 50,
  
  leads_assigned INTEGER DEFAULT 0,
  connection_sent INTEGER DEFAULT 0,
  connection_accepted INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  replies_received INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(campaign_id, linkedin_account_id)
);

-- Campaign Sequences  
CREATE TABLE IF NOT EXISTS campaign_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  
  step_number INTEGER NOT NULL,
  step_type VARCHAR(50) NOT NULL,
  
  message_template TEXT,
  subject_template TEXT,
  post_url TEXT,
  
  delay_days INTEGER DEFAULT 0,
  delay_hours INTEGER DEFAULT 0,
  
  condition_type VARCHAR(50),
  parent_step_id UUID REFERENCES campaign_sequences(id) ON DELETE CASCADE,
  
  total_executed INTEGER DEFAULT 0,
  total_success INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT campaign_sequences_step_type_check CHECK (
    step_type IN ('follow', 'like_post', 'connection_request', 'message', 'email', 'inmail', 'view_profile')
  ),
  CONSTRAINT campaign_sequences_condition_type_check CHECK (
    condition_type IS NULL OR condition_type IN ('accepted', 'not_accepted', 'replied', 'not_replied')
  )
);

-- Campaign Leads
CREATE TABLE IF NOT EXISTS campaign_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES campaign_senders(id) ON DELETE SET NULL,
  
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  current_step_number INTEGER DEFAULT 1,
  next_action_at TIMESTAMPTZ,
  
  connection_sent_at TIMESTAMPTZ,
  connection_accepted_at TIMESTAMPTZ,
  first_message_sent_at TIMESTAMPTZ,
  first_reply_at TIMESTAMPTZ,
  
  total_messages_sent INTEGER DEFAULT 0,
  total_replies_received INTEGER DEFAULT 0,
  
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(campaign_id, lead_id),
  CONSTRAINT campaign_leads_status_check CHECK (
    status IN ('pending', 'in_progress', 'completed', 'paused', 'failed', 'removed')
  )
);

-- Campaign Activity Log
CREATE TABLE IF NOT EXISTS campaign_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  campaign_lead_id UUID REFERENCES campaign_leads(id) ON DELETE CASCADE,
  sequence_step_id UUID REFERENCES campaign_sequences(id) ON DELETE SET NULL,
  
  activity_type VARCHAR(50) NOT NULL,
  activity_status VARCHAR(50) NOT NULL,
  
  message_content TEXT,
  error_message TEXT,
  metadata JSONB,
  
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
-- 3. CREATE INDEXES
-- =============================================

-- Campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_lead_list_id ON campaigns(lead_list_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);

-- Campaign Senders
CREATE INDEX IF NOT EXISTS idx_campaign_senders_campaign_id ON campaign_senders(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_senders_linkedin_account_id ON campaign_senders(linkedin_account_id);

-- Campaign Sequences
CREATE INDEX IF NOT EXISTS idx_campaign_sequences_campaign_id ON campaign_sequences(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sequences_parent_step_id ON campaign_sequences(parent_step_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sequences_step_number ON campaign_sequences(step_number);

-- Campaign Leads
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_id ON campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead_id ON campaign_leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_sender_id ON campaign_leads(sender_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_status ON campaign_leads(status);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_next_action_at ON campaign_leads(next_action_at) WHERE status = 'in_progress';

-- Campaign Activity Log
CREATE INDEX IF NOT EXISTS idx_campaign_activity_log_campaign_id ON campaign_activity_log(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_activity_log_campaign_lead_id ON campaign_activity_log(campaign_lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_activity_log_executed_at ON campaign_activity_log(executed_at DESC);

-- =============================================
-- 4. ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_senders ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_activity_log ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 5. CREATE RLS POLICIES
-- =============================================

-- Campaigns Policies (drop existing first)
DROP POLICY IF EXISTS "Users can view their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can create their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can update their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can delete their own campaigns" ON campaigns;

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
DROP POLICY IF EXISTS "Users can view campaign senders" ON campaign_senders;
DROP POLICY IF EXISTS "Users can manage campaign senders" ON campaign_senders;

CREATE POLICY "Users can view campaign senders"
  ON campaign_senders FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM campaigns WHERE campaigns.id = campaign_senders.campaign_id AND campaigns.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage campaign senders"
  ON campaign_senders FOR ALL
  USING (EXISTS (
    SELECT 1 FROM campaigns WHERE campaigns.id = campaign_senders.campaign_id AND campaigns.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM campaigns WHERE campaigns.id = campaign_senders.campaign_id AND campaigns.user_id = auth.uid()
  ));

-- Campaign Sequences Policies
DROP POLICY IF EXISTS "Users can view campaign sequences" ON campaign_sequences;
DROP POLICY IF EXISTS "Users can manage campaign sequences" ON campaign_sequences;

CREATE POLICY "Users can view campaign sequences"
  ON campaign_sequences FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM campaigns WHERE campaigns.id = campaign_sequences.campaign_id AND campaigns.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage campaign sequences"
  ON campaign_sequences FOR ALL
  USING (EXISTS (
    SELECT 1 FROM campaigns WHERE campaigns.id = campaign_sequences.campaign_id AND campaigns.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM campaigns WHERE campaigns.id = campaign_sequences.campaign_id AND campaigns.user_id = auth.uid()
  ));

-- Campaign Leads Policies
DROP POLICY IF EXISTS "Users can view campaign leads" ON campaign_leads;
DROP POLICY IF EXISTS "Users can manage campaign leads" ON campaign_leads;

CREATE POLICY "Users can view campaign leads"
  ON campaign_leads FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM campaigns WHERE campaigns.id = campaign_leads.campaign_id AND campaigns.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage campaign leads"
  ON campaign_leads FOR ALL
  USING (EXISTS (
    SELECT 1 FROM campaigns WHERE campaigns.id = campaign_leads.campaign_id AND campaigns.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM campaigns WHERE campaigns.id = campaign_leads.campaign_id AND campaigns.user_id = auth.uid()
  ));

-- Campaign Activity Log Policies
DROP POLICY IF EXISTS "Users can view campaign activity" ON campaign_activity_log;
DROP POLICY IF EXISTS "Users can create campaign activity" ON campaign_activity_log;

CREATE POLICY "Users can view campaign activity"
  ON campaign_activity_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM campaigns WHERE campaigns.id = campaign_activity_log.campaign_id AND campaigns.user_id = auth.uid()
  ));

CREATE POLICY "Users can create campaign activity"
  ON campaign_activity_log FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM campaigns WHERE campaigns.id = campaign_activity_log.campaign_id AND campaigns.user_id = auth.uid()
  ));

-- =============================================
-- 6. CREATE TRIGGERS FOR AUTO-UPDATES
-- =============================================

-- Function to update campaign stats
CREATE OR REPLACE FUNCTION update_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE campaigns SET
      total_leads = (SELECT COUNT(*) FROM campaign_leads WHERE campaign_id = NEW.campaign_id),
      pending_leads = (SELECT COUNT(*) FROM campaign_leads WHERE campaign_id = NEW.campaign_id AND status = 'pending'),
      completed_leads = (SELECT COUNT(*) FROM campaign_leads WHERE campaign_id = NEW.campaign_id AND status = 'completed'),
      replied_leads = (SELECT COUNT(*) FROM campaign_leads WHERE campaign_id = NEW.campaign_id AND first_reply_at IS NOT NULL),
      updated_at = NOW()
    WHERE id = NEW.campaign_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE campaigns SET
      total_leads = (SELECT COUNT(*) FROM campaign_leads WHERE campaign_id = OLD.campaign_id),
      pending_leads = (SELECT COUNT(*) FROM campaign_leads WHERE campaign_id = OLD.campaign_id AND status = 'pending'),
      completed_leads = (SELECT COUNT(*) FROM campaign_leads WHERE campaign_id = OLD.campaign_id AND status = 'completed'),
      replied_leads = (SELECT COUNT(*) FROM campaign_leads WHERE campaign_id = OLD.campaign_id AND first_reply_at IS NOT NULL),
      updated_at = NOW()
    WHERE id = OLD.campaign_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for campaign_leads changes
DROP TRIGGER IF EXISTS trigger_update_campaign_stats ON campaign_leads;
CREATE TRIGGER trigger_update_campaign_stats
AFTER INSERT OR UPDATE OR DELETE ON campaign_leads
FOR EACH ROW EXECUTE FUNCTION update_campaign_stats();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at
BEFORE UPDATE ON campaigns
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaign_senders_updated_at ON campaign_senders;
CREATE TRIGGER update_campaign_senders_updated_at
BEFORE UPDATE ON campaign_senders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaign_sequences_updated_at ON campaign_sequences;
CREATE TRIGGER update_campaign_sequences_updated_at
BEFORE UPDATE ON campaign_sequences
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaign_leads_updated_at ON campaign_leads;
CREATE TRIGGER update_campaign_leads_updated_at
BEFORE UPDATE ON campaign_leads
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
