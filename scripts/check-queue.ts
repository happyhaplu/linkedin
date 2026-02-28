import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

async function main() {
  const q = new Queue('campaign-processor', { connection: redis })
  const [waiting, delayed, active, completed, failed] = await Promise.all([
    q.getWaiting(),
    q.getDelayed(),
    q.getActive(),
    q.getCompleted(0, 20),
    q.getFailed(0, 20),
  ])

  console.log('\n=== Queue State ===')
  console.log('Waiting:', waiting.length)
  console.log('Delayed:', delayed.length)
  console.log('Active:', active.length)
  console.log('Completed:', completed.length)
  console.log('Failed:', failed.length)

  if (delayed.length > 0) {
    console.log('\nDelayed jobs fire at:')
    delayed.forEach(j => {
      const fireAt = new Date(j.timestamp + (j.opts.delay || 0))
      console.log(`  - ${j.name.slice(0, 60)}... → ${fireAt.toISOString()}`)
    })
  }

  if (completed.length > 0) {
    console.log('\nCompleted jobs:')
    completed.forEach(j => console.log(`  ✅ ${j.name.slice(0, 60)} → ${JSON.stringify(j.returnvalue)}`))
  }

  if (failed.length > 0) {
    console.log('\nFailed jobs:')
    failed.forEach(j => console.log(`  ❌ ${j.name.slice(0, 60)}\n     Reason: ${j.failedReason}`))
  }

  await redis.quit()
}

main().catch(console.error)
