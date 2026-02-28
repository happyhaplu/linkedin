/**
 * Outbound Webhook Utility
 *
 * Fires HTTP POST requests to user-configured URLs on key campaign events:
 *  - connection_sent
 *  - connection_accepted
 *  - message_sent
 *  - replied
 *  - campaign_paused (auto-pause or manual)
 *  - campaign_completed
 *
 * Webhooks are retried up to 3 times with exponential back-off.
 * Failures are logged but never bubble up to prevent blocking the main flow.
 */

import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null
function getSupabase() {
  if (!_supabase) {
    _supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _supabase
}

export type WebhookEvent =
  | 'connection_sent'
  | 'connection_accepted'
  | 'message_sent'
  | 'replied'
  | 'campaign_paused'
  | 'campaign_completed'

export interface WebhookPayload {
  event: WebhookEvent
  campaign_id: string
  campaign_name: string
  timestamp: string
  lead?: {
    id: string
    full_name: string
    company?: string
    position?: string
    linkedin_url?: string
  }
  meta?: Record<string, unknown>
}

/**
 * Deliver a webhook with up to 3 retries using exponential back-off.
 */
async function deliverWebhook(
  url: string,
  payload: WebhookPayload,
  secret?: string | null
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const body = JSON.stringify(payload)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'LinkedIn-Automation-Webhooks/1.0',
    'X-Webhook-Event': payload.event,
    'X-Webhook-Timestamp': payload.timestamp,
  }

  // HMAC signature for verification (optional)
  if (secret) {
    try {
      const { createHmac } = await import('crypto')
      const sig = createHmac('sha256', secret).update(body).digest('hex')
      headers['X-Webhook-Signature'] = `sha256=${sig}`
    } catch { /* crypto unavailable in edge, skip */ }
  }

  const MAX_RETRIES = 3
  let lastError = ''

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10_000), // 10s timeout per attempt
      })

      if (response.ok) {
        return { success: true, statusCode: response.status }
      }

      lastError = `HTTP ${response.status}`
    } catch (err: any) {
      lastError = err?.message || 'Network error'
    }

    // Exponential back-off: 1s → 2s → 4s
    if (attempt < MAX_RETRIES - 1) {
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
    }
  }

  return { success: false, error: lastError }
}

/**
 * Main entry point: look up webhooks for a campaign and fire them.
 * Safe to call fire-and-forget; all errors are caught internally.
 */
export async function triggerWebhook(
  event: WebhookEvent,
  campaignId: string,
  campaignName: string,
  leadData?: WebhookPayload['lead'],
  meta?: Record<string, unknown>
): Promise<void> {
  try {
    // Fetch active webhooks for this campaign
    const { data: webhooks } = await getSupabase()
      .from('campaign_webhooks')
      .select('id, url, secret, events')
      .eq('campaign_id', campaignId)
      .eq('is_active', true)

    if (!webhooks || webhooks.length === 0) return

    const payload: WebhookPayload = {
      event,
      campaign_id: campaignId,
      campaign_name: campaignName,
      timestamp: new Date().toISOString(),
      ...(leadData && { lead: leadData }),
      ...(meta && { meta }),
    }

    // Deliver in parallel; don't await — fire-and-forget with logging
    for (const wh of webhooks) {
      // Check if this webhook listens to this event
      const listenedEvents: string[] = wh.events || []
      if (listenedEvents.length > 0 && !listenedEvents.includes(event)) continue

      deliverWebhook(wh.url, payload, wh.secret)
        .then(result => {
          if (!result.success) {
            console.warn(`[Webhook] Failed delivery to ${wh.url} (${wh.id}): ${result.error}`)
            // Log failure in DB (best-effort)
            getSupabase()
              .from('campaign_webhook_logs')
              .insert({
                webhook_id: wh.id,
                campaign_id: campaignId,
                event,
                success: false,
                error_message: result.error,
              })
              .then(() => {})
          } else {
            getSupabase()
              .from('campaign_webhook_logs')
              .insert({
                webhook_id: wh.id,
                campaign_id: campaignId,
                event,
                success: true,
                status_code: result.statusCode,
              })
              .then(() => {})
          }
        })
        .catch(err => {
          console.error(`[Webhook] Unexpected error for ${wh.url}:`, err)
        })
    }
  } catch (err) {
    console.error('[Webhook] Error looking up webhooks:', err)
  }
}
