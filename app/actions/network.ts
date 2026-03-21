'use server'

import { createClient } from '@/lib/db/server'
import { revalidatePath } from 'next/cache'
import type { NetworkConnection, ConnectionRequest, NetworkSyncLog, LinkedInAccount } from '@/types/linkedin'

// ============= NETWORK CONNECTIONS =============

export async function getNetworkConnections(filters?: {
  linkedin_account_id?: string
  connection_status?: string
  search?: string
  is_favorite?: boolean
  tags?: string[]
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  let query = supabase
    .from('network_connections')
    .select(`
      *,
      linkedin_account:linkedin_accounts(*)
    `)
    .eq('user_id', user.id)

  if (filters?.linkedin_account_id) {
    query = query.eq('linkedin_account_id', filters.linkedin_account_id)
  }

  if (filters?.connection_status) {
    query = query.eq('connection_status', filters.connection_status)
  }

  if (filters?.is_favorite !== undefined) {
    query = query.eq('is_favorite', filters.is_favorite)
  }

  if (filters?.search) {
    query = query.or(`full_name.ilike.%${filters.search}%,company.ilike.%${filters.search}%,position.ilike.%${filters.search}%,headline.ilike.%${filters.search}%`)
  }

  if (filters?.tags && filters.tags.length > 0) {
    query = query.overlaps('tags', filters.tags)
  }

  query = query.order('connected_at', { ascending: false })

  const { data, error } = await query

  if (error) throw error
  return data as (NetworkConnection & { linkedin_account: LinkedInAccount })[]
}

export async function getConnectionStats() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get total connections
  const { count: totalConnections } = await supabase
    .from('network_connections')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('connection_status', 'connected')

  // Get pending requests sent
  const { count: pendingSent } = await supabase
    .from('connection_requests')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('request_type', 'sent')
    .eq('request_status', 'pending')

  // Get pending requests received
  const { count: pendingReceived } = await supabase
    .from('connection_requests')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('request_type', 'received')
    .eq('request_status', 'pending')

  // Get favorites
  const { count: favorites } = await supabase
    .from('network_connections')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_favorite', true)

  return {
    totalConnections: totalConnections || 0,
    pendingSent: pendingSent || 0,
    pendingReceived: pendingReceived || 0,
    favorites: favorites || 0
  }
}

