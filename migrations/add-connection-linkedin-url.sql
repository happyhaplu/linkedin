-- Add connection_linkedin_url column to network_connections table
ALTER TABLE network_connections 
ADD COLUMN IF NOT EXISTS connection_linkedin_url TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_network_connections_linkedin_url 
ON network_connections(connection_linkedin_url);

-- Add comment
COMMENT ON COLUMN network_connections.connection_linkedin_url 
IS 'LinkedIn profile URL of the connection';
