/**
 * Resume Campaign API
 * POST /api/campaigns/[id]/resume
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/server';
import { resumeCampaign } from '@/lib/campaign-executor';

export async function POST(
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

    // Check if campaign is paused
    if (campaign.status !== 'paused') {
      return NextResponse.json(
        { error: 'Campaign is not paused' },
        { status: 400 }
      );
    }

    // Resume the campaign
    const result = await resumeCampaign(campaignId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        queuedCount: result.queuedCount,
      });
    } else {
      return NextResponse.json(
        { error: result.message || 'Failed to resume campaign' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Resume campaign error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
