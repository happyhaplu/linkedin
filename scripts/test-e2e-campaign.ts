import dotenv from 'dotenv'
dotenv.config({ path: '/home/harekrishna/Projects/Linkedin/.env.local' })

import { createClient } from '@supabase/supabase-js'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const CID = 'f894669f-d2dd-4194-8480-016135d64cfe'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

const queue = new Queue('campaign-processor', { connection: redis })

async function main() {
  // 1. Set campaign to active
  await sb.from('campaigns').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', CID)
  console.log('✅ Campaign set to active')

  // 2. Get campaign leads
  const { data: leads } = await sb.from('campaign_leads')
    .select('*, lead:leads(*)')
    .eq('campaign_id', CID)
    .eq('status', 'pending')
  console.log(`📋 Found ${leads?.length || 0} pending leads`)

  // 3. Get first step
  const { data: firstStep } = await sb.from('campaign_sequences')
    .select('*')
    .eq('campaign_id', CID)
    .order('step_number')
    .limit(1)
    .single()
  console.log(`📍 First step: ${firstStep?.step_type} (${firstStep?.id})`)

  // 4. Get sender
  const { data: senders } = await sb.from('campaign_senders')
    .select('*, linkedin_account:linkedin_accounts(*)')
    .eq('campaign_id', CID)
    .eq('is_active', true)
  const sender = senders?.[0]
  console.log(`👤 Sender: ${sender?.linkedin_account?.email}`)

  // 5. Queue ONLY the first lead for this test
  const firstLead = leads?.[0]
  if (!firstLead || !firstStep || !sender) {
    console.error('❌ Missing data:', { hasLead: !!firstLead, hasStep: !!firstStep, hasSender: !!sender })
    process.exit(1)
  }

  const jobData = {
    campaign_id: CID,
    campaign_lead_id: firstLead.id,
    lead_id: firstLead.lead_id,
    sender_account_id: sender.linkedin_account.id,
    step_id: firstStep.id,
    step_type: firstStep.step_type,
    message_template: firstStep.message_template || '',
    subject_template: firstStep.subject_template || '',
    immediate: true,
  }

  console.log(`\n🚀 Enqueueing job for lead: ${firstLead.lead?.full_name} (${firstLead.lead?.linkedin_url})`)
  console.log('   Job data:', JSON.stringify(jobData, null, 2))

  const job = await queue.add('campaign-lead-step', jobData, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  })
  console.log(`✅ Job enqueued: ${job.id}`)
  console.log('\n⏳ Waiting 60s for worker to process (check the dev server terminal for logs)...')

  // Wait and check result
  await new Promise(r => setTimeout(r, 60000))

  // Check lead status
  const { data: updatedLead } = await sb.from('campaign_leads')
    .select('id,status,current_step_number,connection_sent_at,started_at')
    .eq('id', firstLead.id)
    .single()
  console.log('\n📊 Lead status after processing:', JSON.stringify(updatedLead, null, 2))

  // Check campaign stats
  const { data: camp } = await sb.from('campaigns')
    .select('connection_sent,connection_accepted,messages_sent,pending_leads,completed_leads')
    .eq('id', CID)
    .single()
  console.log('📊 Campaign stats:', JSON.stringify(camp, null, 2))

  // Check job status in Redis
  const completed = await queue.getCompleted()
  const failed = await queue.getFailed()
  const active = await queue.getActive()
  const delayed = await queue.getDelayed()
  console.log(`\n📊 Queue state: completed=${completed.length} failed=${failed.length} active=${active.length} delayed=${delayed.length}`)

  if (failed.length > 0) {
    console.log('❌ Failed jobs:')
    for (const j of failed) {
      console.log(`   ${j.id}: ${j.failedReason}`)
    }
  }

  await redis.quit()
  process.exit(0)
}

main().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})
