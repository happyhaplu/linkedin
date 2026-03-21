/**
 * Inbox Scanner Worker
 * 
 * Scans LinkedIn inbox for replies from campaign leads
 * - Runs periodically (e.g., every hour)
 * - Detects new messages from leads
 * - Updates campaign_leads with replied_at timestamp
 * - Stops campaign sequences (stop-on-reply)
 */

import { Worker, Job } from 'bullmq';
import { DbClient } from '@/lib/db/query-builder';
import { scanInboxForReplies } from '@/lib/linkedin-campaign-automation';
import { redisConnection, INBOX_SCANNER } from '../campaign-queue';

const supabase = new DbClient();

interface InboxScanJob {
  campaign_id: string;
  sender_account_id: string;
}

/**
 * Process inbox scan job
 */
async function processInboxScan(job: Job<InboxScanJob>) {
  const { campaign_id, sender_account_id } = job.data;

  console.log(`[Inbox Scanner] Scanning inbox for campaign ${campaign_id}`);

  try {
    // Get campaign with stop_on_reply setting
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, stop_on_reply')
      .eq('id', campaign_id)
      .single();

    if (campaignError || !campaign) {
      throw new Error('Campaign not found');
    }

    // Get sender account
    const { data: account, error: accountError } = await supabase
      .from('linkedin_accounts')
      .select('*')
      .eq('id', sender_account_id)
      .single();

    if (accountError || !account) {
      throw new Error('Sender account not found');
    }

    // Get all active campaign leads (in_progress, connected, messaged)
    const { data: campaignLeads, error: leadsError } = await supabase
      .from('campaign_leads')
      .select('id, lead_id, status, leads(linkedin_url, full_name)')
      .eq('campaign_id', campaign_id)
      .in('status', ['in_progress'])
      .is('replied_at', null);

    if (leadsError || !campaignLeads || campaignLeads.length === 0) {
      console.log(`[Inbox Scanner] No active leads to check for campaign ${campaign_id}`);
      return { success: true, scanned: 0 };
    }

    // Extract LinkedIn URLs
    const linkedInUrls = campaignLeads
      .map((cl: any) => cl.leads?.linkedin_url)
      .filter(Boolean);

    console.log(`[Inbox Scanner] Checking ${linkedInUrls.length} conversations`);

    // Scan inbox via Playwright
    const results = await scanInboxForReplies(
      {
        id: account.id,
        email: account.email,
        password: account.password,
        cookies: account.cookies ? JSON.parse(account.cookies) : [],
        proxy_url: account.proxy_url,
      },
      linkedInUrls
    );

    console.log(`[Inbox Scanner] Found ${results.length} conversations`);

    // Update leads with new messages
    let repliedCount = 0;

    for (const result of results) {
      if (result.hasNewMessage) {
        // Find matching campaign lead
        const matchingLead = campaignLeads.find((cl: any) =>
          result.profileUrl.includes(cl.leads?.linkedin_url)
        );

        if (matchingLead) {
          const leadData = Array.isArray(matchingLead.leads) ? matchingLead.leads[0] : matchingLead.leads;
          console.log(`[Inbox Scanner] Reply detected from ${leadData?.full_name}`);

          // Update campaign lead
          const updateData: any = {
            replied_at: new Date().toISOString(),
          };

          // If stop_on_reply is enabled, stop the campaign for this lead
          if (campaign.stop_on_reply) {
            updateData.status = 'completed'
            console.log(`[Inbox Scanner] Stopping campaign for ${leadData?.full_name} (stop-on-reply)`);
          }

          await supabase
            .from('campaign_leads')
            .update(updateData)
            .eq('id', matchingLead.id);

          repliedCount++;

          // TODO: Optionally save the reply message to a separate table
          // This could be used for analytics or showing conversation history
        }
      }
    }

    console.log(`[Inbox Scanner] Updated ${repliedCount} leads with replies`);

    return { success: true, scanned: results.length, repliedCount };
  } catch (error: any) {
    console.error('[Inbox Scanner] Error:', error);
    throw error;
  }
}

/**
 * Create and start the worker
 */
const inboxScannerWorker = new Worker(INBOX_SCANNER, processInboxScan, {
  connection: redisConnection as any, // Type assertion to resolve ioredis version conflicts
  concurrency: 1, // Only scan one inbox at a time
  limiter: {
    max: 2, // Max 2 scans per minute
    duration: 60000,
  },
});

inboxScannerWorker.on('completed', (job) => {
  console.log(`[Inbox Scanner Worker] Job ${job.id} completed`);
});

inboxScannerWorker.on('failed', (job, err) => {
  console.error(`[Inbox Scanner Worker] Job ${job?.id} failed:`, err.message);
});

inboxScannerWorker.on('error', (err) => {
  console.error('[Inbox Scanner Worker] Error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Inbox Scanner Worker] Shutting down...');
  await inboxScannerWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Inbox Scanner Worker] Shutting down...');
  await inboxScannerWorker.close();
  process.exit(0);
});

console.log('[Inbox Scanner Worker] Started and waiting for jobs...');

export default inboxScannerWorker;
