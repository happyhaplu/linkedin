import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { startCampaign } from '../lib/campaign-executor'

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const CAMP = 'f894669f-d2dd-4194-8480-016135d64cfe'

  // Make sure campaign is active
  await sb.from('campaigns').update({ status: 'active' }).eq('id', CAMP)

  const result = await startCampaign(CAMP, true)  // launchImmediately=true
  console.log('startCampaign result:', JSON.stringify(result))
}

main().catch(console.error)
