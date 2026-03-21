/**
 * Standalone script to launch a campaign by directly adding jobs to the BullMQ queue.
 * Does NOT import Next.js modules — safe to run alongside the dev server.
 */
import dotenv from 'dotenv'
dotenv.config({ path: '/home/harekrishna/Projects/Linkedin/.env.local' })

import { DbClient } from '../lib/db/query-builder'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

const sb = new DbClient()
const CID = 'f894669f-d2dd-4194-8480-016135d64cfe'

async function main() {
  // 1. Set campaign to active
  const { error: updErr } = await sb.from('campaigns').update({
    status: 'active',
    started_at: new Date().toISOString()
  }).eq('id', CID)
  if (updErr) { console.error('Failed to activate campaign:', updErr.message); return }
  console.log('✅ Campaign set to active')

  // 2. Get first sequence step
  const { data: steps } = await sb.from('campaign_sequences')
    .select('*')
    .eq('campaign_id', CID)
    .order('step_number', { ascending: true })
  if (!steps || steps.length === 0) { console.error('No steps found'); return }
  const firstStep = steps[0]
  console.log(`📋 First step: ${firstStep.step_type} (step ${firstStep.step_number})`)

  // 3. Get campaign leads
  const { data: leads } = await sb.from('campaign_leads')
    .select('*, lead:leads(linkedin_url, full_name)')
    .eq('campaign_id', CID)
    .eq('status', 'pending')
  if (!leads || leads.length === 0) { console.error('No pending leads'); return }
  console.log(`👥 Found ${leads.length} pending leads`)

  // 4. Get sender's LinkedIn account ID
  const { data: senders } = await sb.from('campaign_senders')
    .select('id, linkedin_account_id')
    .eq('campaign_id', CID)
    .eq('is_active', true)
  if (!senders || senders.length === 0) { console.error('No active senders'); return }
  const senderAccountId = senders[0].linkedin_account_id
  console.log(`📤 Sender: ${senderAccountId}`)

  // 5. Connect to Redis and create queue
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
  const queue = new Queue('campaign-processor', {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 86400, count: 1000 },
      removeOnFail: { age: 604800 },
    }
  })

  // 6. Enqueue ONLY the first lead (for a controlled E2E test)
  const testLead = leads[0]
  console.log(`\n🎯 Enqueueing 1 lead for E2E test:`)
  console.log(`   Lead: ${testLead.lead?.full_name} (${testLead.lead?.linkedin_url})`)

  await queue.add('campaign-lead-step', {
    campaign_id: CID,
    campaign_lead_id: testLead.id,
    lead_id: testLead.lead_id,
    sender_account_id: senderAccountId,
    step_id: firstStep.id,
    step_type: firstStep.step_type,
    message_template: firstStep.message_template || '',
    subject_template: firstStep.subject_template || '',
    immediate: true,  // skip working-hours check
  })

  console.log(`✅ Job enqueued! The dev server's worker will pick it up.`)

  // Wait a moment then check queue stats
  await new Promise(r => setTimeout(r, 1000))
  const counts = await queue.getJobCounts()
  console.log(`📊 Queue stats:`, counts)

  await queue.close()
  await redis.quit()
}

main().catch(console.error)
