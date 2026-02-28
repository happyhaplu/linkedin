/**
 * Message Sync Queue
 * 
 * BullMQ queue for syncing LinkedIn messages.
 * Runs as a repeating job every 3 minutes.
 */

import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => {
    if (times > 20) return null
    return Math.min(times * 500, 5000)
  },
})

connection.on('error', (err) => {
  console.error('[MessageSyncQueue] Redis error:', err.message)
})

export const MESSAGE_SYNC_QUEUE = 'message-sync'

export const messageSyncQueue = new Queue(MESSAGE_SYNC_QUEUE, {
  connection: connection as any,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 20,
  },
})

export interface MessageSyncJobData {
  type: 'sync-all' | 'sync-account' | 'send-reply'
  linkedinAccountId?: string
  userId?: string
  threadId?: string
  messageText?: string
  conversationId?: string
}

/**
 * Schedule a repeating sync job (call once on boot)
 */
export async function scheduleMessageSync(intervalMinutes: number = 3) {
  // Remove any existing repeating jobs to avoid duplicates
  const existing = await messageSyncQueue.getRepeatableJobs()
  for (const job of existing) {
    await messageSyncQueue.removeRepeatableByKey(job.key)
  }

  // Add a repeating sync job
  await messageSyncQueue.add(
    'sync-all-accounts',
    { type: 'sync-all' as const },
    {
      repeat: {
        every: intervalMinutes * 60 * 1000, // every N minutes
      },
      removeOnComplete: 5,
      removeOnFail: 10,
    },
  )

  console.log(`[MessageSync] Scheduled repeating sync every ${intervalMinutes} minutes`)
}

/**
 * Queue a single reply to be sent
 */
export async function queueReply(data: {
  linkedinAccountId: string
  threadId: string
  messageText: string
  conversationId: string
}) {
  await messageSyncQueue.add('send-reply', {
    type: 'send-reply' as const,
    ...data,
  }, {
    removeOnComplete: 20,
    removeOnFail: 5,
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
  })
}
