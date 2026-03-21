const { Pool } = require('pg');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rlsyvgjcxxoregwrwuzf.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsc3l2Z2pjeHhvcmVnd3J3dXpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcwNjU3NCwiZXhwIjoyMDg1MjgyNTc0fQ.0O0T_lTunWIVXVY1y8d5_51-hzb8s40TFmvYsu51QqQ'

const supabase = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://reach:reach@localhost:5432/reach' })
async function fixNetworkConnectionsSchema() {
  console.log('🔧 Fixing network_connections table schema...\n')

  try {
    // Step 1: Check current columns
    console.log('📋 Step 1: Checking current table structure...')
    const { data: columns, error: checkError } = await supabase
      .from('network_connections')
      .select('*')
      .limit(1)
    
    if (checkError) {
      console.log('❌ Error checking table:', checkError.message)
      return
    }

    console.log('✅ Table exists')
    console.log('Current columns:', Object.keys(columns?.[0] || {}))

    // Step 2: Add missing column via SQL
    console.log('\n📝 Step 2: Adding connection_profile_id column...')
    
    const { data: alterResult, error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN
          -- Add connection_profile_id if it doesn't exist
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'network_connections' 
            AND column_name = 'connection_profile_id'
          ) THEN
            ALTER TABLE network_connections 
            ADD COLUMN connection_profile_id TEXT;
            
            RAISE NOTICE 'Added connection_profile_id column';
          ELSE
            RAISE NOTICE 'Column connection_profile_id already exists';
          END IF;
        END $$;
      `
    })

    if (alterError) {
      console.log('⚠️ RPC method not available, trying direct SQL execution...')
      
      // Alternative: Use raw SQL via the REST API
      const { error: sqlError } = await supabase
        .rpc('exec', {
          query: `
            ALTER TABLE network_connections 
            ADD COLUMN IF NOT EXISTS connection_profile_id TEXT;
          `
        })
      
      if (sqlError) {
        console.log('❌ Cannot execute SQL directly. Running manual migration...')
        
        // Manual approach: Update via Supabase Studio or create a migration file
        console.log('\n📋 MANUAL MIGRATION REQUIRED:')
        console.log('Run this SQL in your Supabase SQL Editor:')
        console.log('-------------------------------------------')
        console.log('ALTER TABLE network_connections')
        console.log('ADD COLUMN IF NOT EXISTS connection_profile_id TEXT;')
        console.log('-------------------------------------------')
        console.log('\nOr go to: https://app.supabase.com/project/rlsyvgjcxxoregwrwuzf/editor')
        return
      }
    }

    console.log('✅ Column added successfully!')

    // Step 3: Verify the column was added
    console.log('\n✅ Step 3: Verifying the change...')
    const { data: verify, error: verifyError } = await supabase
      .from('network_connections')
      .select('connection_profile_id')
      .limit(1)

    if (verifyError) {
      console.log('❌ Verification failed:', verifyError.message)
    } else {
      console.log('✅ Column verified! The network_connections table now has connection_profile_id')
    }

    console.log('\n🎉 Schema fix completed!')

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
  }
}

fixNetworkConnectionsSchema()
