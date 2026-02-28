-- Migration: Add 'connecting' status and sending_limits to linkedin_accounts table
-- Date: 2026-01-30

-- Step 1: Drop the existing constraint
ALTER TABLE linkedin_accounts DROP CONSTRAINT IF EXISTS linkedin_accounts_status_check;

-- Step 2: Add the new constraint with 'connecting' status
ALTER TABLE linkedin_accounts ADD CONSTRAINT linkedin_accounts_status_check 
  CHECK (status IN ('active', 'paused', 'error', 'pending', 'connecting'));

-- Step 3: Add sending_limits column if it doesn't exist
ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS sending_limits JSONB 
  DEFAULT '{"connection_requests_per_day": 25, "messages_per_day": 40, "inmails_per_day": 40}'::jsonb;

-- Step 4: Update existing rows to have default sending limits if they don't have them
UPDATE linkedin_accounts 
SET sending_limits = '{"connection_requests_per_day": 25, "messages_per_day": 40, "inmails_per_day": 40}'::jsonb
WHERE sending_limits IS NULL;

-- Step 5: Change default status to 'connecting' for new accounts
ALTER TABLE linkedin_accounts ALTER COLUMN status SET DEFAULT 'connecting';

-- Verify the changes
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'linkedin_accounts' 
  AND column_name IN ('status', 'sending_limits');
