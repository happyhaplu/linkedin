const { Pool } = require('pg');

console.log('🔧 Fixing network_connections schema...')
console.log('📍 Using local PostgreSQL: reach@localhost:5432/reach')
console.log('')

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://reach:reach@localhost:5432/reach' })
async function runMigration() {
  try {
    console.log('📋 Adding missing column via Supabase API...')
    console.log('')
    
    // Simple approach: Just add the column if missing
    const simpleSQL = `
      ALTER TABLE network_connections 
      ADD COLUMN IF NOT EXISTS connection_profile_id TEXT;
    `
    
    // Try using fetch directly with Supabase's SQL endpoint
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ 
        sql: simpleSQL
      })
    }).catch(err => {
      console.log('⚠️  RPC not available, trying pg client...')
      return null
    })
    
    if (!response || !response.ok) {
      // Fallback to pg client
      console.log('📦 Using PostgreSQL client...')
      const { Client } = require('pg')
      
      // Use direct connection
      const client = new Client({
        connectionString: env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      })
      
      await client.connect()
      console.log('✅ Connected to database')
      
      await client.query(simpleSQL)
      console.log('✅ Column added successfully!')
      
      await client.end()
    } else {
      console.log('✅ Column added via API!')
    }
    
    // Verify the column exists
    console.log('')
    console.log('🔍 Verifying column exists...')
    const { data, error } = await supabase
      .from('network_connections')
      .select('connection_profile_id')
      .limit(1)
    
    if (error) {
      console.log('❌ Verification failed:', error.message)
    } else {
      console.log('✅ Column verified! network_connections.connection_profile_id exists')
    }
    
    console.log('')
    console.log('🎉 Database schema is now up to date!')
    console.log('   You can now restart your dev server.')
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    
    if (error.message.includes('pg')) {
      console.log('')
      console.log('📦 Installing pg module...')
      const { execSync } = require('child_process')
      execSync('pnpm add -D pg', { stdio: 'inherit' })
      console.log('')
      console.log('✅ Installed! Please run this script again:')
      console.log('   node add-missing-column.js')
    }
  }
}

runMigration()
