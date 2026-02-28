-- Add comprehensive profile fields to linkedin_accounts table
-- Similar to HeyReach and SalesRobot

-- Add profile name if not exists
ALTER TABLE linkedin_accounts 
ADD COLUMN IF NOT EXISTS profile_name TEXT;

-- Add profile picture URL if not exists  
ALTER TABLE linkedin_accounts 
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Add headline/job title
ALTER TABLE linkedin_accounts 
ADD COLUMN IF NOT EXISTS headline TEXT;

-- Add current job title
ALTER TABLE linkedin_accounts 
ADD COLUMN IF NOT EXISTS job_title TEXT;

-- Add current company
ALTER TABLE linkedin_accounts 
ADD COLUMN IF NOT EXISTS company TEXT;

-- Add location
ALTER TABLE linkedin_accounts 
ADD COLUMN IF NOT EXISTS location TEXT;

-- Add LinkedIn profile URL
ALTER TABLE linkedin_accounts 
ADD COLUMN IF NOT EXISTS profile_url TEXT;

-- Add connections count
ALTER TABLE linkedin_accounts 
ADD COLUMN IF NOT EXISTS connections_count INTEGER;

-- Add about/summary
ALTER TABLE linkedin_accounts 
ADD COLUMN IF NOT EXISTS about TEXT;

-- Create index for faster searches
CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_profile_name ON linkedin_accounts(profile_name);
CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_company ON linkedin_accounts(company);

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'linkedin_accounts' 
AND column_name IN ('profile_name', 'profile_picture_url', 'headline', 'job_title', 'company', 'location', 'profile_url', 'connections_count', 'about')
ORDER BY column_name;
