const { Client } = require('pg')

const client = new Client({
  connectionString: 'postgresql://postgres:ppzSwS0s7uNHUqf2@db.rlsyvgjcxxoregwrwuzf.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
})

async function checkProfiles() {
  try {
    await client.connect()
    console.log('✅ Connected to database\n')
    
    const result = await client.query(`
      SELECT 
        email,
        profile_name,
        CASE WHEN profile_picture_url IS NOT NULL THEN 'YES' ELSE 'NO' END as has_photo,
        LEFT(profile_picture_url, 80) as photo_url,
        headline,
        company,
        location
      FROM linkedin_accounts 
      ORDER BY created_at DESC
      LIMIT 5;
    `)
    
    console.log('📊 LinkedIn Accounts Profile Data:\n')
    result.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.email}`)
      console.log(`   Name: ${row.profile_name || 'NOT SET'}`)
      console.log(`   Photo: ${row.has_photo}`)
      if (row.photo_url) {
        console.log(`   URL: ${row.photo_url}...`)
      }
      console.log(`   Headline: ${row.headline || 'NOT SET'}`)
      console.log(`   Company: ${row.company || 'NOT SET'}`)
      console.log(`   Location: ${row.location || 'NOT SET'}`)
      console.log('')
    })
    
    if (result.rows.length === 0) {
      console.log('⚠️  No LinkedIn accounts found in database\n')
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message)
  } finally {
    await client.end()
  }
}

checkProfiles()
