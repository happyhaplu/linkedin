const { Pool } = require('pg');
const fs = require('fs');

// Read .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.+)$/);
  if (match) {
    env[match[1]] = match[2];
  }
});

const supabase = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://reach:reach@localhost:5432/reach' })
(async () => {
  console.log('Fetching table schema...\n');
  
  const { data, error } = await supabase
    .from('network_connections')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
    
    // Try to get columns from information_schema
    const { data: columns } = await supabase.rpc('exec_sql', {
      query: `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'network_connections'
        ORDER BY ordinal_position
      `
    });
    
    if (columns) {
      console.log('Columns:', columns);
    }
  } else {
    console.log('Sample row (shows all columns):', data[0] || 'No data');
    if (data[0]) {
      console.log('\nColumn names:', Object.keys(data[0]));
    }
  }
})();
