'use server'

import { createClient } from '@/lib/db/server'
import { checkAccountHealth } from '@/lib/utils/linkedin-auth'

export async function monitorAccountHealth(accountId?: string) {
  const supabase = await createClient()
  
  // Get accounts to monitor
  let query = supabase
    .from('linkedin_accounts')
    .select('*')
  
  if (accountId) {
    query = query.eq('id', accountId)
  }
  
  const { data: accounts, error } = await query
  
  if (error) throw error
  if (!accounts || accounts.length === 0) return { monitored: 0 }

  let monitoredCount = 0

  for (const account of accounts) {
    try {
      // Check account health
      const health = await checkAccountHealth(account)
      
      // Update account status
      await supabase
        .from('linkedin_accounts')
        .update({
          status: health.status,
          error_message: health.errorMessage || null,
          last_activity_at: health.status === 'active' ? new Date().toISOString() : account.last_activity_at,
          updated_at: new Date().toISOString()
        })
        .eq('id', account.id)

      // Log health check
      await supabase
        .from('account_health_logs')
        .insert({
          linkedin_account_id: account.id,
          status: health.status,
          error_message: health.errorMessage || null,
          session_valid: health.status === 'active',
          response_time: null
        })

      monitoredCount++
    } catch (error) {
      console.error(`Failed to monitor account ${account.id}:`, error)
    }
  }

  return { monitored: monitoredCount }
}

export async function getAccountHealthHistory(accountId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('account_health_logs')
    .select('*')
    .eq('linkedin_account_id', accountId)
    .order('checked_at', { ascending: false })
    .limit(50)
  
  if (error) throw error
  return data
}
