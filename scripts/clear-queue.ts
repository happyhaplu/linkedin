import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

const redis = new Redis('redis://localhost:6379', { maxRetriesPerRequest: null })
const q = new Queue('campaign-processor', { connection: redis })

async function main() {
  const [w, d, f, c] = await Promise.all([q.getWaiting(), q.getDelayed(), q.getFailed(), q.getCompleted()])
  console.log('Before: Waiting:', w.length, 'Delayed:', d.length, 'Failed:', f.length, 'Completed:', c.length)
  for (const j of [...w, ...d, ...f]) await j.remove()
  console.log('✅ Cleared all pending/failed jobs.')
  await redis.quit()
}
main().catch(console.error)
