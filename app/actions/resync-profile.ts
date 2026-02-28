// Server action to re-sync profile data for existing accounts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Auto-disconnect account if LinkedIn session is invalid
 */
async function handleAccountDisconnection(accountId: string, errorMessage: string): Promise<void> {
  try {
    const supabase = await createClient()
    
    // Check if error indicates account restriction/logout
    const errorLower = errorMessage.toLowerCase()
    const shouldDisconnect = 
      errorLower.includes('restricted') ||
      errorLower.includes('suspended') ||
      errorLower.includes('banned') ||
      errorLower.includes('logged out') ||
      errorLower.includes('session expired') ||
      errorLower.includes('unauthorized') ||
      errorLower.includes('login required') ||
      errorLower.includes('cookies expired') ||
      errorLower.includes('too many redirects') ||
      errorLower.includes('authwall') ||
      errorLower.includes('err_too_many_redirects') ||
      errorLower.includes('auth_failed')
    
    if (shouldDisconnect) {
      console.log(`🔴 Auto-disconnecting account ${accountId}: ${errorMessage}`)
      
      await supabase
        .from('linkedin_accounts')
        .update({
          status: 'disconnected',
          error_message: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', accountId)
      
      console.log('✅ Account marked as disconnected')
      
      // Refresh the frontend
      try {
        revalidatePath('/linkedin-account')
      } catch (e) {
        console.log('⚠️ Revalidation skipped')
      }
    }
  } catch (error) {
    console.error('Failed to auto-disconnect account:', error)
  }
}

export async function resyncAccountProfile(accountId: string) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Get the account
    const { data: account, error: accountError } = await supabase
      .from('linkedin_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single()

    if (accountError || !account) {
      throw new Error('Account not found')
    }

    if (!account.session_cookies?.li_at) {
      throw new Error('No session cookie found. Please reconnect your account.')
    }

    console.log('🔄 Re-syncing profile data for:', account.email)

    // Import the cookie auth module to extract profile data
    const { loginWithCookie } = await import('@/lib/linkedin-cookie-auth')
    
    // Pass full cookie object (JSON) so JSESSIONID is available for API calls
    const cookieInput = typeof account.session_cookies === 'object'
      ? JSON.stringify(account.session_cookies)
      : account.session_cookies.li_at
    
    const result = await loginWithCookie(account.email, cookieInput)
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to sync profile data')
    }

    console.log('👤 Profile data extracted:', result.profileData)

    // Update account with new profile data
    const { error: updateError } = await supabase
      .from('linkedin_accounts')
      .update({
        profile_name: result.profileData?.name || null,
        profile_picture_url: result.profileData?.profilePictureUrl || null,
        headline: result.profileData?.headline || null,
        job_title: result.profileData?.jobTitle || null,
        company: result.profileData?.company || null,
        location: result.profileData?.location || null,
        profile_url: result.profileData?.profileUrl || null,
        connections_count: result.profileData?.connectionsCount || null,
        about: result.profileData?.about || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', accountId)

    if (updateError) {
      console.error('❌ Update error:', updateError)
      throw updateError
    }

    console.log('✅ Profile data synced successfully!')
    
    try {
      revalidatePath('/linkedin-account')
    } catch (e) {
      console.log('⚠️ Revalidation skipped')
    }
    
    return {
      success: true,
      message: 'Profile data synced successfully!',
      data: result.profileData
    }
  } catch (error: any) {
    console.error('❌ Resync error:', error)
    
    // Auto-disconnect account if session invalid
    if (accountId) {
      await handleAccountDisconnection(accountId, error.message || 'Profile resync failed')
    }
    
    throw error
  }
}

/**
 * Safe version of resyncAccountProfile that does NOT auto-disconnect on failure.
 * Use this for background/cosmetic syncs (e.g., auto-syncing missing profile names)
 * where you don't want a stale cookie to nuke the account status.
 */
export async function resyncAccountProfileSafe(accountId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: account, error: accountError } = await supabase
      .from('linkedin_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single()

    if (accountError || !account) throw new Error('Account not found')
    if (!account.session_cookies?.li_at) throw new Error('No session cookie')

    console.log('🔄 [Safe] Re-syncing profile for:', account.email)

    const { loginWithCookie } = await import('@/lib/linkedin-cookie-auth')
    const cookieInput = typeof account.session_cookies === 'object'
      ? JSON.stringify(account.session_cookies)
      : account.session_cookies.li_at

    const result = await loginWithCookie(account.email, cookieInput)

    if (!result.success) {
      console.log(`⚠️ [Safe] Profile sync failed for ${account.email}: ${result.message} — NOT disconnecting`)
      return { success: false, message: result.message }
    }

    console.log('👤 [Safe] Profile data extracted:', result.profileData)

    await supabase
      .from('linkedin_accounts')
      .update({
        profile_name: result.profileData?.name || null,
        profile_picture_url: result.profileData?.profilePictureUrl || null,
        headline: result.profileData?.headline || null,
        job_title: result.profileData?.jobTitle || null,
        company: result.profileData?.company || null,
        location: result.profileData?.location || null,
        profile_url: result.profileData?.profileUrl || null,
        connections_count: result.profileData?.connectionsCount || null,
        about: result.profileData?.about || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', accountId)

    console.log('✅ [Safe] Profile data synced!')
    return { success: true, message: 'Profile synced', data: result.profileData }
  } catch (error: any) {
    console.error(`⚠️ [Safe] Resync failed: ${error.message} — NOT disconnecting`)
    return { success: false, message: error.message }
  }
}
