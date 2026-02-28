-- Network Connections Table
CREATE TABLE IF NOT EXISTS network_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  
  -- Connection Details
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
  
  -- Connection Metadata
  connection_status TEXT DEFAULT 'connected', -- 'connected', 'pending', 'withdrawn', 'ignored'
  connected_at TIMESTAMP WITH TIME ZONE,
  mutual_connections_count INTEGER DEFAULT 0,
  
  -- Tags and Notes
  tags TEXT[], -- Array of tags
  notes TEXT,
  is_favorite BOOLEAN DEFAULT false,
  
  -- Sync Information
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_synced BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for performance
  UNIQUE(linkedin_account_id, connection_profile_id)
);

-- Connection Requests Table
CREATE TABLE IF NOT EXISTS connection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  
  -- Request Details
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
  
  -- Request Metadata
  request_type TEXT DEFAULT 'sent', -- 'sent', 'received'
  request_status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'withdrawn', 'expired'
  message TEXT, -- Connection message sent
  
  -- Dates
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Campaign association
  campaign_id UUID,
  is_automated BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes
  UNIQUE(linkedin_account_id, target_profile_id, request_type)
);

-- Network Sync Logs Table
CREATE TABLE IF NOT EXISTS network_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  
  -- Sync Details
  sync_type TEXT NOT NULL, -- 'full', 'incremental', 'connection_requests'
  sync_status TEXT DEFAULT 'in_progress', -- 'in_progress', 'completed', 'failed', 'partial'
  
  -- Sync Results
  total_connections_synced INTEGER DEFAULT 0,
  new_connections_added INTEGER DEFAULT 0,
  connections_updated INTEGER DEFAULT 0,
  connections_removed INTEGER DEFAULT 0,
  
  -- Connection Requests Results
  total_requests_synced INTEGER DEFAULT 0,
  pending_requests INTEGER DEFAULT 0,
  accepted_requests INTEGER DEFAULT 0,
  
  -- Error Tracking
  error_message TEXT,
  error_details JSONB,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_network_connections_user_id ON network_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_network_connections_linkedin_account_id ON network_connections(linkedin_account_id);
CREATE INDEX IF NOT EXISTS idx_network_connections_status ON network_connections(connection_status);
CREATE INDEX IF NOT EXISTS idx_network_connections_synced ON network_connections(last_synced_at);

CREATE INDEX IF NOT EXISTS idx_connection_requests_user_id ON connection_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_linkedin_account_id ON connection_requests(linkedin_account_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_type ON connection_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_connection_requests_status ON connection_requests(request_status);
CREATE INDEX IF NOT EXISTS idx_connection_requests_sent_at ON connection_requests(sent_at);

CREATE INDEX IF NOT EXISTS idx_network_sync_logs_user_id ON network_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_network_sync_logs_linkedin_account_id ON network_sync_logs(linkedin_account_id);
CREATE INDEX IF NOT EXISTS idx_network_sync_logs_created_at ON network_sync_logs(created_at);

-- Enable Row Level Security
ALTER TABLE network_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for network_connections
CREATE POLICY "Users can view their own network connections"
  ON network_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own network connections"
  ON network_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own network connections"
  ON network_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own network connections"
  ON network_connections FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for connection_requests
CREATE POLICY "Users can view their own connection requests"
  ON connection_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own connection requests"
  ON connection_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connection requests"
  ON connection_requests FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connection requests"
  ON connection_requests FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for network_sync_logs
CREATE POLICY "Users can view their own network sync logs"
  ON network_sync_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own network sync logs"
  ON network_sync_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own network sync logs"
  ON network_sync_logs FOR UPDATE
  USING (auth.uid() = user_id);
