-- =============================================
-- LOCAL POSTGRESQL SCHEMA — "reach" database
-- Migrated from Supabase Cloud
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- 0. USERS TABLE (replaces Supabase auth.users)
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =============================================
-- 1. PROXIES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS proxies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('http', 'https', 'socks4', 'socks5')),
  host VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL,
  username VARCHAR(255),
  password_encrypted TEXT,
  is_active BOOLEAN DEFAULT true,
  last_tested_at TIMESTAMPTZ,
  test_status VARCHAR(50) CHECK (test_status IN ('success', 'failed', 'not_tested')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proxies_user_id ON proxies(user_id);

-- =============================================
-- 2. LINKEDIN ACCOUNTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS linkedin_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password_encrypted TEXT,
  connection_method VARCHAR(50) NOT NULL CHECK (connection_method IN ('credentials', 'extension', 'proxy', 'cookie', 'proxy_login')),
  status VARCHAR(50) NOT NULL DEFAULT 'connecting' CHECK (status IN ('active', 'paused', 'error', 'pending', 'connecting', 'pending_verification', 'disconnected')),
  proxy_id UUID REFERENCES proxies(id) ON DELETE SET NULL,
  assigned_campaigns TEXT[],
  two_fa_enabled BOOLEAN DEFAULT false,
  two_fa_secret TEXT,
  session_cookies JSONB,
  error_message TEXT,
  last_activity_at TIMESTAMPTZ,
  sending_limits JSONB DEFAULT '{"connection_requests_per_day": 25, "messages_per_day": 40, "inmails_per_day": 40}'::jsonb,
  -- Profile fields
  profile_name TEXT,
  profile_picture_url TEXT,
  headline TEXT,
  job_title TEXT,
  company TEXT,
  location TEXT,
  profile_url TEXT,
  connections_count INTEGER,
  about TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_user_id ON linkedin_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_status ON linkedin_accounts(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_linkedin_accounts_user_email ON linkedin_accounts(user_id, email);
CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_profile_name ON linkedin_accounts(profile_name);
CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_company ON linkedin_accounts(company);

-- =============================================
-- 3. LISTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  lead_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lists_user_id ON lists(user_id);
CREATE INDEX IF NOT EXISTS idx_lists_created_at ON lists(created_at DESC);

-- =============================================
-- 4. LEADS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linkedin_url TEXT,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  company TEXT,
  position TEXT,
  location TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'replied', 'qualified', 'unqualified', 'do_not_contact')),
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_list_id ON leads(list_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_imported_at ON leads(imported_at DESC);

-- =============================================
-- 5. CUSTOM FIELDS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'url', 'email', 'phone')),
  is_required BOOLEAN DEFAULT false,
  default_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_fields_user_id ON custom_fields(user_id);

-- =============================================
-- 6. CAMPAIGNS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'canceled', 'archived')),
  lead_list_id UUID REFERENCES lists(id) ON DELETE SET NULL,
  daily_limit INTEGER DEFAULT 50,
  timezone VARCHAR(100) DEFAULT 'UTC',
  target_audience JSONB,
  message_template TEXT,
  connection_request_template TEXT,
  -- Performance Metrics (cached)
  total_leads INTEGER DEFAULT 0,
  pending_leads INTEGER DEFAULT 0,
  completed_leads INTEGER DEFAULT 0,
  replied_leads INTEGER DEFAULT 0,
  -- Stats
  total_sent INTEGER DEFAULT 0,
  total_accepted INTEGER DEFAULT 0,
  total_replied INTEGER DEFAULT 0,
  connection_sent INTEGER DEFAULT 0,
  connection_accepted INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  replies_received INTEGER DEFAULT 0,
  -- Timestamps
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_lead_list_id ON campaigns(lead_list_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);

