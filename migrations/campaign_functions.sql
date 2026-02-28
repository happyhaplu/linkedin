-- Campaign Module Database Functions
-- Run this SQL in Supabase SQL Editor

-- Function to increment sender connection count atomically
CREATE OR REPLACE FUNCTION increment_sender_connections(
  p_campaign_id UUID,
  p_sender_account_id UUID
) RETURNS void AS $$
BEGIN
  UPDATE campaign_senders
  SET 
    connections_sent = connections_sent + 1,
    connections_sent_today = connections_sent_today + 1,
    last_activity_at = NOW()
  WHERE campaign_id = p_campaign_id
    AND sender_account_id = p_sender_account_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment sender message count atomically
CREATE OR REPLACE FUNCTION increment_sender_messages(
  p_campaign_id UUID,
  p_sender_account_id UUID
) RETURNS void AS $$
BEGIN
  UPDATE campaign_senders
  SET 
    messages_sent = messages_sent + 1,
    messages_sent_today = messages_sent_today + 1,
    last_activity_at = NOW()
  WHERE campaign_id = p_campaign_id
    AND sender_account_id = p_sender_account_id;
END;
$$ LANGUAGE plpgsql;

-- Function to reset daily sender limits (run via cron at midnight)
CREATE OR REPLACE FUNCTION reset_daily_sender_limits() RETURNS void AS $$
BEGIN
  UPDATE campaign_senders
  SET 
    connections_sent_today = 0,
    messages_sent_today = 0;
  
  -- Log the reset
  RAISE NOTICE 'Daily sender limits reset at %', NOW();
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
    COUNT(*) FILTER (WHERE status = 'queued')::BIGINT AS queued,
    COUNT(*) FILTER (WHERE status = 'in_progress')::BIGINT AS in_progress,
    COUNT(*) FILTER (WHERE status = 'connection_sent')::BIGINT AS connection_sent,
    COUNT(*) FILTER (WHERE status = 'connected')::BIGINT AS connected,
    COUNT(*) FILTER (WHERE status = 'messaged')::BIGINT AS messaged,
    COUNT(*) FILTER (WHERE status = 'replied')::BIGINT AS replied,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT AS completed,
    COUNT(*) FILTER (WHERE status = 'stopped')::BIGINT AS stopped,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT AS failed
  FROM campaign_leads
  WHERE campaign_id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if campaign can send more today
CREATE OR REPLACE FUNCTION can_sender_send_today(
  p_campaign_id UUID,
  p_sender_account_id UUID,
  p_action_type TEXT -- 'connection' or 'message'
) RETURNS BOOLEAN AS $$
DECLARE
  v_sender RECORD;
BEGIN
  SELECT * INTO v_sender
  FROM campaign_senders
  WHERE campaign_id = p_campaign_id
    AND sender_account_id = p_sender_account_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  IF p_action_type = 'connection' THEN
    RETURN v_sender.connections_sent_today < COALESCE(v_sender.daily_limit, 50);
  ELSIF p_action_type = 'message' THEN
    RETURN v_sender.messages_sent_today < COALESCE(v_sender.daily_limit, 100);
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get next available sender for campaign (round-robin)
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

-- Function to cleanup old completed campaign leads
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_campaign_leads_status ON campaign_leads(status);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_status ON campaign_leads(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_replied ON campaign_leads(replied_at) WHERE replied_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_senders_activity ON campaign_senders(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_campaign_senders_daily_sent ON campaign_senders(connections_sent_today, messages_sent_today);

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION increment_sender_connections TO authenticated;
GRANT EXECUTE ON FUNCTION increment_sender_messages TO authenticated;
GRANT EXECUTE ON FUNCTION get_campaign_stats TO authenticated;
GRANT EXECUTE ON FUNCTION can_sender_send_today TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_campaign_sender TO authenticated;

-- Grant execute permissions to service role for cleanup
GRANT EXECUTE ON FUNCTION reset_daily_sender_limits TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_completed_campaigns TO service_role;

COMMENT ON FUNCTION increment_sender_connections IS 'Atomically increment connection counts for a sender';
COMMENT ON FUNCTION increment_sender_messages IS 'Atomically increment message counts for a sender';
COMMENT ON FUNCTION reset_daily_sender_limits IS 'Reset daily limits at midnight (run via cron)';
COMMENT ON FUNCTION get_campaign_stats IS 'Get aggregated statistics for a campaign';
COMMENT ON FUNCTION can_sender_send_today IS 'Check if sender can send more today';
COMMENT ON FUNCTION get_next_campaign_sender IS 'Get next available sender (round-robin with limits)';
COMMENT ON FUNCTION cleanup_completed_campaigns IS 'Delete old completed/failed campaign leads';
