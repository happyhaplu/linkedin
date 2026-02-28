const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.+)$/);
  if (match) {
    env[match[1]] = match[2];
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('Attempting to insert a test row to see what columns exist...\n');
  
  // Try inserting with minimal fields
  const { data, error } = await supabase
    .from('network_connections')
    .insert({
      user_id: '00000000-0000-0000-0000-000000000000',
      linkedin_account_id: '00000000-0000-0000-0000-000000000000',
      full_name: 'Test User'
    })
    .select();
  
  if (error) {
    console.error('Insert error (this helps us see required fields):', error.message);
    
    // Try to select to see columns
    console.log('\nTrying to select from table...');
    const { data: selectData, error: selectError } = await supabase
      .from('network_connections')
      .select('*')
      .limit(1);
    
    if (selectError) {
      console.error('Select error:', selectError.message);
    } else {
      console.log('Select successful. Sample row keys:', selectData[0] ? Object.keys(selectData[0]) : 'No data');
    }
  } else {
    console.log('Insert successful! Row columns:', Object.keys(data[0]));
    
    // Delete the test row
    await supabase
      .from('network_connections')
      .delete()
      .eq('full_name', 'Test User');
  }
})();
