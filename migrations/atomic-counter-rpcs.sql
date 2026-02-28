-- Atomic increment for campaign_senders stats
-- Avoids race conditions when concurrent workers read-then-write
CREATE OR REPLACE FUNCTION increment_sender_stat(
  p_campaign_id UUID,
  p_account_id UUID,
  p_column TEXT
)
RETURNS VOID AS $$
BEGIN
  IF p_column = 'connection_sent' THEN
    UPDATE campaign_senders
    SET connection_sent = COALESCE(connection_sent, 0) + 1,
        updated_at = NOW()
    WHERE campaign_id = p_campaign_id
      AND linkedin_account_id = p_account_id;
  ELSIF p_column = 'messages_sent' THEN
    UPDATE campaign_senders
    SET messages_sent = COALESCE(messages_sent, 0) + 1,
        updated_at = NOW()
    WHERE campaign_id = p_campaign_id
      AND linkedin_account_id = p_account_id;
  ELSIF p_column = 'connection_accepted' THEN
    UPDATE campaign_senders
    SET connection_accepted = COALESCE(connection_accepted, 0) + 1,
        updated_at = NOW()
    WHERE campaign_id = p_campaign_id
      AND linkedin_account_id = p_account_id;
  ELSIF p_column = 'replies_received' THEN
    UPDATE campaign_senders
    SET replies_received = COALESCE(replies_received, 0) + 1,
        updated_at = NOW()
    WHERE campaign_id = p_campaign_id
      AND linkedin_account_id = p_account_id;
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
    UPDATE campaigns
    SET connection_sent = COALESCE(connection_sent, 0) + 1,
        updated_at = NOW()
    WHERE id = p_campaign_id;
  ELSIF p_column = 'messages_sent' THEN
    UPDATE campaigns
    SET messages_sent = COALESCE(messages_sent, 0) + 1,
        updated_at = NOW()
    WHERE id = p_campaign_id;
  ELSIF p_column = 'connection_accepted' THEN
    UPDATE campaigns
    SET connection_accepted = COALESCE(connection_accepted, 0) + 1,
        updated_at = NOW()
    WHERE id = p_campaign_id;
  ELSIF p_column = 'replies_received' THEN
    UPDATE campaigns
    SET replies_received = COALESCE(replies_received, 0) + 1,
        updated_at = NOW()
    WHERE id = p_campaign_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Atomic increment for account_daily_counters
-- Avoids race conditions when concurrent workers read-then-write the same daily counter
CREATE OR REPLACE FUNCTION increment_daily_counter(
  p_account_id UUID,
  p_date DATE,
  p_column TEXT
)
RETURNS VOID AS $$
BEGIN
  IF p_column = 'connections_sent' THEN
    UPDATE account_daily_counters
    SET connections_sent = COALESCE(connections_sent, 0) + 1,
        total_actions = COALESCE(total_actions, 0) + 1,
        updated_at = NOW()
    WHERE linkedin_account_id = p_account_id
      AND date = p_date;
  ELSIF p_column = 'messages_sent' THEN
    UPDATE account_daily_counters
    SET messages_sent = COALESCE(messages_sent, 0) + 1,
        total_actions = COALESCE(total_actions, 0) + 1,
        updated_at = NOW()
    WHERE linkedin_account_id = p_account_id
      AND date = p_date;
  ELSIF p_column = 'inmails_sent' THEN
    UPDATE account_daily_counters
    SET inmails_sent = COALESCE(inmails_sent, 0) + 1,
        total_actions = COALESCE(total_actions, 0) + 1,
        updated_at = NOW()
    WHERE linkedin_account_id = p_account_id
      AND date = p_date;
  ELSIF p_column = 'profile_views' THEN
    UPDATE account_daily_counters
    SET profile_views = COALESCE(profile_views, 0) + 1,
        total_actions = COALESCE(total_actions, 0) + 1,
        updated_at = NOW()
    WHERE linkedin_account_id = p_account_id
      AND date = p_date;
  ELSIF p_column = 'total_actions' THEN
    UPDATE account_daily_counters
    SET total_actions = COALESCE(total_actions, 0) + 1,
        updated_at = NOW()
    WHERE linkedin_account_id = p_account_id
      AND date = p_date;
  END IF;
END;
$$ LANGUAGE plpgsql;