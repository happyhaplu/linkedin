/**
 * BullMQ Queue Configuration
 * Manages campaign job queues and workers
 */

import { Queue, Worker, QueueEvents, Job } from 'bullmq'
import { Redis } from 'ioredis'

// Redis connection shared by all queue instances (publish / stats side).
// Use a proper retry strategy so transient Redis restarts don't leave the
// queue with a permanently dead connection.
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => {
    if (times > 20) return null // give up after ~2 min of retries
    return Math.min(times * 500, 5000) // 500 ms → 5 s backoff
  },
  showFriendlyErrorStack: false,
})

connection.on('error', (err) => {
  // Log but do not throw — BullMQ will retry the operation automatically
  console.error('[CampaignQueue] Redis connection error:', err.message)
})

// Export redis connection for workers to use
export const redisConnection = connection

// Queue names
export const QUEUE_NAMES = {
  CAMPAIGN_PROCESSOR: 'campaign-processor',
  CONNECTION_SENDER: 'connection-sender',
  MESSAGE_SENDER: 'message-sender',
  INMAIL_SENDER: 'inmail-sender',
  STATUS_CHECKER: 'status-checker',
  INBOX_SCANNER: 'inbox-scanner'
} as const

// Export individual queue name constants
export const CAMPAIGN_PROCESSOR = QUEUE_NAMES.CAMPAIGN_PROCESSOR
export const CONNECTION_SENDER = QUEUE_NAMES.CONNECTION_SENDER
export const MESSAGE_SENDER = QUEUE_NAMES.MESSAGE_SENDER
export const INMAIL_SENDER = QUEUE_NAMES.INMAIL_SENDER
export const STATUS_CHECKER = QUEUE_NAMES.STATUS_CHECKER
export const INBOX_SCANNER = QUEUE_NAMES.INBOX_SCANNER

// Job data interfaces
export interface CampaignLeadJobData {
  campaign_id: string
  campaign_lead_id: string
  lead_id: string
  sender_account_id: string
  step_id: string
  step_type: string
  message_template?: string
  subject_template?: string
  delay_days?: number
  delay_hours?: number
  /** When true the worker skips the working-hours check and fires immediately */
  immediate?: boolean
}

export interface StatusCheckJobData {
  campaign_id: string
  campaign_lead_id: string
  lead_id: string
  sender_account_id: string
  check_type: 'connection_status' | 'reply_detection'
}

// Queue configurations
const queueConfig = {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000 // Start with 5 seconds, then 10s, 20s, etc.
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000 // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600 // Keep failed jobs for 7 days
    }
  }
}

// Create queues
export const campaignProcessorQueue = new Queue(QUEUE_NAMES.CAMPAIGN_PROCESSOR, queueConfig)
export const connectionSenderQueue = new Queue(QUEUE_NAMES.CONNECTION_SENDER, queueConfig)
export const messageSenderQueue = new Queue(QUEUE_NAMES.MESSAGE_SENDER, queueConfig)
export const inmailSenderQueue = new Queue(QUEUE_NAMES.INMAIL_SENDER, queueConfig)
export const statusCheckerQueue = new Queue(QUEUE_NAMES.STATUS_CHECKER, queueConfig)
export const inboxScannerQueue = new Queue(QUEUE_NAMES.INBOX_SCANNER, queueConfig)

// Queue events for monitoring
export const campaignProcessorEvents = new QueueEvents(QUEUE_NAMES.CAMPAIGN_PROCESSOR, { connection: connection as any })
export const connectionSenderEvents = new QueueEvents(QUEUE_NAMES.CONNECTION_SENDER, { connection: connection as any })
export const messageSenderEvents = new QueueEvents(QUEUE_NAMES.MESSAGE_SENDER, { connection: connection as any })

// Helper functions to add jobs
export async function addCampaignLeadJob(data: CampaignLeadJobData, delay?: number) {
  // Include timestamp so the same lead+step can be re-queued after completion.
  // BullMQ silently drops jobs whose jobId already exists (including in completed set).
  const ts = Date.now()
  return await campaignProcessorQueue.add(
    'process-campaign-lead',
    data,
    {
      delay,
      jobId: `campaign-${data.campaign_id}-lead-${data.campaign_lead_id}-step-${data.step_id}-${ts}`
    }
  )
}

