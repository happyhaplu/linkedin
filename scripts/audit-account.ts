import { DbClient } from '../lib/db/query-builder'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

const sb = new DbClient()
const COLD = 'c644a9b8-7df9-411f-95f7-dd9831abf34f'
const ACCT_ID = '67b75216-06b0-49b1-9470-234588fdba45'

async function main() {
  // ── 1. Campaign leads ─────────────────────────────────────────────────
  const { data: leads } = await sb.from('campaign_leads')
    .select('id, status, current_step_number, connection_sent_at, sender_account_id, lead:leads(linkedin_url, full_name)')
    .eq('campaign_id', COLD)
  console.log('\n=== Campaign Leads ===')
  leads?.forEach((l: any) => {
    const lead = Array.isArray(l.lead) ? l.lead[0] : l.lead
    console.log(`  ${lead?.full_name} | status=${l.status} | step=${l.current_step_number} | conn_sent=${l.connection_sent_at ? 'YES' : 'NO'} | url=${lead?.linkedin_url}`)
  })

  // ── 2. LinkedIn account ───────────────────────────────────────────────
  const { data: acct } = await sb.from('linkedin_accounts')
    .select('id, email, status, session_cookies, password')
    .eq('id', ACCT_ID).single()

  console.log('\n=== LinkedIn Account ===')
  console.log('  email   :', acct?.email)
  console.log('  status  :', acct?.status)
  console.log('  password:', acct?.password ? 'SET' : '*** EMPTY ***')

  const sc = acct?.session_cookies
  if (!sc) {
    console.log('  session_cookies: *** NULL — Playwright cannot authenticate! ***')
  } else if (typeof sc === 'string') {
    try {
      const arr = JSON.parse(sc)
      console.log(`  session_cookies: JSON string → parsed ${arr.length} cookies`)
      const li = arr.find((c: any) => c.name === 'li_at')
      console.log(`  li_at cookie present: ${li ? 'YES (expires ' + new Date(li.expires * 1000).toISOString() + ')' : '*** NO ***'}`)
    } catch {
      console.log('  session_cookies: invalid JSON string, length=', sc.length)
    }
  } else if (Array.isArray(sc)) {
    console.log(`  session_cookies: array length=${sc.length}`)
    const li = sc.find((c: any) => c.name === 'li_at')
    console.log(`  li_at cookie present: ${li ? 'YES' : '*** NO ***'}`)
  } else {
    console.log('  session_cookies: unexpected type =', typeof sc)
  }

  // ── 3. Queue state ────────────────────────────────────────────────────
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null })
  const q = new Queue('campaign-processor', { connection: redis })
  const [w, d, a, f, c] = await Promise.all([
    q.getWaitingCount(), q.getDelayedCount(), q.getActiveCount(), q.getFailedCount(), q.getCompletedCount()
  ])
  console.log('\n=== Queue State ===')
  console.log(`  waiting=${w} delayed=${d} active=${a} failed=${f} completed=${c}`)

  // ── 4. Failed job errors ──────────────────────────────────────────────
  const failed = await q.getFailed()
  if (failed.length > 0) {
    console.log('\n=== Failed Jobs (last 5) ===')
    failed.slice(-5).forEach(j => {
      console.log(`  [${j.id}] ${j.failedReason?.split('\n')[0]}`)
    })
  }

  // ── 5. What sessionCookiesToPlaywright does with it ───────────────────
  const { sessionCookiesToPlaywright } = await import('../lib/linkedin-cookie-auth')
  const cookieInput = acct?.session_cookies
  try {
    const converted = sessionCookiesToPlaywright(cookieInput)
    console.log('\n=== sessionCookiesToPlaywright result ===')
    console.log(`  output length: ${converted?.length ?? 0} cookies`)
    const li2 = converted?.find((c: any) => c.name === 'li_at')
    console.log(`  li_at after conversion: ${li2 ? 'YES' : '*** MISSING — will trigger credential login ***'}`)
  } catch (err: any) {
    console.log('\n=== sessionCookiesToPlaywright THREW ===', err.message)
  }

  await redis.quit()
}

main().catch(console.error)
