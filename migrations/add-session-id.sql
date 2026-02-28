-- Add session_id column to linkedin_accounts table
ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS session_id TEXT;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'linkedin_accounts' 
AND column_name = 'session_id';
