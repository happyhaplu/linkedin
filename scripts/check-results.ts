import { DbClient } from '../lib/db/query-builder'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

const sb = new DbClient()
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null })

async function main() {
  const q = new Queue('campaign-processor', { connection: redis })
  const [completed, failed, leadsRes, accRes] = await Promise.all([
    q.getCompleted(0, 5),
    q.getFailed(0, 5),
    sb.from('campaign_leads').select('id,status,current_step_number,connection_sent_at,error_message').eq('campaign_id','c644a9b8-7df9-411f-95f7-dd9831abf34f'),
    sb.from('linkedin_accounts').select('id,email,status,last_active_at,session_cookies').eq('id','67b75216-06b0-49b1-9470-234588fdba45').single(),
  ])

  console.log('=== Completed jobs ===')
  completed.forEach(j => console.log(' -', j.data?.step_type, '|', JSON.stringify(j.returnvalue)))
  console.log('\n=== Failed jobs ===')
  failed.forEach(j => console.log(' -', j.failedReason?.slice(0,200)))
  console.log('\n=== Campaign leads ===')
  leadsRes.data?.forEach(l => console.log(' -', l.id.slice(0,8), l.status, 'step:', l.current_step_number, 'conn_sent:', l.connection_sent_at ? '✅' : '❌', 'err:', l.error_message ?? '-'))

  const acc = accRes.data
  console.log('\n=== LinkedIn Account ===')
  console.log('Email:', acc?.email, '| Status:', acc?.status, '| Last active:', acc?.last_active_at)
  const raw = acc?.session_cookies
  const arr: any[] = Array.isArray(raw) ? raw : typeof raw === 'string' ? JSON.parse(raw) : (raw as any)?.cookies ?? []
  console.log('Cookies count:', arr.length)
  const liAt = arr.find((c: any) => c.name === 'li_at')
  if (liAt) {
    const exp = liAt.expires ? new Date(liAt.expires * 1000) : null
    console.log('li_at expires:', exp?.toISOString(), exp && exp < new Date() ? '⚠️  EXPIRED' : '✅ valid')
  } else {
    console.log('li_at: NOT FOUND')
  }

  await redis.quit()
}
main().catch(e => { console.error(e); process.exit(1) })
