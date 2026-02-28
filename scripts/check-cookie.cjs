const { Client } = require('pg')

const client = new Client({
  connectionString: 'postgresql://postgres:ppzSwS0s7uNHUqf2@db.rlsyvgjcxxoregwrwuzf.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
})

async function checkCookie() {
  try {
    await client.connect()
    console.log('✅ Connected to database\n')
    
    const result = await client.query(`
      SELECT 
        email,
        session_cookies->'li_at' as li_at_cookie,
        LENGTH(session_cookies->>'li_at') as cookie_length,
        status,
        connection_method
      FROM linkedin_accounts 
      WHERE email = 'thakur.puja369@gmail.com';
    `)
    
    if (result.rows.length > 0) {
      const row = result.rows[0]
      console.log('📊 Account Details:')
      console.log('   Email:', row.email)
      console.log('   Status:', row.status)
      console.log('   Connection Method:', row.connection_method)
      console.log('   Has Cookie:', row.li_at_cookie ? 'YES' : 'NO')
      console.log('   Cookie Length:', row.cookie_length || 'N/A')
      
      if (row.li_at_cookie) {
        const cookieValue = row.li_at_cookie.replace(/^"(.*)"$/, '$1')
        console.log('   Cookie Preview:', cookieValue.substring(0, 20) + '...')
        
        if (cookieValue.length < 100) {
          console.log('\n⚠️  WARNING: Cookie seems too short! Should be 200-300 characters.')
          console.log('   Please reconnect your account with a fresh cookie.\n')
        } else {
          console.log('\n✅ Cookie looks valid (length: ' + cookieValue.length + ')\n')
        }
      } else {
        console.log('\n❌ No cookie found! Please reconnect your account.\n')
      }
    } else {
      console.log('❌ No account found with that email\n')
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message)
  } finally {
    await client.end()
  }
}

checkCookie()
