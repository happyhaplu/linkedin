/**
 * E2E Campaign Test — Enqueue-then-Monitor approach
 * 
 * Usage:
 *   Step 1: npx tsx scripts/e2e-campaign-test.ts enqueue
 *           (resets data, enqueues 1 lead, then exits)
 *   Step 2: npx next dev
 *           (worker boots and picks up the job)
 *   Step 3: npx tsx scripts/e2e-campaign-test.ts check
 *           (checks DB results after worker processes the job)
 */
import dotenv from 'dotenv'
dotenv.config({ path: '/home/harekrishna/Projects/Linkedin/.env.local' })

import { createClient } from '@supabase/supabase-js'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const CID = 'f894669f-d2dd-4194-8480-016135d64cfe'

async function enqueue() {
  console.log('=== E2E Campaign Test: ENQUEUE ===\n')

  // 1. Reset campaign
  await sb.from('campaigns').update({
    status: 'active',
    started_at: new Date().toISOString(),
    connection_sent: 0,
    connection_accepted: 0,
    messages_sent: 0,
    replies_received: 0,
    total_sent: 0,
    total_accepted: 0,
    total_replied: 0,
    completed_leads: 0,
    replied_leads: 0,
  }).eq('id', CID)
  console.log('✅ Campaign set to active with counters reset')

  // 2. Reset all leads
  const { data: leads } = await sb.from('campaign_leads')
    .select('id')
    .eq('campaign_id', CID)
  if (leads) {
    for (const l of leads) {
      await sb.from('campaign_leads').update({
        status: 'pending',
        current_step_number: 1,
        started_at: null,
        connection_sent_at: null,
        connection_accepted_at: null,
        first_message_sent_at: null,
        first_reply_at: null,
        replied_at: null,
        completed_at: null,
        total_messages_sent: 0,
        total_replies_received: 0,
        sender_id: null,
        sender_account_id: null,
        variant: null,
      }).eq('id', l.id)
    }
    console.log(`✅ Reset ${leads.length} leads to pending`)
  }

  // 3. Reset sender stats
  await sb.from('campaign_senders').update({
    connection_sent: 0,
    connection_accepted: 0,
    messages_sent: 0,
    replies_received: 0,
  }).eq('campaign_id', CID)
  console.log('✅ Sender stats reset')

  // 4. Get first step
  const { data: steps } = await sb.from('campaign_sequences')
    .select('*')
    .eq('campaign_id', CID)
    .order('step_number', { ascending: true })
  if (!steps || steps.length === 0) { console.error('❌ No steps found'); return }
  console.log(`📋 First step: ${steps[0].step_type} (step ${steps[0].step_number})`)

  // 5. Get first pending lead with lead info
  const { data: cLeads } = await sb.from('campaign_leads')
    .select('*, lead:leads(linkedin_url, full_name)')
    .eq('campaign_id', CID)
    .eq('status', 'pending')
    .limit(1)
  if (!cLeads || cLeads.length === 0) { console.error('❌ No pending leads'); return }
  const testLead = cLeads[0]
  console.log(`🎯 Test lead: ${testLead.lead?.full_name} (${testLead.lead?.linkedin_url})`)

  // 6. Get sender
  const { data: senders } = await sb.from('campaign_senders')
    .select('id, linkedin_account_id')
    .eq('campaign_id', CID)
    .eq('is_active', true)
  if (!senders || senders.length === 0) { console.error('❌ No active senders'); return }
  console.log(`📤 Sender account: ${senders[0].linkedin_account_id}`)

  // 7. Enqueue into BullMQ
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

  await queue.add('campaign-lead-step', {
    campaign_id: CID,
    campaign_lead_id: testLead.id,
    lead_id: testLead.lead_id,
    sender_account_id: senders[0].linkedin_account_id,
    step_id: steps[0].id,
    step_type: steps[0].step_type,
    message_template: steps[0].message_template || '',
    subject_template: steps[0].subject_template || '',
    immediate: true,
  })

  const counts = await queue.getJobCounts()
  console.log(`\n✅ Job enqueued! Queue stats:`, counts)
  console.log(`\n📝 NEXT STEP: Start the dev server with 'npx next dev'`)
  console.log(`   The worker will pick up this job automatically.`)
  console.log(`   Then run: npx tsx scripts/e2e-campaign-test.ts check`)

  await queue.close()
  await redis.quit()
}

async function check() {
  console.log('=== E2E Campaign Test: CHECK RESULTS ===\n')

  // 1. Check campaign
  const { data: camp } = await sb.from('campaigns')
    .select('status, started_at, connection_sent, messages_sent, total_sent, completed_leads')
    .eq('id', CID).single()
  console.log('📊 Campaign:', JSON.stringify(camp, null, 2))

  // 2. Check leads
  const { data: leads } = await sb.from('campaign_leads')
    .select('id, status, current_step_number, connection_sent_at, started_at, sender_account_id, total_messages_sent, total_replies_received, lead:leads(full_name, linkedin_url)')
    .eq('campaign_id', CID)
  console.log('\n👥 Campaign Leads:')
  leads?.forEach(l => {
    const lead = l.lead as any
    console.log(`  ${lead?.full_name}: status=${l.status}, step=${l.current_step_number}, connection_sent=${l.connection_sent_at ? 'YES' : 'no'}, sender=${l.sender_account_id ? 'assigned' : 'none'}`)
  })

  // 3. Check sender stats
  const { data: senders } = await sb.from('campaign_senders')
    .select('linkedin_account_id, connection_sent, messages_sent')
    .eq('campaign_id', CID)
  console.log('\n📤 Senders:', JSON.stringify(senders, null, 2))

  // 4. Check Redis queue
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
  const queue = new Queue('campaign-processor', { connection: redis })
  const counts = await queue.getJobCounts()
  console.log('\n📦 Queue stats:', counts)

  // Check for failed jobs
  const failed = await queue.getFailed()
  if (failed.length > 0) {
    console.log('\n❌ Failed jobs:')
    for (const j of failed) {
      console.log(`  Job ${j.id}: ${j.failedReason}`)
      if (j.stacktrace && j.stacktrace.length > 0) {
        console.log(`  Stack: ${j.stacktrace[0].substring(0, 300)}`)
      }
    }
  }

  // Check completed jobs
  const completed = await queue.getCompleted()
  if (completed.length > 0) {
    console.log('\n✅ Completed jobs:')
    for (const j of completed) {
      console.log(`  Job ${j.id}: ${JSON.stringify(j.returnvalue)}`)
    }
  }

  // Check active jobs
  const active = await queue.getActive()
  if (active.length > 0) {
    console.log('\n⏳ Active jobs (still processing):')
    for (const j of active) {
      console.log(`  Job ${j.id}: attempt ${j.attemptsMade}`)
    }
  }

  await queue.close()
  await redis.quit()
}

const cmd = process.argv[2]
if (cmd === 'enqueue') {
  enqueue().catch(console.error)
} else if (cmd === 'check') {
  check().catch(console.error)
} else {
  console.log('Usage:')
  console.log('  npx tsx scripts/e2e-campaign-test.ts enqueue   # Reset + enqueue 1 job')
  console.log('  npx tsx scripts/e2e-campaign-test.ts check     # Check results')
}
