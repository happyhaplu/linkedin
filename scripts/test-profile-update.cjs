const { Client } = require('pg')

const client = new Client({
  connectionString: 'postgresql://postgres:ppzSwS0s7uNHUqf2@db.rlsyvgjcxxoregwrwuzf.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
})

async function updateProfileData() {
  try {
    await client.connect()
    console.log('✅ Connected to database\n')
    
    // For testing, let's add some sample profile data
    const testData = {
      profile_name: 'Puja Thakur',
      profile_picture_url: 'https://media.licdn.com/dms/image/v2/D4D03AQHqGvN9kX9z8Q/profile-displayphoto-shrink_200_200/profile-displayphoto-shrink_200_200/0/1699234567890?e=1234567890&v=beta&t=abc123def456',
      headline: 'Software Engineer | Full Stack Developer',
      job_title: 'Software Engineer',
      company: 'Tech Company',
      location: 'San Francisco Bay Area'
    }
    
    console.log('🔄 Updating profile data for thakur.puja369@gmail.com...\n')
    
    const result = await client.query(`
      UPDATE linkedin_accounts 
      SET 
        profile_name = $1,
        profile_picture_url = $2,
        headline = $3,
        job_title = $4,
        company = $5,
        location = $6,
        updated_at = NOW()
      WHERE email = 'thakur.puja369@gmail.com'
      RETURNING email, profile_name, headline;
    `, [
      testData.profile_name,
      testData.profile_picture_url,
      testData.headline,
      testData.job_title,
      testData.company,
      testData.location
    ])
    
    if (result.rows.length > 0) {
      console.log('✅ Profile updated successfully!')
      console.log(`   Email: ${result.rows[0].email}`)
      console.log(`   Name: ${result.rows[0].profile_name}`)
      console.log(`   Headline: ${result.rows[0].headline}\n`)
      console.log('🔄 Please refresh your browser to see the changes\n')
    } else {
      console.log('⚠️  No account found with that email\n')
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message)
  } finally {
    await client.end()
  }
}

updateProfileData()
