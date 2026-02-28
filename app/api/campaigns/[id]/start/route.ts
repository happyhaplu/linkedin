/**
 * Start Campaign API
 * POST /api/campaigns/[id]/start
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { startCampaign } from '@/lib/campaign-executor';

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

    // Check if campaign is already active
    if (campaign.status === 'active') {
      return NextResponse.json(
        { error: 'Campaign is already active' },
        { status: 400 }
      );
    }

    // Start the campaign
    const result = await startCampaign(campaignId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        queuedCount: result.queuedCount,
      });
    } else {
      return NextResponse.json(
        { error: result.message || 'Failed to start campaign' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Start campaign error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