export async function addConnectionRequestJob(data: Omit<CampaignLeadJobData, 'step_type'>) {
  return await connectionSenderQueue.add(
    'send-connection-request',
    { ...data, step_type: 'connection_request' },
    {
      jobId: `connection-${data.campaign_id}-lead-${data.campaign_lead_id}`
    }
  )
}

export async function addMessageJob(data: Omit<CampaignLeadJobData, 'step_type'>) {
  return await messageSenderQueue.add(
    'send-message',
    { ...data, step_type: 'message' },
    {
      jobId: `message-${data.campaign_id}-lead-${data.campaign_lead_id}-${Date.now()}`
    }
  )
}

export async function addStatusCheckJob(data: StatusCheckJobData) {
  return await statusCheckerQueue.add(
    'check-status',
    data,
    {
      jobId: `status-check-${data.campaign_lead_id}-${data.check_type}`,
      repeat: {
        every: 60 * 60 * 1000 // Check every hour
      }
    }
  )
}

// Get queue statistics
export async function getQueueStats(queueName: keyof typeof QUEUE_NAMES) {
  const queue = getQueue(queueName)
  
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount()
  ])
  
  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed
  }
}

// Get specific queue instance
function getQueue(queueName: keyof typeof QUEUE_NAMES) {
  const queues = {
    CAMPAIGN_PROCESSOR: campaignProcessorQueue,
    CONNECTION_SENDER: connectionSenderQueue,
    MESSAGE_SENDER: messageSenderQueue,
    INMAIL_SENDER: inmailSenderQueue,
    STATUS_CHECKER: statusCheckerQueue,
    INBOX_SCANNER: inboxScannerQueue
  }
  
  return queues[queueName]
}

// Clean up old jobs
export async function cleanQueues() {
  const queues = [
    campaignProcessorQueue,
    connectionSenderQueue,
    messageSenderQueue,
    inmailSenderQueue,
    statusCheckerQueue,
    inboxScannerQueue
  ]
  
  for (const queue of queues) {
    await queue.clean(24 * 3600 * 1000, 1000, 'completed') // Clean completed jobs older than 24 hours
    await queue.clean(7 * 24 * 3600 * 1000, 1000, 'failed') // Clean failed jobs older than 7 days
  }
}

// Pause all queues
export async function pauseAllQueues() {
  await Promise.all([
    campaignProcessorQueue.pause(),
    connectionSenderQueue.pause(),
    messageSenderQueue.pause(),
    inmailSenderQueue.pause(),
    statusCheckerQueue.pause(),
    inboxScannerQueue.pause()
  ])
}

// Resume all queues
export async function resumeAllQueues() {
  await Promise.all([
    campaignProcessorQueue.resume(),
    connectionSenderQueue.resume(),
    messageSenderQueue.resume(),
    inmailSenderQueue.resume(),
    statusCheckerQueue.resume(),
    inboxScannerQueue.resume()
  ])
}

// Close all connections
export async function closeQueues() {
  await Promise.all([
    campaignProcessorQueue.close(),
    connectionSenderQueue.close(),
    messageSenderQueue.close(),
    inmailSenderQueue.close(),
    statusCheckerQueue.close(),
    inboxScannerQueue.close(),
    connection.quit()
  ])
}

const campaignQueue = {
  queues: {
    campaignProcessor: campaignProcessorQueue,
    connectionSender: connectionSenderQueue,
    messageSender: messageSenderQueue,
    inmailSender: inmailSenderQueue,
    statusChecker: statusCheckerQueue,
    inboxScanner: inboxScannerQueue
  },
  events: {
    campaignProcessor: campaignProcessorEvents,
    connectionSender: connectionSenderEvents,
    messageSender: messageSenderEvents
  },
  addCampaignLeadJob,
  addConnectionRequestJob,
  addMessageJob,
  addStatusCheckJob,
  getQueueStats,
  cleanQueues,
  pauseAllQueues,
  resumeAllQueues,
  closeQueues
}

export default campaignQueue
