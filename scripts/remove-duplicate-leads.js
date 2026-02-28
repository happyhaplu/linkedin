const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

// Load environment variables manually
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const envVars = {}

envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim()
  }
})

async function removeDuplicateLeads() {
  const client = new Client({
    connectionString: envVars.DATABASE_URL
  })

  try {
    await client.connect()
    console.log('✅ Connected to database')

    // Find duplicates based on user_id, list_id, and full_name
    console.log('\n🔍 Finding duplicate leads...')
    
    const findDuplicatesQuery = `
      SELECT 
        user_id, 
        list_id, 
        full_name,
        COUNT(*) as count,
        ARRAY_AGG(id ORDER BY created_at DESC) as ids
      FROM leads
      GROUP BY user_id, list_id, full_name
      HAVING COUNT(*) > 1
    `
    
    const duplicatesResult = await client.query(findDuplicatesQuery)
    
    if (duplicatesResult.rows.length === 0) {
      console.log('✅ No duplicates found!')
      return
    }
    
    console.log(`\n⚠️  Found ${duplicatesResult.rows.length} sets of duplicates`)
    
    let totalDuplicatesRemoved = 0
    
    for (const row of duplicatesResult.rows) {
      const { full_name, count, ids } = row
      
      // Keep the first one (most recent), delete the rest
      const idsToDelete = ids.slice(1)
      
      console.log(`\n📋 "${full_name}" has ${count} duplicates`)
      console.log(`   Keeping: ${ids[0]}`)
      console.log(`   Deleting: ${idsToDelete.join(', ')}`)
      
      const deleteQuery = `
        DELETE FROM leads
        WHERE id = ANY($1)
      `
      
      await client.query(deleteQuery, [idsToDelete])
      totalDuplicatesRemoved += idsToDelete.length
    }
    
    console.log(`\n✅ Successfully removed ${totalDuplicatesRemoved} duplicate leads!`)
    
    // Also check for duplicates by linkedin_url
    console.log('\n🔍 Finding duplicates by LinkedIn URL...')
    
    const findUrlDuplicatesQuery = `
      SELECT 
        user_id, 
        list_id, 
        linkedin_url,
        COUNT(*) as count,
        ARRAY_AGG(id ORDER BY created_at DESC) as ids
      FROM leads
      WHERE linkedin_url IS NOT NULL AND linkedin_url != ''
      GROUP BY user_id, list_id, linkedin_url
      HAVING COUNT(*) > 1
    `
    
    const urlDuplicatesResult = await client.query(findUrlDuplicatesQuery)
    
    if (urlDuplicatesResult.rows.length === 0) {
      console.log('✅ No URL duplicates found!')
    } else {
      console.log(`\n⚠️  Found ${urlDuplicatesResult.rows.length} sets of URL duplicates`)
      
      let urlDuplicatesRemoved = 0
      
      for (const row of urlDuplicatesResult.rows) {
        const { linkedin_url, count, ids } = row
        
        // Keep the first one (most recent), delete the rest
        const idsToDelete = ids.slice(1)
        
        console.log(`\n📋 "${linkedin_url}" has ${count} duplicates`)
        console.log(`   Keeping: ${ids[0]}`)
        console.log(`   Deleting: ${idsToDelete.join(', ')}`)
        
        const deleteQuery = `
          DELETE FROM leads
          WHERE id = ANY($1)
        `
        
        await client.query(deleteQuery, [idsToDelete])
        urlDuplicatesRemoved += idsToDelete.length
      }
      
      console.log(`\n✅ Successfully removed ${urlDuplicatesRemoved} duplicate URL leads!`)
    }
    
    // Show final stats
    console.log('\n📊 Final Statistics:')
    const statsQuery = `
      SELECT 
        COUNT(*) as total_leads,
        COUNT(DISTINCT full_name) as unique_names,
        COUNT(DISTINCT linkedin_url) as unique_urls
      FROM leads
    `
    const statsResult = await client.query(statsQuery)
    console.log(statsResult.rows[0])
    
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await client.end()
    console.log('\n✅ Database connection closed')
  }
}

removeDuplicateLeads()
  .then(() => {
    console.log('\n✅ Duplicate removal completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error.message)
    process.exit(1)
  })
