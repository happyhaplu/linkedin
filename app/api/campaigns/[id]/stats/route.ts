/**
 * Campaign Stats API
 * GET /api/campaigns/[id]/stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getQueueStats } from '@/lib/queue/campaign-queue';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaignId = params.id;

    // Verify campaign belongs to user
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, user_id, name, status')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Get campaign lead stats
    const { data: leadStats, error: statsError } = await supabase
      .from('campaign_leads')
      .select('status')
      .eq('campaign_id', campaignId);

    if (statsError) {
      throw statsError;
    }

    // Count by status (only valid campaign_leads statuses)
    const stats = {
      total: leadStats.length,
      pending: leadStats.filter((l) => l.status === 'pending').length,
      in_progress: leadStats.filter((l) => l.status === 'in_progress').length,
      paused: leadStats.filter((l) => l.status === 'paused').length,
      completed: leadStats.filter((l) => l.status === 'completed').length,
      failed: leadStats.filter((l) => l.status === 'failed').length,
      removed: leadStats.filter((l) => l.status === 'removed').length,
    };

    // Get queue stats
    const queueStats = await getQueueStats('CAMPAIGN_PROCESSOR');

    // Get sender stats
    const { data: senderStats, error: senderError } = await supabase
      .from('campaign_senders')
      .select('linkedin_account_id, connection_sent, connection_accepted, messages_sent, replies_received')
      .eq('campaign_id', campaignId);

    const senders = senderStats || [];

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
      },
      leads: stats,
      queue: queueStats,
      senders: senders,
    });
  } catch (error: any) {
    console.error('Get stats error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
