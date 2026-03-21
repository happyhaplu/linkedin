/**
 * Run a single campaign lead step directly (no queue) for debugging
 */
import { DbClient } from '../lib/db/query-builder'
import { processCampaignLeadStep } from '../lib/campaign-executor'

const sb = new DbClient()
const COLD_ID = 'c644a9b8-7df9-411f-95f7-dd9831abf34f'
const ACCOUNT_ID = '67b75216-06b0-49b1-9470-234588fdba45'

async function main() {
  // Get first campaign lead + first step
  const { data: leads } = await sb.from('campaign_leads')
    .select('id, lead_id, sender_id, status').eq('campaign_id', COLD_ID).limit(1)
  const lead = leads?.[0]
  if (!lead) { console.log('No leads found'); return }

  const { data: steps } = await sb.from('campaign_sequences')
    .select('*').eq('campaign_id', COLD_ID).order('step_number').limit(1)
  const step = steps?.[0]
  if (!step) { console.log('No steps found'); return }

  console.log('Lead:', lead.id, '  status:', lead.status)
  console.log('Step:', step.id, step.step_type)
  console.log('Running processCampaignLeadStep...\n')

  try {
    const result = await processCampaignLeadStep({
      campaign_id: COLD_ID,
      campaign_lead_id: lead.id,
      lead_id: lead.lead_id,
      sender_account_id: ACCOUNT_ID,
      step_id: step.id,
      step_type: step.step_type,
      message_template: step.message_template || '',
      subject_template: step.subject_template || null,
      delay_days: step.delay_days || 0,
      delay_hours: step.delay_hours || 0,
    })
    console.log('\nResult:', JSON.stringify(result, null, 2))
  } catch (err) {
    console.error('Error:', err)
  }

  // Check DB after
  const { data: updatedLead } = await sb.from('campaign_leads')
    .select('id, status, current_step_number, connection_sent_at, connection_accepted_at')
    .eq('id', lead.id).single()
  console.log('\nLead after:', JSON.stringify(updatedLead, null, 2))
}
main().catch(e => { console.error(e); process.exit(1) })
