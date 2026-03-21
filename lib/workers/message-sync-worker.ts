/**
 * Message Sync Worker
 * 
 * Processes BullMQ jobs for:
 * 1. sync-all     — Scrape conversations from all active LinkedIn accounts
 * 2. sync-account — Scrape conversations for a single account
 * 3. send-reply   — Send a real reply via Playwright
 */

import { Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'
import { MESSAGE_SYNC_QUEUE, type MessageSyncJobData } from '@/lib/queue/message-sync-queue'
import { syncAllAccounts, syncAccountMessages, sendLinkedInReply } from '@/lib/linkedin-message-scraper'
import { DbClient } from '@/lib/db/query-builder'

function getServiceSupabase() {
  return new DbClient()
}

function makeRedis() {
  return new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      if (times > 10) return null
      return Math.min(times * 500, 5000)
    },
  })
}

// ─── Processor ───────────────────────────────────────────────────────────────

async function messageSyncProcessor(job: Job<MessageSyncJobData>) {
  console.log(`\n📬 [MsgSyncWorker] Processing: ${job.data.type}`)

  switch (job.data.type) {
    case 'sync-all': {
      await syncAllAccounts(job.data.userId)
      return { type: 'sync-all', completed: true }
    }

    case 'sync-account': {
      if (!job.data.linkedinAccountId) throw new Error('Missing linkedinAccountId')
      const result = await syncAccountMessages(job.data.linkedinAccountId)
      return { type: 'sync-account', ...result }
    }

    case 'send-reply': {
      if (!job.data.linkedinAccountId || !job.data.threadId || !job.data.messageText) {
        throw new Error('Missing required fields for send-reply')
      }

      // Get account details
      const supabase = getServiceSupabase()
      const { data: account } = await supabase
        .from('linkedin_accounts')
        .select('id, email, password, cookies, session_cookies, proxy_url, proxy_username, proxy_password')
        .eq('id', job.data.linkedinAccountId)
        .single()

      if (!account) throw new Error(`Account ${job.data.linkedinAccountId} not found`)

      // Build account object
      const linkedInAccount: any = {
        id: account.id,
        email: account.email,
        password: account.password || '',
        cookies: account.cookies,
        session_cookies: account.session_cookies,
      }

      if (account.proxy_url) {
        try {
          const proxyUrl = new URL(account.proxy_url)
          linkedInAccount.proxy_config = {
            server: `${proxyUrl.protocol}//${proxyUrl.hostname}:${proxyUrl.port}`,
            username: account.proxy_username || proxyUrl.username || undefined,
            password: account.proxy_password || proxyUrl.password || undefined,
          }
        } catch {}
      }

      // Send the reply via Playwright
      const sendResult = await sendLinkedInReply(
        linkedInAccount,
        job.data.threadId,
        job.data.messageText,
      )

      if (!sendResult.success) {
        throw new Error(`Failed to send reply: ${sendResult.error}`)
      }

      // Save the sent message to DB
      if (job.data.conversationId) {
        await supabase.from('messages').insert({
          conversation_id: job.data.conversationId,
          linkedin_account_id: job.data.linkedinAccountId,
          message_id: `sent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          sender_name: account.email,
          is_from_me: true,
          content: job.data.messageText,
          sent_at: new Date().toISOString(),
          is_read: true,
        })
      }

      return { type: 'send-reply', success: true }
    }

    default:
      throw new Error(`Unknown job type: ${job.data.type}`)
  }
}

// ─── Worker lifecycle ────────────────────────────────────────────────────────

let worker: Worker | null = null
let redis: Redis | null = null

export async function startMessageSyncWorker() {
  if (worker) {
    console.log('[MsgSyncWorker] Already running — skipping')
    return
  }

  redis = makeRedis()
  worker = new Worker<MessageSyncJobData>(
    MESSAGE_SYNC_QUEUE,
    messageSyncProcessor,
    {
      connection: redis as any,
      concurrency: 1,           // One sync at a time (sequential, safe)
      lockDuration: 300_000,    // 5-min lock (scraping takes time)
      stalledInterval: 60_000,
    },
  )

  worker.on('completed', (job) =>
    console.log(`✅ [MsgSyncWorker] Job ${job.name} done`),
  )
  worker.on('failed', (job, err) =>
    console.error(`❌ [MsgSyncWorker] Job ${job?.name} failed:`, err.message),
  )
  worker.on('error', (err) =>
    console.error('[MsgSyncWorker] Error:', err.message),
  )

  console.log('✅ [Workers] Message sync worker running (concurrency: 1)')
}

export async function stopMessageSyncWorker() {
  if (worker) {
    await worker.close()
    worker = null
  }
  if (redis) {
    await redis.quit()
    redis = null
  }
}
