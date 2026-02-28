const https = require('https');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://rlsyvgjcxxoregwrwuzf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsc3l2Z2pjeHhvcmVnd3J3dXpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcwNjU3NCwiZXhwIjoyMDg1MjgyNTc0fQ.0O0T_lTunWIVXVY1y8d5_51-hzb8s40TFmvYsu51QqQ';

function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query: sql });
    
    const options = {
      hostname: 'rlsyvgjcxxoregwrwuzf.supabase.co',
      port: 443,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function executeSqlFile(filePath, fileName) {
  console.log(`\n📝 Reading ${fileName}...`);
  
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`✅ ${fileName} loaded (${sql.length} characters)`);
    return sql;
  } catch (error) {
    console.error(`❌ Error reading ${fileName}:`, error.message);
    return null;
  }
}

async function setupDatabase() {
  console.log('🚀 Setting up database tables...\n');
  
  const schemaPath = path.join(__dirname, '../lib/supabase/schema.sql');
  const campaignsPath = path.join(__dirname, '../lib/supabase/schema-campaigns.sql');
  
  const schema1 = await executeSqlFile(schemaPath, 'schema.sql');
  const schema2 = await executeSqlFile(campaignsPath, 'schema-campaigns.sql');
  
  if (!schema1 || !schema2) {
    console.error('❌ Failed to read schema files');
    return;
  }

  console.log('\n📊 Executing SQL via psql...');
  console.log('   Please run the following commands in your terminal:\n');
  
  console.log('1️⃣  First, get your database connection string from Supabase:');
  console.log('   Go to: https://app.supabase.com/project/rlsyvgjcxxoregwrwuzf/settings/database');
  console.log('   Copy the "Connection string" under "Connection pooling"\n');
  
  console.log('2️⃣  Then run these commands:\n');
  console.log('   psql "YOUR_CONNECTION_STRING" -f lib/supabase/schema.sql');
  console.log('   psql "YOUR_CONNECTION_STRING" -f lib/supabase/schema-campaigns.sql\n');
  
  console.log('OR use the Supabase SQL Editor:');
  console.log('   https://app.supabase.com/project/rlsyvgjcxxoregwrwuzf/editor/sql\n');
}

setupDatabase().catch(console.error);
