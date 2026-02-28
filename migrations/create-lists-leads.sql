-- Create lists and leads tables

-- Lists table
CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  lead_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lists_user_id ON lists(user_id);
CREATE INDEX IF NOT EXISTS idx_lists_created_at ON lists(created_at DESC);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_url TEXT,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  company TEXT,
  position TEXT,
  location TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'replied', 'qualified', 'unqualified', 'do_not_contact')),
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_list_id ON leads(list_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_imported_at ON leads(imported_at DESC);

COMMENT ON TABLE lists IS 'Lead lists for organizing contacts';
COMMENT ON TABLE leads IS 'Individual lead contacts imported from CSV or other sources';