-- =============================================
-- 7. CAMPAIGN ACTIVITIES TABLE (legacy)
-- =============================================
CREATE TABLE IF NOT EXISTS campaign_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  lead_id UUID,
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN ('connection_request', 'message', 'follow_up', 'like', 'comment')),
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'sent', 'accepted', 'rejected', 'failed')),
  content TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_campaign_activities_campaign_id ON campaign_activities(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_activities_account_id ON campaign_activities(linkedin_account_id);

-- =============================================
-- 8. ACCOUNT HEALTH LOGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS account_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  error_message TEXT,
  session_valid BOOLEAN,
  response_time INTEGER,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_health_logs_account_id ON account_health_logs(linkedin_account_id);

-- =============================================
-- 9. CAMPAIGN SENDERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS campaign_senders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  sender_account_id UUID REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  daily_limit INTEGER DEFAULT 50,
  leads_assigned INTEGER DEFAULT 0,
  connection_sent INTEGER DEFAULT 0,
  connections_sent_today INTEGER DEFAULT 0,
  connection_accepted INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  messages_sent_today INTEGER DEFAULT 0,
  replies_received INTEGER DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, linkedin_account_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_senders_campaign_id ON campaign_senders(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_senders_linkedin_account_id ON campaign_senders(linkedin_account_id);
CREATE INDEX IF NOT EXISTS idx_campaign_senders_activity ON campaign_senders(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_campaign_senders_daily_sent ON campaign_senders(connections_sent_today, messages_sent_today);

-- =============================================
-- 10. CAMPAIGN SEQUENCES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS campaign_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_type VARCHAR(50) NOT NULL CHECK (step_type IN ('follow', 'like_post', 'connection_request', 'message', 'email', 'inmail', 'view_profile')),
  message_template TEXT,
  subject_template TEXT,
  post_url TEXT,
  delay_days INTEGER DEFAULT 0,
  delay_hours INTEGER DEFAULT 0,
  condition_type VARCHAR(50) CHECK (condition_type IS NULL OR condition_type IN ('accepted', 'not_accepted', 'replied', 'not_replied', 'opened', 'clicked')),
  parent_step_id UUID REFERENCES campaign_sequences(id) ON DELETE CASCADE,
  total_executed INTEGER DEFAULT 0,
  total_success INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_sequences_campaign_id ON campaign_sequences(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sequences_parent_step_id ON campaign_sequences(parent_step_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sequences_step_number ON campaign_sequences(step_number);

-- =============================================
-- 11. CAMPAIGN LEADS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS campaign_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES campaign_senders(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'in_progress', 'connection_sent', 'connected', 'messaged', 'replied', 'completed', 'paused', 'failed', 'removed', 'stopped')),
  current_step_id UUID REFERENCES campaign_sequences(id) ON DELETE SET NULL,
  current_step_number INTEGER DEFAULT 1,
  next_action_at TIMESTAMPTZ,
  connection_sent_at TIMESTAMPTZ,
  connection_accepted_at TIMESTAMPTZ,
  first_message_sent_at TIMESTAMPTZ,
  first_reply_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  messages_sent INTEGER DEFAULT 0,
  messages_received INTEGER DEFAULT 0,
  total_messages_sent INTEGER DEFAULT 0,
  total_replies_received INTEGER DEFAULT 0,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_id ON campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead_id ON campaign_leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_sender_id ON campaign_leads(sender_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_status ON campaign_leads(status);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_status ON campaign_leads(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_next_action_at ON campaign_leads(next_action_at) WHERE status = 'in_progress';
CREATE INDEX IF NOT EXISTS idx_campaign_leads_replied ON campaign_leads(replied_at) WHERE replied_at IS NOT NULL;

-- =============================================
-- 12. CAMPAIGN ACTIVITY LOG TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS campaign_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  campaign_lead_id UUID REFERENCES campaign_leads(id) ON DELETE CASCADE,
  sequence_step_id UUID REFERENCES campaign_sequences(id) ON DELETE SET NULL,
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN ('follow', 'unfollow', 'like_post', 'connection_request', 'message_sent', 'reply_received', 'inmail_sent', 'email_sent', 'profile_view')),
  activity_status VARCHAR(50) NOT NULL CHECK (activity_status IN ('success', 'failed', 'pending', 'skipped')),
  message_content TEXT,
  error_message TEXT,
  metadata JSONB,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_activity_log_campaign_id ON campaign_activity_log(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_activity_log_campaign_lead_id ON campaign_activity_log(campaign_lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_activity_log_executed_at ON campaign_activity_log(executed_at DESC);

-- =============================================
-- 13. CAMPAIGN WEBHOOKS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS campaign_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT,
  events TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_webhooks_campaign_id ON campaign_webhooks(campaign_id);

-- =============================================
-- 14. CAMPAIGN WEBHOOK LOGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS campaign_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES campaign_webhooks(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL,
  event TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  status_code INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_webhook_logs_webhook_id ON campaign_webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_campaign_webhook_logs_campaign_id ON campaign_webhook_logs(campaign_id);

-- =============================================
-- 15. ACCOUNT DAILY COUNTERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS account_daily_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  connections_sent INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  inmails_sent INTEGER DEFAULT 0,
  profile_views INTEGER DEFAULT 0,
  total_actions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(linkedin_account_id, date)
);

CREATE INDEX IF NOT EXISTS idx_account_daily_counters_account_date ON account_daily_counters(linkedin_account_id, date);

-- =============================================
-- 16. NETWORK CONNECTIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS network_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  connection_linkedin_url TEXT,
  connection_profile_id TEXT,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  headline TEXT,
  profile_picture_url TEXT,
  location TEXT,
  company TEXT,
  position TEXT,
  connection_status TEXT DEFAULT 'connected',
  connected_at TIMESTAMPTZ,
  mutual_connections_count INTEGER DEFAULT 0,
  tags TEXT[],
  notes TEXT,
  is_favorite BOOLEAN DEFAULT false,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  is_synced BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(linkedin_account_id, connection_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_network_connections_user_id ON network_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_network_connections_linkedin_account_id ON network_connections(linkedin_account_id);
CREATE INDEX IF NOT EXISTS idx_network_connections_status ON network_connections(connection_status);
CREATE INDEX IF NOT EXISTS idx_network_connections_synced ON network_connections(last_synced_at);
CREATE INDEX IF NOT EXISTS idx_network_connections_linkedin_url ON network_connections(connection_linkedin_url);

-- =============================================
-- 17. CONNECTION REQUESTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS connection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  target_linkedin_url TEXT NOT NULL,
  target_profile_id TEXT,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  headline TEXT,
  profile_picture_url TEXT,
  location TEXT,
  company TEXT,
  position TEXT,
  request_type TEXT DEFAULT 'sent',
  request_status TEXT DEFAULT 'pending',
  message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  campaign_id UUID,
  is_automated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(linkedin_account_id, target_profile_id, request_type)
);

CREATE INDEX IF NOT EXISTS idx_connection_requests_user_id ON connection_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_linkedin_account_id ON connection_requests(linkedin_account_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_type ON connection_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_connection_requests_status ON connection_requests(request_status);
CREATE INDEX IF NOT EXISTS idx_connection_requests_sent_at ON connection_requests(sent_at);

-- =============================================
-- 18. NETWORK SYNC LOGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS network_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL,
  sync_status TEXT DEFAULT 'in_progress',
  total_connections_synced INTEGER DEFAULT 0,
  new_connections_added INTEGER DEFAULT 0,
  connections_updated INTEGER DEFAULT 0,
  connections_removed INTEGER DEFAULT 0,
  total_requests_synced INTEGER DEFAULT 0,
  pending_requests INTEGER DEFAULT 0,
  accepted_requests INTEGER DEFAULT 0,
  error_message TEXT,
  error_details JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_network_sync_logs_user_id ON network_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_network_sync_logs_linkedin_account_id ON network_sync_logs(linkedin_account_id);
CREATE INDEX IF NOT EXISTS idx_network_sync_logs_created_at ON network_sync_logs(created_at);

-- =============================================
-- 19. CONVERSATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  participant_name VARCHAR(255) NOT NULL,
  participant_profile_url VARCHAR(500),
  participant_headline VARCHAR(500),
  participant_avatar_url TEXT,
  last_message_at TIMESTAMPTZ NOT NULL,
  last_message_preview TEXT,
  unread_count INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,
  thread_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(linkedin_account_id, thread_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_linkedin_account ON conversations(linkedin_account_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_unread ON conversations(linkedin_account_id, unread_count) WHERE unread_count > 0;
CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations(linkedin_account_id, is_archived);

-- =============================================
-- 20. MESSAGES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  message_id VARCHAR(255) NOT NULL,
  sender_name VARCHAR(255) NOT NULL,
  sender_profile_url VARCHAR(500),
  is_from_me BOOLEAN DEFAULT FALSE,
  content TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  has_attachment BOOLEAN DEFAULT FALSE,
  attachment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(linkedin_account_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_linkedin_account ON messages(linkedin_account_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(conversation_id, is_read) WHERE is_read = FALSE;

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update campaign stats when campaign_leads change
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

-- Function to update conversation's last_message_at
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET 
    last_message_at = NEW.sent_at,
    last_message_preview = LEFT(NEW.content, 200),
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update unread count
CREATE OR REPLACE FUNCTION update_conversation_unread_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = FALSE AND NEW.is_from_me = FALSE THEN
    UPDATE conversations
    SET unread_count = unread_count + 1
    WHERE id = NEW.conversation_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.is_read = FALSE AND NEW.is_read = TRUE THEN
    UPDATE conversations
    SET unread_count = GREATEST(0, unread_count - 1)
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Atomic increment for campaign_senders stats
CREATE OR REPLACE FUNCTION increment_sender_stat(
  p_campaign_id UUID,
  p_account_id UUID,
  p_column TEXT
)
RETURNS VOID AS $$
BEGIN
  IF p_column = 'connection_sent' THEN
    UPDATE campaign_senders
    SET connection_sent = COALESCE(connection_sent, 0) + 1, updated_at = NOW()
    WHERE campaign_id = p_campaign_id AND linkedin_account_id = p_account_id;
  ELSIF p_column = 'messages_sent' THEN
    UPDATE campaign_senders
    SET messages_sent = COALESCE(messages_sent, 0) + 1, updated_at = NOW()
    WHERE campaign_id = p_campaign_id AND linkedin_account_id = p_account_id;
  ELSIF p_column = 'connection_accepted' THEN
    UPDATE campaign_senders
    SET connection_accepted = COALESCE(connection_accepted, 0) + 1, updated_at = NOW()
    WHERE campaign_id = p_campaign_id AND linkedin_account_id = p_account_id;
  ELSIF p_column = 'replies_received' THEN
    UPDATE campaign_senders
    SET replies_received = COALESCE(replies_received, 0) + 1, updated_at = NOW()
    WHERE campaign_id = p_campaign_id AND linkedin_account_id = p_account_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Atomic increment for campaigns aggregate stats
CREATE OR REPLACE FUNCTION increment_campaign_stat(
  p_campaign_id UUID,
  p_column TEXT
)
RETURNS VOID AS $$
BEGIN
  IF p_column = 'connection_sent' THEN
    UPDATE campaigns SET connection_sent = COALESCE(connection_sent, 0) + 1, updated_at = NOW() WHERE id = p_campaign_id;
  ELSIF p_column = 'messages_sent' THEN
    UPDATE campaigns SET messages_sent = COALESCE(messages_sent, 0) + 1, updated_at = NOW() WHERE id = p_campaign_id;
  ELSIF p_column = 'connection_accepted' THEN
    UPDATE campaigns SET connection_accepted = COALESCE(connection_accepted, 0) + 1, updated_at = NOW() WHERE id = p_campaign_id;
  ELSIF p_column = 'replies_received' THEN
    UPDATE campaigns SET replies_received = COALESCE(replies_received, 0) + 1, updated_at = NOW() WHERE id = p_campaign_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Atomic increment for account_daily_counters
CREATE OR REPLACE FUNCTION increment_daily_counter(
  p_account_id UUID,
  p_date DATE,
  p_column TEXT
)
RETURNS VOID AS $$
BEGIN
  IF p_column = 'connections_sent' THEN
    UPDATE account_daily_counters
    SET connections_sent = COALESCE(connections_sent, 0) + 1, total_actions = COALESCE(total_actions, 0) + 1, updated_at = NOW()
    WHERE linkedin_account_id = p_account_id AND date = p_date;
  ELSIF p_column = 'messages_sent' THEN
    UPDATE account_daily_counters
    SET messages_sent = COALESCE(messages_sent, 0) + 1, total_actions = COALESCE(total_actions, 0) + 1, updated_at = NOW()
    WHERE linkedin_account_id = p_account_id AND date = p_date;
  ELSIF p_column = 'inmails_sent' THEN
    UPDATE account_daily_counters
    SET inmails_sent = COALESCE(inmails_sent, 0) + 1, total_actions = COALESCE(total_actions, 0) + 1, updated_at = NOW()
    WHERE linkedin_account_id = p_account_id AND date = p_date;
  ELSIF p_column = 'profile_views' THEN
    UPDATE account_daily_counters
    SET profile_views = COALESCE(profile_views, 0) + 1, total_actions = COALESCE(total_actions, 0) + 1, updated_at = NOW()
    WHERE linkedin_account_id = p_account_id AND date = p_date;
  ELSIF p_column = 'total_actions' THEN
    UPDATE account_daily_counters
    SET total_actions = COALESCE(total_actions, 0) + 1, updated_at = NOW()
    WHERE linkedin_account_id = p_account_id AND date = p_date;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get campaign statistics
CREATE OR REPLACE FUNCTION get_campaign_stats(p_campaign_id UUID)
RETURNS TABLE (
  total_leads BIGINT,
  queued BIGINT,
  in_progress BIGINT,
  connection_sent BIGINT,
  connected BIGINT,
  messaged BIGINT,
  replied BIGINT,
  completed BIGINT,
  stopped BIGINT,
  failed BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_leads,
    COUNT(*) FILTER (WHERE cl.status = 'queued')::BIGINT AS queued,
    COUNT(*) FILTER (WHERE cl.status = 'in_progress')::BIGINT AS in_progress,
    COUNT(*) FILTER (WHERE cl.status = 'connection_sent')::BIGINT AS connection_sent,
    COUNT(*) FILTER (WHERE cl.status = 'connected')::BIGINT AS connected,
    COUNT(*) FILTER (WHERE cl.status = 'messaged')::BIGINT AS messaged,
    COUNT(*) FILTER (WHERE cl.status = 'replied')::BIGINT AS replied,
    COUNT(*) FILTER (WHERE cl.status = 'completed')::BIGINT AS completed,
    COUNT(*) FILTER (WHERE cl.status = 'stopped')::BIGINT AS stopped,
    COUNT(*) FILTER (WHERE cl.status = 'failed')::BIGINT AS failed
  FROM campaign_leads cl
  WHERE cl.campaign_id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

-- Check if sender can send today
CREATE OR REPLACE FUNCTION can_sender_send_today(
  p_campaign_id UUID,
  p_sender_account_id UUID,
  p_action_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_sender RECORD;
BEGIN
  SELECT * INTO v_sender
  FROM campaign_senders
  WHERE campaign_id = p_campaign_id AND sender_account_id = p_sender_account_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF p_action_type = 'connection' THEN
    RETURN v_sender.connections_sent_today < COALESCE(v_sender.daily_limit, 50);
  ELSIF p_action_type = 'message' THEN
    RETURN v_sender.messages_sent_today < COALESCE(v_sender.daily_limit, 100);
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Get next available sender (round-robin)
CREATE OR REPLACE FUNCTION get_next_campaign_sender(p_campaign_id UUID, p_action_type TEXT)
RETURNS UUID AS $$
DECLARE
  v_sender_id UUID;
BEGIN
  SELECT sender_account_id INTO v_sender_id
  FROM campaign_senders
  WHERE campaign_id = p_campaign_id
    AND is_active = TRUE
    AND (
      (p_action_type = 'connection' AND connections_sent_today < COALESCE(daily_limit, 50))
      OR
      (p_action_type = 'message' AND messages_sent_today < COALESCE(daily_limit, 100))
    )
  ORDER BY last_activity_at ASC NULLS FIRST, created_at ASC
  LIMIT 1;
  RETURN v_sender_id;
END;
$$ LANGUAGE plpgsql;

-- Reset daily sender limits
CREATE OR REPLACE FUNCTION reset_daily_sender_limits() RETURNS void AS $$
BEGIN
  UPDATE campaign_senders SET connections_sent_today = 0, messages_sent_today = 0;
END;
$$ LANGUAGE plpgsql;

-- Cleanup completed campaigns
CREATE OR REPLACE FUNCTION cleanup_completed_campaigns(p_days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM campaign_leads
    WHERE status IN ('completed', 'failed', 'stopped')
      AND updated_at < NOW() - (p_days_old || ' days')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Increment sender connections (legacy)
CREATE OR REPLACE FUNCTION increment_sender_connections(
  p_campaign_id UUID,
  p_sender_account_id UUID
) RETURNS void AS $$
BEGIN
  UPDATE campaign_senders
  SET connections_sent = connections_sent + 1, connections_sent_today = connections_sent_today + 1, last_activity_at = NOW()
  WHERE campaign_id = p_campaign_id AND sender_account_id = p_sender_account_id;
END;
$$ LANGUAGE plpgsql;

-- Increment sender messages (legacy)
CREATE OR REPLACE FUNCTION increment_sender_messages(
  p_campaign_id UUID,
  p_sender_account_id UUID
) RETURNS void AS $$
BEGIN
  UPDATE campaign_senders
  SET messages_sent = messages_sent + 1, messages_sent_today = messages_sent_today + 1, last_activity_at = NOW()
  WHERE campaign_id = p_campaign_id AND sender_account_id = p_sender_account_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

-- Campaign stats update trigger
DROP TRIGGER IF EXISTS trigger_update_campaign_stats ON campaign_leads;
CREATE TRIGGER trigger_update_campaign_stats
AFTER INSERT OR UPDATE OR DELETE ON campaign_leads
FOR EACH ROW EXECUTE FUNCTION update_campaign_stats();

-- Conversation last_message trigger
DROP TRIGGER IF EXISTS trigger_update_conversation_last_message ON messages;
CREATE TRIGGER trigger_update_conversation_last_message
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();

-- Conversation unread count trigger
DROP TRIGGER IF EXISTS trigger_update_unread_count ON messages;
CREATE TRIGGER trigger_update_unread_count
AFTER INSERT OR UPDATE OF is_read ON messages
FOR EACH ROW EXECUTE FUNCTION update_conversation_unread_count();

-- Updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_proxies_updated_at BEFORE UPDATE ON proxies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_linkedin_accounts_updated_at BEFORE UPDATE ON linkedin_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lists_updated_at BEFORE UPDATE ON lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_senders_updated_at BEFORE UPDATE ON campaign_senders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_sequences_updated_at BEFORE UPDATE ON campaign_sequences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_leads_updated_at BEFORE UPDATE ON campaign_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- DONE
-- =============================================
