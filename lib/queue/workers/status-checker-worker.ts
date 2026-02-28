/**
 * Status Checker Worker
 * 
 * Polls LinkedIn to check connection request status
 * - Runs hourly for pending connections
 * - Updates campaign_leads when accepted/declined
 * - Triggers next campaign steps when accepted
 */

import { Worker, Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import { checkConnectionStatus } from '@/lib/linkedin-campaign-automation';
import { redisConnection, STATUS_CHECKER, addCampaignLeadJob } from '../campaign-queue';
import { calculateDelay } from '@/lib/campaign-executor';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface StatusCheckJob {
  campaign_lead_id: string;
  campaign_id: string;
  lead_id: string;
  sender_account_id: string;
}

/**
 * Process status check job
 */
async function processStatusCheck(job: Job<StatusCheckJob>) {
  const { campaign_lead_id, campaign_id, lead_id, sender_account_id } = job.data;

  console.log(`[Status Checker] Checking status for lead ${campaign_lead_id}`);

  try {
    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('linkedin_url, full_name')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      throw new Error('Lead not found');
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

    // Check connection status via Playwright
    const statusResult = await checkConnectionStatus(
      {
        id: account.id,
        email: account.email,
        password: account.password,
        cookies: account.cookies ? JSON.parse(account.cookies) : [],
        proxy_url: account.proxy_url,
      },
      {
        linkedin_url: lead.linkedin_url,
        full_name: lead.full_name,
      }
    );

    console.log(`[Status Checker] Status for ${lead.full_name}: ${statusResult.status}`);

    // Update database based on status
    if (statusResult.status === 'accepted') {
      await supabase
        .from('campaign_leads')
        .update({
          status: 'in_progress',
          connection_accepted_at: new Date().toISOString(),
        })
        .eq('id', campaign_lead_id);

      console.log(`[Status Checker] Connection accepted for ${lead.full_name}`);

      // Trigger next campaign step after connection accepted
      try {
        const { data: campaignLead } = await supabase
          .from('campaign_leads')
          .select('id, sender_account_id')
          .eq('id', campaign_lead_id)
          .single();

        // Find the first "accepted" conditional step branching from the connection step
        const { data: nextSteps } = await supabase
          .from('campaign_sequences')
          .select('*')
          .eq('campaign_id', campaign_id)
          .eq('condition_type', 'accepted')
          .order('step_number', { ascending: true })
          .limit(1);

        // Fallback: find next step by step_number order
        const { data: allSteps } = nextSteps?.length
          ? { data: nextSteps }
          : await supabase
              .from('campaign_sequences')
              .select('*')
              .eq('campaign_id', campaign_id)
              .order('step_number', { ascending: true })
              .range(1, 1); // 2nd step

        if (allSteps && allSteps.length > 0 && campaignLead) {
          const { data: campaign } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', campaign_id)
            .single();

          const nextStep = allSteps[0];
          const delay = calculateDelay(nextStep, campaign);

          await addCampaignLeadJob({
            campaign_id,
            campaign_lead_id,
            lead_id,
            sender_account_id: campaignLead.sender_account_id || sender_account_id,
            step_id: nextStep.id,
            step_type: nextStep.step_type,
            message_template: nextStep.message_template,
            subject_template: nextStep.subject_template,
            delay_days: nextStep.delay_days,
            delay_hours: nextStep.delay_hours,
          }, delay);

          console.log(`[Status Checker] Queued next step (${nextStep.step_type}) for ${lead.full_name} in ${Math.round(delay / 60000)} min`);
        }
      } catch (nextStepErr) {
        console.error('[Status Checker] Failed to queue next step:', nextStepErr);
      }
    } else if (statusResult.status === 'not_connected') {
      // Connection request might have been withdrawn or declined
      await supabase
        .from('campaign_leads')
        .update({
          status: 'failed',
        })
        .eq('id', campaign_lead_id);

      console.log(`[Status Checker] Connection not found for ${lead.full_name}`);
    } else if (statusResult.status === 'pending') {
      // Still pending, check again later
      console.log(`[Status Checker] Connection still pending for ${lead.full_name}`);

      // Check if it's been more than 7 days
      const { data: campaignLead } = await supabase
        .from('campaign_leads')
        .select('connection_sent_at')
        .eq('id', campaign_lead_id)
        .single();

      if (campaignLead?.connection_sent_at) {
        const sentDate = new Date(campaignLead.connection_sent_at);
        const daysSince = (Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSince > 7) {
          // Mark as timed out
          await supabase
            .from('campaign_leads')
            .update({
              status: 'failed',
            })
            .eq('id', campaign_lead_id);

          console.log(`[Status Checker] Connection timed out for ${lead.full_name}`);
        }
      }
    }

    return { success: true, status: statusResult.status };
  } catch (error: any) {
    console.error('[Status Checker] Error:', error);
    throw error;
  }
}

/**
 * Create and start the worker
 */
const statusCheckerWorker = new Worker(STATUS_CHECKER, processStatusCheck, {
  connection: redisConnection as any, // Type assertion to resolve ioredis version conflicts
  concurrency: 3, // Check 3 statuses at a time
  limiter: {
    max: 5, // Max 5 jobs per minute (avoid rate limiting)
    duration: 60000,
  },
});

statusCheckerWorker.on('completed', (job) => {
  console.log(`[Status Checker Worker] Job ${job.id} completed`);
});

statusCheckerWorker.on('failed', (job, err) => {
  console.error(`[Status Checker Worker] Job ${job?.id} failed:`, err.message);
});

statusCheckerWorker.on('error', (err) => {
  console.error('[Status Checker Worker] Error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Status Checker Worker] Shutting down...');
  await statusCheckerWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Status Checker Worker] Shutting down...');
  await statusCheckerWorker.close();
  process.exit(0);
});

console.log('[Status Checker Worker] Started and waiting for jobs...');

export default statusCheckerWorker;
