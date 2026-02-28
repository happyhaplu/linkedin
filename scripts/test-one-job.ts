/**
 * Run ONE job manually with full verbose output to diagnose what's failing
 */
import { createClient } from '@supabase/supabase-js'
import { processCampaignLeadStep } from '../lib/campaign-executor'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const COLD_ID = 'c644a9b8-7df9-411f-95f7-dd9831abf34f'

async function main() {
  // Get first lead + first step
  const [{ data: leads }, { data: steps }, { data: senders }] = await Promise.all([
    sb.from('campaign_leads').select('*').eq('campaign_id', COLD_ID).eq('status', 'pending').limit(1),
    sb.from('campaign_sequences').select('*').eq('campaign_id', COLD_ID).order('step_number').limit(1),
    sb.from('campaign_senders')
      .select('*, linkedin_account:linkedin_accounts(*)')
      .eq('campaign_id', COLD_ID)
      .eq('is_active', true),
  ])

  const lead = leads?.[0]
  const step = steps?.[0]
  const senderRow = senders?.[0]
  const linAccount = senderRow?.linkedin_account

  console.log('Lead:', lead?.id, '| step:', step?.step_type)
  console.log('LinkedIn account:', linAccount?.id, linAccount?.email, 'hasCookies:', !!linAccount?.session_cookies)

  // Check the actual lead data (linkedin_url)
  const { data: leadData } = await sb.from('leads').select('id,full_name,linkedin_url,first_name,last_name').eq('id', lead?.lead_id)
  console.log('Lead data:', JSON.stringify(leadData?.[0]))

  if (!lead || !step || !linAccount) {
    console.error('Missing data - cannot run test')
    process.exit(1)
  }

  console.log('\n🔵 Running processCampaignLeadStep...\n')

  try {
    const result = await processCampaignLeadStep({
      campaign_id: COLD_ID,
      campaign_lead_id: lead.id,
      lead_id: lead.lead_id,
      sender_account_id: linAccount.id,
      step_id: step.id,
      step_type: step.step_type,
      message_template: step.message_template || '',
      subject_template: step.subject_template || null,
      delay_days: step.delay_days,
      delay_hours: step.delay_hours,
    })
    console.log('\n✅ Result:', JSON.stringify(result, null, 2))
  } catch (err: any) {
    console.error('\n❌ Error:', err.message)
    console.error(err.stack)
  }

  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
