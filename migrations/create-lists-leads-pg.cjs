const { Pool } = require('pg')

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'ppzSwS0s7uNHUqf2',
  ssl: { rejectUnauthorized: false }
})

async function migrate() {
  const client = await pool.connect()
  
  try {
    console.log('🚀 Creating lists table...')
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS lists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        lead_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `)
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_lists_user_id ON lists(user_id);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_lists_created_at ON lists(created_at DESC);`)
    
    console.log('✅ Lists table created')

    console.log('🚀 Creating leads table...')
    
    await client.query(`
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
    `)
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leads_list_id ON leads(list_id);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leads_imported_at ON leads(imported_at DESC);`)
    
    console.log('✅ Leads table created')
    console.log('✅ Migration completed successfully!')
    
  } catch (error) {
    console.error('❌ Migration error:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch(console.error)
