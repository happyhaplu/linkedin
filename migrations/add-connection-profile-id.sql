-- Add connection_profile_id column if missing
ALTER TABLE network_connections 
ADD COLUMN IF NOT EXISTS connection_profile_id TEXT;

-- Recreate the unique constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'network_connections_linkedin_account_id_connection_profile_id_key'
  ) THEN
    ALTER TABLE network_connections 
    ADD CONSTRAINT network_connections_linkedin_account_id_connection_profile_id_key 
    UNIQUE(linkedin_account_id, connection_profile_id);
  END IF;
END $$;
