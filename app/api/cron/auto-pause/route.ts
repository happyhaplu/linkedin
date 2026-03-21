import { NextRequest, NextResponse } from 'next/server'
import { DbClient } from '@/lib/db/query-builder'
import { checkAcceptanceRateCircuitBreaker } from '@/lib/campaign-executor'

/**
 * Cron endpoint — auto-pause campaigns with dangerously low acceptance rates.
 *
 * Set up a cron job (Vercel Cron, cron-job.org, GitHub Actions, etc.) to call
 * this endpoint every hour:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/auto-pause
 *
 * Set CRON_SECRET in your environment variables.
 */
export async function GET(request: NextRequest) {
  // Validate shared secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = new DbClient()

  try {
    // Fetch all active campaigns
    const { data: activeCampaigns, error } = await supabase
      .from('campaigns')
      .select('id, name, connection_sent, connection_accepted, auto_pause_below_acceptance')
      .eq('status', 'active')

    if (error) {
      throw error
    }

    const results: { campaignId: string; action: string; reason?: string }[] = []

    for (const campaign of activeCampaigns || []) {
      try {
        await checkAcceptanceRateCircuitBreaker(campaign.id)

        // Check if we just paused it
        const { data: updated } = await supabase
          .from('campaigns')
          .select('status')
          .eq('id', campaign.id)
          .single()

        if (updated?.status === 'paused') {
          const sent = campaign.connection_sent || 0
          const accepted = campaign.connection_accepted || 0
          const rate = sent > 0 ? ((accepted / sent) * 100).toFixed(1) : '0'
          const threshold = ((campaign.auto_pause_below_acceptance ?? 0.15) * 100).toFixed(0)

          results.push({
            campaignId: campaign.id,
            action: 'paused',
            reason: `Acceptance rate ${rate}% < ${threshold}% threshold`,
          })

          console.log(`[AutoPause Cron] Campaign ${campaign.name} (${campaign.id}) auto-paused. Rate: ${rate}%`)
        } else {
          results.push({ campaignId: campaign.id, action: 'ok' })
        }
      } catch (err: any) {
        results.push({ campaignId: campaign.id, action: 'error', reason: err.message })
      }
    }

    const paused = results.filter(r => r.action === 'paused').length

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      totalChecked: activeCampaigns?.length ?? 0,
      paused,
      results,
    })
  } catch (err: any) {
    console.error('[AutoPause Cron] Fatal error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
