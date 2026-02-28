-- Campaign Webhooks
-- Run this migration in your Supabase SQL editor

-- Webhook endpoints configured per campaign
CREATE TABLE IF NOT EXISTS campaign_webhooks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  secret          TEXT,                           -- HMAC secret for signature verification
  events          TEXT[] DEFAULT ARRAY[]::TEXT[], -- Empty = all events
  is_active       BOOLEAN DEFAULT TRUE,
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Delivery log for debugging
CREATE TABLE IF NOT EXISTS campaign_webhook_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id      UUID REFERENCES campaign_webhooks(id) ON DELETE CASCADE,
  campaign_id     UUID NOT NULL,
  event           TEXT NOT NULL,
  success         BOOLEAN NOT NULL,
  status_code     INTEGER,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_webhooks_campaign_id ON campaign_webhooks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_webhook_logs_webhook_id ON campaign_webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_campaign_webhook_logs_campaign_id ON campaign_webhook_logs(campaign_id);

-- RLS
ALTER TABLE campaign_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own campaign webhooks"
  ON campaign_webhooks FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can view own campaign webhook logs"
  ON campaign_webhook_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaign_webhooks cw
      WHERE cw.id = campaign_webhook_logs.webhook_id
        AND cw.user_id = auth.uid()
    )
  );

-- Allow service role to insert logs
CREATE POLICY "Service role can insert webhook logs"
  ON campaign_webhook_logs FOR INSERT
  WITH CHECK (TRUE);
