import { DbClient } from '../lib/db/query-builder'
import { startCampaign } from '../lib/campaign-executor'

async function main() {
  const CAMP = 'c644a9b8-7df9-411f-95f7-dd9831abf34f'
  
  // Set campaign back to active
  const sb = new DbClient()
  await sb.from('campaigns').update({ status: 'active' }).eq('id', CAMP)
  
  // Launch with immediate=true
  const result = await startCampaign(CAMP, true)
  console.log('Launch result:', JSON.stringify(result, null, 2))
}
main().catch(console.error)
