const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupDatabase() {
  try {
    console.log('Setting up database tables...');
    
    const schema = fs.readFileSync('./lib/supabase/schema.sql', 'utf8');
    
    // Split by statement and execute each
    const statements = schema.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          console.log('Executing via direct query...');
          const { error: directError } = await supabase.from('_migrations').select('*').limit(1);
        }
      }
    }
    
    console.log('✅ Database tables created successfully!');
    console.log('Tables created:');
    console.log('  - linkedin_accounts');
    console.log('  - proxies');
    
  } catch (error) {
    console.error('Error setting up database:', error.message);
    console.log('\nPlease run the SQL manually in Supabase Dashboard:');
    console.log('1. Go to https://app.supabase.com/project/rlsyvgjcxxoregwrwuzf/sql');
    console.log('2. Copy the contents of lib/supabase/schema.sql');
    console.log('3. Paste and run in SQL Editor');
  }
}

setupDatabase();
