// Create lists and leads tables
const { Pool } = require('pg');

const supabaseUrl = 'https://db.rlsyvgjcxxoregwrwuzf.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsc3l2Z2pjeHhvcmVnd3J3dXpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3NDA3MzgsImV4cCI6MjA1MTMxNjczOH0.y7LQNEM2kanOM8aRKKOvj2ErhQOx5vu9sN2-Ng_xjvw'

async function migrate() {
  const supabase = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://reach:reach@localhost:5432/reach' })
console.log('🚀 Creating lists table...')
  
  // Create lists table
  const { error: listsError } = await supabase.rpc('exec_sql', {
    sql: `
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
    `
  })

  if (listsError) {
    console.error('❌ Error creating lists table:', listsError)
  } else {
    console.log('✅ Lists table created')
  }

  console.log('🚀 Creating leads table...')

  // Create leads table
  const { error: leadsError } = await supabase.rpc('exec_sql', {
    sql: `
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
    `
  })

  if (leadsError) {
    console.error('❌ Error creating leads table:', leadsError)
  } else {
    console.log('✅ Leads table created')
  }

  console.log('✅ Migration completed!')
}

migrate().catch(console.error)