export async function createConnection(formData: {
  linkedin_account_id: string
  connection_linkedin_url?: string
  connection_profile_id?: string
  first_name?: string
  last_name?: string
  full_name?: string
  headline?: string
  profile_picture_url?: string
  location?: string
  company?: string
  position?: string
  connected_at?: string
  tags?: string[]
  notes?: string
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('network_connections')
    .insert({
      user_id: user.id,
      ...formData,
      connection_status: 'connected',
      connected_at: formData.connected_at || new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw error

  try {
    revalidatePath('/my-network')
  } catch (e) {
    console.log('⚠️ Revalidation skipped')
  }
  return data as NetworkConnection
}

export async function updateConnection(connectionId: string, formData: Partial<NetworkConnection>) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('network_connections')
    .update({
      ...formData,
      updated_at: new Date().toISOString()
    })
    .eq('id', connectionId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error

  try {
    revalidatePath('/my-network')
  } catch (e) {
    console.log('⚠️ Revalidation skipped')
  }
  return data as NetworkConnection
}

export async function deleteConnection(connectionId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('network_connections')
    .delete()
    .eq('id', connectionId)
    .eq('user_id', user.id)

  if (error) throw error

  try {
    revalidatePath('/my-network')
  } catch (e) {
    console.log('⚠️ Revalidation skipped')
  }
}

export async function toggleFavorite(connectionId: string, isFavorite: boolean) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('network_connections')
    .update({
      is_favorite: isFavorite,
      updated_at: new Date().toISOString()
    })
    .eq('id', connectionId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error

  try {
    revalidatePath('/my-network')
  } catch (e) {
    console.log('⚠️ Revalidation skipped')
  }
  return data as NetworkConnection
}

export async function bulkDeleteConnections(connectionIds: string[]) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('network_connections')
    .delete()
    .in('id', connectionIds)
    .eq('user_id', user.id)

  if (error) throw error

  try {
    revalidatePath('/my-network')
  } catch (e) {
    console.log('⚠️ Revalidation skipped')
  }
}

export async function bulkUpdateConnectionTags(connectionIds: string[], tags: string[]) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('network_connections')
    .update({
      tags,
      updated_at: new Date().toISOString()
    })
    .in('id', connectionIds)
    .eq('user_id', user.id)

  if (error) throw error

  try {
    revalidatePath('/my-network')
  } catch (e) {
    console.log('⚠️ Revalidation skipped')
  }
}

// ============= CONNECTION REQUESTS =============

export async function getConnectionRequests(filters?: {
  linkedin_account_id?: string
  request_type?: string
  request_status?: string
  search?: string
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  let query = supabase
    .from('connection_requests')
    .select(`
      *,
      linkedin_account:linkedin_accounts(*)
    `)
    .eq('user_id', user.id)

  if (filters?.linkedin_account_id) {
    query = query.eq('linkedin_account_id', filters.linkedin_account_id)
  }

  if (filters?.request_type) {
    query = query.eq('request_type', filters.request_type)
  }

  if (filters?.request_status) {
    query = query.eq('request_status', filters.request_status)
  }

  if (filters?.search) {
    query = query.or(`full_name.ilike.%${filters.search}%,company.ilike.%${filters.search}%,position.ilike.%${filters.search}%`)
  }

  query = query.order('sent_at', { ascending: false })

  const { data, error } = await query

  if (error) throw error
  return data as (ConnectionRequest & { linkedin_account: LinkedInAccount })[]
}

export async function createConnectionRequest(formData: {
  linkedin_account_id: string
  target_linkedin_url: string
  target_profile_id?: string
  first_name?: string
  last_name?: string
  full_name?: string
  headline?: string
  profile_picture_url?: string
  location?: string
  company?: string
  position?: string
  request_type: 'sent' | 'received'
  message?: string
  campaign_id?: string
  is_automated?: boolean
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('connection_requests')
    .insert({
      user_id: user.id,
      ...formData,
      request_status: 'pending',
      sent_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw error

  try {
    revalidatePath('/my-network')
  } catch (e) {
    console.log('⚠️ Revalidation skipped')
  }
  return data as ConnectionRequest
}

export async function updateConnectionRequest(requestId: string, formData: Partial<ConnectionRequest>) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('connection_requests')
    .update({
      ...formData,
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error

  try {
    revalidatePath('/my-network')
  } catch (e) {
    console.log('⚠️ Revalidation skipped')
  }
  return data as ConnectionRequest
}

export async function acceptConnectionRequest(requestId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Update request status
  const { data: request, error: updateError } = await supabase
    .from('connection_requests')
    .update({
      request_status: 'accepted',
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (updateError) throw updateError

  // Create network connection
  const connectionRequest = request as ConnectionRequest
  
  await supabase
    .from('network_connections')
    .insert({
      user_id: user.id,
      linkedin_account_id: connectionRequest.linkedin_account_id,
      connection_linkedin_url: connectionRequest.target_linkedin_url,
      connection_profile_id: connectionRequest.target_profile_id,
      first_name: connectionRequest.first_name,
      last_name: connectionRequest.last_name,
      full_name: connectionRequest.full_name,
      headline: connectionRequest.headline,
      profile_picture_url: connectionRequest.profile_picture_url,
      location: connectionRequest.location,
      company: connectionRequest.company,
      position: connectionRequest.position,
      connection_status: 'connected',
      connected_at: new Date().toISOString()
    })

  try { revalidatePath('/my-network') } catch (e) { /* skip */ }
  return request as ConnectionRequest
}

export async function withdrawConnectionRequest(requestId: string) {
  return await updateConnectionRequest(requestId, {
    request_status: 'withdrawn',
    responded_at: new Date().toISOString()
  })
}

export async function deleteConnectionRequest(requestId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('connection_requests')
    .delete()
    .eq('id', requestId)
    .eq('user_id', user.id)

  if (error) throw error

  try {
    revalidatePath('/my-network')
  } catch (e) {
    console.log('⚠️ Revalidation skipped')
  }
}

export async function bulkWithdrawRequests(requestIds: string[]) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('connection_requests')
    .update({
      request_status: 'withdrawn',
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .in('id', requestIds)
    .eq('user_id', user.id)

  if (error) throw error

  try {
    revalidatePath('/my-network')
  } catch (e) {
    console.log('⚠️ Revalidation skipped')
  }
}

// ============= NETWORK SYNC =============

export async function syncNetworkFromLinkedIn(
  linkedinAccountId: string,
  syncType: 'full' | 'incremental' | 'connection_requests' = 'full'
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Create sync log
  const { data: syncLog, error: logError } = await supabase
    .from('network_sync_logs')
    .insert({
      user_id: user.id,
      linkedin_account_id: linkedinAccountId,
      sync_type: syncType,
      sync_status: 'in_progress',
      started_at: new Date().toISOString()
    })
    .select()
    .single()

  if (logError) throw logError

  try {
    // Get LinkedIn account details
    const { data: account, error: accountError } = await supabase
      .from('linkedin_accounts')
      .select('*')
      .eq('id', linkedinAccountId)
      .eq('user_id', user.id)
      .single()

    if (accountError || !account) {
      throw new Error('LinkedIn account not found or unauthorized')
    }

    if (account.status !== 'active') {
      throw new Error('LinkedIn account is not active. Please reconnect your account.')
    }

    if (!account.session_cookies?.li_at) {
      throw new Error('No valid session found. Please reconnect your account.')
    }

    console.log('🔄 Starting network sync for account:', account.email)

    // Import the network sync module
    const { syncLinkedInNetwork } = await import('@/lib/linkedin-network-sync')
    
    // Perform actual sync with all cookies
    const results = await syncLinkedInNetwork(
      account.session_cookies,
      linkedinAccountId,
      user.id,
      syncType
    )

    console.log('✅ Sync completed:', results)

    console.log('✅ Sync completed:', results)

    // Update sync log as completed
    const completedAt = new Date().toISOString()
    const startedAt = new Date(syncLog.started_at)
    const durationSeconds = Math.floor((new Date(completedAt).getTime() - startedAt.getTime()) / 1000)

    await supabase
      .from('network_sync_logs')
      .update({
        sync_status: 'completed',
        completed_at: completedAt,
        duration_seconds: durationSeconds,
        total_connections_synced: results.total_connections_synced,
        new_connections_added: results.new_connections_added,
        connections_updated: results.connections_updated,
        total_requests_synced: results.total_requests_synced || 0,
        pending_requests: results.pending_requests || 0,
        accepted_requests: results.accepted_requests || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', syncLog.id)

    try {
      revalidatePath('/my-network')
    } catch (e) {
      console.log('⚠️ Revalidation skipped')
    }
    
    return {
      success: true,
      syncLogId: syncLog.id,
      results
    }
  } catch (error: any) {
    // Update sync log as failed
    await supabase
      .from('network_sync_logs')
      .update({
        sync_status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', syncLog.id)

    throw error
  }
}

export async function getSyncLogs(linkedinAccountId?: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  let query = supabase
    .from('network_sync_logs')
    .select(`
      *,
      linkedin_account:linkedin_accounts(*)
    `)
    .eq('user_id', user.id)

  if (linkedinAccountId) {
    query = query.eq('linkedin_account_id', linkedinAccountId)
  }

  query = query.order('created_at', { ascending: false }).limit(50)

  const { data, error } = await query

  if (error) throw error
  return data as (NetworkSyncLog & { linkedin_account: LinkedInAccount })[]
}

export async function getLatestSyncLog(linkedinAccountId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('network_sync_logs')
    .select(`
      *,
      linkedin_account:linkedin_accounts(*)
    `)
    .eq('user_id', user.id)
    .eq('linkedin_account_id', linkedinAccountId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as (NetworkSyncLog & { linkedin_account: LinkedInAccount }) | null
}

// ============= ANALYTICS =============

export async function getNetworkAnalytics(linkedinAccountId?: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  let connectionQuery = supabase
    .from('network_connections')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('connection_status', 'connected')

  let requestQuery = supabase
    .from('connection_requests')
    .select('*')
    .eq('user_id', user.id)

  if (linkedinAccountId) {
    connectionQuery = connectionQuery.eq('linkedin_account_id', linkedinAccountId)
    requestQuery = requestQuery.eq('linkedin_account_id', linkedinAccountId)
  }

  const { count: totalConnections } = await connectionQuery
  const { data: requests } = await requestQuery

  const pendingSent = requests?.filter((r: any) => r.request_type === 'sent' && r.request_status === 'pending').length || 0
  const acceptedRequests = requests?.filter((r: any) => r.request_status === 'accepted').length || 0
  const declinedRequests = requests?.filter((r: any) => r.request_status === 'declined').length || 0

  return {
    totalConnections: totalConnections || 0,
    pendingSent,
    acceptedRequests,
    declinedRequests,
    acceptanceRate: acceptedRequests > 0 ? ((acceptedRequests / (acceptedRequests + declinedRequests)) * 100).toFixed(1) : '0'
  }
}
