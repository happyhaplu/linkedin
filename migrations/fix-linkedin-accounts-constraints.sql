-- Migration: Fix linkedin_accounts constraints for proxy_login flow
-- Date: 2026-02-28

-- 1. Add unique constraint on (user_id, email) for upsert support
CREATE UNIQUE INDEX IF NOT EXISTS idx_linkedin_accounts_user_email 
  ON linkedin_accounts(user_id, email);

-- 2. Expand connection_method CHECK to include 'proxy_login'
ALTER TABLE linkedin_accounts DROP CONSTRAINT IF EXISTS linkedin_accounts_connection_method_check;
ALTER TABLE linkedin_accounts ADD CONSTRAINT linkedin_accounts_connection_method_check 
  CHECK (connection_method IN ('credentials', 'extension', 'proxy', 'cookie', 'proxy_login'));

-- 3. Expand status CHECK to include 'pending_verification' and 'disconnected'
ALTER TABLE linkedin_accounts DROP CONSTRAINT IF EXISTS linkedin_accounts_status_check;
ALTER TABLE linkedin_accounts ADD CONSTRAINT linkedin_accounts_status_check 
  CHECK (status IN ('active', 'paused', 'error', 'pending', 'connecting', 'pending_verification', 'disconnected'));
