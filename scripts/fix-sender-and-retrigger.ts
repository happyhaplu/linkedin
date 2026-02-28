import { createClient } from '@supabase/supabase-js'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null })

const CAMPAIGN_ID = 'c644a9b8-7df9-411f-95f7-dd9831abf34f'

async function main() {
  // Find actual LinkedIn accounts
  const { data: accounts } = await sb.from('linkedin_accounts').select('id, email, status')
  console.log('LinkedIn accounts in DB:')
  accounts?.forEach(a => console.log(`  id=${a.id}  email=${a.email}  status=${a.status}`))

  if (!accounts || accounts.length === 0) {
    console.error('\n❌ No LinkedIn accounts found! Add one in Settings > LinkedIn Accounts')
    await redis.quit(); return
  }

  const realAccountId = accounts.find(a => a.status === 'active')?.id ?? accounts[0].id
  console.log(`\n✅ Will use account: ${realAccountId}`)

  // Update all campaign_leads to use the correct sender_id
  console.log('\n🔧 Updating campaign_leads sender_id...')
  const { error } = await sb
    .from('campaign_leads')
    .update({ sender_id: realAccountId })
    .eq('campaign_id', CAMPAIGN_ID)
  
  if (error) {
    console.error('DB update failed:', error)
  } else {
    console.log('✅ sender_id updated in DB')
  }

  // Also clear failed jobs and re-enqueue with correct account ID
  const q = new Queue('campaign-processor', { connection: redis })
  const failed = await q.getFailed()
  console.log(`\n🧹 Removing ${failed.length} failed jobs...`)
  for (const job of failed) {
    await job.remove()
  }

  // Re-trigger
  console.log('\n🚀 Re-enqueueing campaign...')
  const { startCampaign } = await import('../lib/campaign-executor')
  await startCampaign(CAMPAIGN_ID)
  console.log('✅ Done! Workers will process jobs shortly.')

  const [waiting, delayed] = await Promise.all([q.getWaiting(), q.getDelayed()])
  console.log(`\nQueue: ${waiting.length} waiting, ${delayed.length} delayed`)

  await redis.quit()
}

main().catch(e => { console.error(e); process.exit(1) })
