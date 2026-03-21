import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/db/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // Verify campaign belongs to user
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!campaign) {
    return new NextResponse('Campaign not found', { status: 404 })
  }

  // Fetch all leads with full detail
  const { data: leads, error } = await supabase
    .from('campaign_leads')
    .select(`
      id,
      status,
      variant,
      connection_sent_at,
      connection_accepted_at,
      first_message_sent_at,
      first_reply_at,
      total_messages_sent,
      total_replies_received,
      created_at,
      lead:leads(
        full_name, first_name, last_name, company,
        position, email, linkedin_url, location
      ),
      sender:campaign_senders(
        linkedin_account:linkedin_accounts(profile_name, email)
      )
    `)
    .eq('campaign_id', params.id)
    .order('created_at', { ascending: true })

  if (error) {
    return new NextResponse('Failed to fetch leads', { status: 500 })
  }

  // Build CSV
  const headers = [
    'Full Name',
    'First Name',
    'Last Name',
    'Company',
    'Position',
    'Email',
    'LinkedIn URL',
    'Location',
    'Status',
    'Variant',
    'Sender',
    'Connection Sent',
    'Connection Accepted',
    'First Message Sent',
    'First Reply',
    'Messages Sent',
    'Messages Received',
    'Added At',
  ]

  const escapeCSV = (val: any): string => {
    if (val === null || val === undefined) return ''
    const str = String(val)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const rows = (leads || []).map((cl: any) => {
    const lead = Array.isArray(cl.lead) ? cl.lead[0] : cl.lead
    const sender = Array.isArray(cl.sender) ? cl.sender[0] : cl.sender
    const senderAccount = sender?.linkedin_account
    const senderName = Array.isArray(senderAccount)
      ? senderAccount[0]?.profile_name
      : senderAccount?.profile_name

    return [
      lead?.full_name || `${lead?.first_name || ''} ${lead?.last_name || ''}`.trim(),
      lead?.first_name || '',
      lead?.last_name || '',
      lead?.company || '',
      lead?.position || '',
      lead?.email || '',
      lead?.linkedin_url || '',
      lead?.location || '',
      cl.status || '',
      cl.variant || 'A',
      senderName || '',
      cl.connection_sent_at || '',
      cl.connection_accepted_at || '',
      cl.first_message_sent_at || '',
      cl.first_reply_at || '',
      cl.total_messages_sent || 0,
      cl.total_replies_received || 0,
      cl.created_at || '',
    ].map(escapeCSV)
  })

  const csv = [headers, ...rows].map((row) => row.join(',')).join('\r\n')

  const filename = `${campaign.name.replace(/[^a-z0-9]/gi, '_')}_leads_${new Date().toISOString().split('T')[0]}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
