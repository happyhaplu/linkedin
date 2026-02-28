'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { LinkedInAccount, Proxy } from '@/types/linkedin'
import { loginToLinkedIn, continueLinkedInLogin } from '@/lib/linkedin-automation'

export async function getLinkedInAccounts() {
  const supabase = await createClient()
  
  const { data: accounts, error } = await supabase
    .from('linkedin_accounts')
    .select(`
      *,
      proxy:proxies(*)
    `)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return accounts as (LinkedInAccount & { proxy?: Proxy })[]
}

export async function createLinkedInAccount(formData: {
  email: string
  password: string
  connection_method: string
  proxy_id?: string
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(formData.email)) {
    throw new Error('Invalid email format')
  }

  console.log('🔐 Starting automated LinkedIn login for:', formData.email)
  
  // Use Puppeteer to automate LinkedIn login and extract cookies
  const loginResult = await loginToLinkedIn(formData.email, formData.password)
  
  if (!loginResult.success) {
    // Handle specific errors
    if (loginResult.error === '2FA_REQUIRED' || loginResult.error === 'SECURITY_CHECKPOINT') {
      // Create account in pending state
      const { data, error } = await supabase
        .from('linkedin_accounts')
        .insert({
          user_id: user.id,
          email: formData.email,
          password_encrypted: null,
          connection_method: 'automated',
          proxy_id: formData.proxy_id || null,
          two_fa_enabled: loginResult.error === '2FA_REQUIRED',
          status: 'pending_verification',
          session_id: loginResult.sessionId, // Store session ID
          session_cookies: null,
          error_message: loginResult.error === '2FA_REQUIRED' 
            ? 'Waiting for PIN verification' 
            : 'LinkedIn security checkpoint detected. Please verify manually.',
          last_activity_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (error) throw error
      
      // Return response indicating verification is required
      return {
        requiresPin: loginResult.error === '2FA_REQUIRED',
        requiresManualVerification: loginResult.error === 'SECURITY_CHECKPOINT',
        sessionId: loginResult.sessionId,
        accountId: data.id,
        message: loginResult.error === '2FA_REQUIRED'
          ? 'Account added. Please check your email for the verification code.'
          : 'LinkedIn detected automated access. Please verify your account manually by logging in from a browser, then try again.'
      }
    } else if (loginResult.error === 'INVALID_CREDENTIALS') {
      throw new Error('Invalid LinkedIn email or password')
    } else {
      throw new Error(loginResult.error || 'Failed to connect to LinkedIn')
    }
  }

  if (!loginResult.cookies?.li_at) {
    throw new Error('Failed to extract LinkedIn session')
  }

  console.log('✅ Successfully extracted LinkedIn session cookies')
  
  // Create account with extracted cookies and profile data
  const { data, error } = await supabase
    .from('linkedin_accounts')
    .insert({
      user_id: user.id,
      email: formData.email,
      password_encrypted: null, // Never store password
      connection_method: 'automated',
      proxy_id: formData.proxy_id || null,
      two_fa_enabled: false,
      status: 'active', // Immediately active since we successfully logged in
      session_cookies: loginResult.cookies,
      profile_name: loginResult.profileData?.name || null,
      profile_picture_url: loginResult.profileData?.profilePictureUrl || null,
      headline: loginResult.profileData?.headline || null,
      job_title: loginResult.profileData?.jobTitle || null,
      company: loginResult.profileData?.company || null,
      location: loginResult.profileData?.location || null,
      profile_url: loginResult.profileData?.profileUrl || null,
      connections_count: loginResult.profileData?.connectionsCount || null,
      about: loginResult.profileData?.about || null,
      error_message: null,
      last_activity_at: new Date().toISOString()
    })
    .select()
    .single()
  
  if (error) throw error
  
  console.log('✅ LinkedIn account connected successfully!')
  
  try {
    revalidatePath('/linkedin-account')
  } catch (e) {
    console.log('⚠️ Revalidation skipped')
  }
  return data
}

export async function completeLinkedInAccountWithPin(formData: {
  accountId: string
  pin: string
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get the account to retrieve session_id
  const { data: account, error: fetchError } = await supabase
    .from('linkedin_accounts')
    .select('session_id')
    .eq('id', formData.accountId)
    .single()
  
  if (fetchError || !account?.session_id) {
    throw new Error('Account or session not found')
  }

  console.log('🔐 Completing LinkedIn login with PIN using session:', account.session_id)
  
  // Continue with the existing browser session
  const loginResult = await continueLinkedInLogin(account.session_id, formData.pin)
  
  if (!loginResult.success) {
    // Handle different error types
    let errorMessage = 'Invalid PIN code'
    let shouldThrow = true
    
    if (loginResult.error === 'SESSION_EXPIRED') {
      errorMessage = 'Session expired. Please reconnect.'
    } else if (loginResult.error === 'SECURITY_CHECKPOINT' || loginResult.error === 'PIN_FIELD_NOT_FOUND') {
      errorMessage = 'LinkedIn requires manual verification. Please log in from your browser to verify your account.'
      shouldThrow = true
    } else if (loginResult.error === 'INVALID_CREDENTIALS') {
      errorMessage = 'Invalid PIN code'
    }
    
    // Update account with error
    await supabase
      .from('linkedin_accounts')
      .update({
        error_message: errorMessage,
        updated_at: new Date().toISOString()
      })
      .eq('id', formData.accountId)
    
    if (shouldThrow) {
      throw new Error(errorMessage)
    }
  }

  if (!loginResult.cookies?.li_at) {
    throw new Error('Failed to extract LinkedIn session')
  }

  console.log('✅ Successfully extracted LinkedIn session cookies')
  
  // Update account to active with cookies and profile data
  const { data, error } = await supabase
    .from('linkedin_accounts')
    .update({
      status: 'active',
      session_cookies: loginResult.cookies,
      session_id: null, // Clear session ID after use
      profile_name: loginResult.profileData?.name || null,
      profile_picture_url: loginResult.profileData?.profilePictureUrl || null,
      headline: loginResult.profileData?.headline || null,
      job_title: loginResult.profileData?.jobTitle || null,
      company: loginResult.profileData?.company || null,
      location: loginResult.profileData?.location || null,
      profile_url: loginResult.profileData?.profileUrl || null,
      connections_count: loginResult.profileData?.connectionsCount || null,
      about: loginResult.profileData?.about || null,
      error_message: null,
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', formData.accountId)
    .select()
    .single()
  
  if (error) throw error
  
  console.log('✅ LinkedIn account verified and activated!')
  
  try {
    revalidatePath('/linkedin-account')
  } catch (e) {
    console.log('⚠️ Revalidation skipped')
  }
  return data
}

export async function updateLinkedInAccount(id: string, updates: Partial<LinkedInAccount>) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('linkedin_accounts')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  try {
    revalidatePath('/linkedin-account')
  } catch (e) {
    console.log('⚠️ Revalidation skipped')
  }
  return data
}

export async function updateAccountLimits(accountId: string, limits: {
  connection_requests_per_day: number
  messages_per_day: number
  inmails_per_day: number
}) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('linkedin_accounts')
    .update({
      daily_limits: limits,
      updated_at: new Date().toISOString()
    })
    .eq('id', accountId)
    .select()
    .single()
  
  if (error) throw error
  try {
    revalidatePath('/linkedin-account')
  } catch (e) {
    console.log('⚠️ Revalidation skipped')
  }
  return data
}

export async function updateAccountProxy(accountId: string, proxyId: string | null) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('linkedin_accounts')
    .update({
      proxy_id: proxyId,
      updated_at: new Date().toISOString()
    })
    .eq('id', accountId)
    .select()
    .single()
  
  if (error) throw error
  try {
    revalidatePath('/linkedin-account')
  } catch (e) {
    console.log('⚠️ Revalidation skipped')
  }
  return data
}

export async function deleteLinkedInAccount(id: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('linkedin_accounts')
    .delete()
    .eq('id', id)
  
  if (error) throw error
  try {
    revalidatePath('/linkedin-account')
  } catch (e) {
    console.log('⚠️ Revalidation skipped')
  }
}

export async function toggleAccountStatus(id: string, currentStatus: string) {
  const newStatus = currentStatus === 'active' ? 'paused' : 'active'
  return updateLinkedInAccount(id, { status: newStatus as any })
}

export async function assignCampaignsToAccount(accountId: string, campaignIds: string[]) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('linkedin_accounts')
    .update({
      assigned_campaigns: campaignIds,
      updated_at: new Date().toISOString()
    })
    .eq('id', accountId)
    .select()
    .single()
  
  if (error) throw error
  try {
    revalidatePath('/linkedin-account')
  } catch (e) {
    console.log('⚠️ Revalidation skipped')
  }
  return data
}

export async function verifyOTP(accountId: string, otp: string) {
  const supabase = await createClient()
  
  // In a real implementation, you would:
  // 1. Verify the OTP with LinkedIn's API
  // 2. Get the session cookies after successful verification
  // 3. Update the account status to 'active'
  
  // For now, we'll simulate OTP verification
  // In production, integrate with actual LinkedIn API
  
  if (otp.length !== 6) {
    throw new Error('Invalid OTP format')
  }
  
  // Simulate verification delay
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Get account details
  const { data: account } = await supabase
    .from('linkedin_accounts')
    .select('*')
    .eq('id', accountId)
    .single()
  
  if (!account) {
    throw new Error('Account not found')
  }
  
  // In production: verify OTP and get session cookies from LinkedIn
  // For now, we'll set default sending limits and activate the account
  const { data, error } = await supabase
    .from('linkedin_accounts')
    .update({
      status: 'active',
      session_cookies: { verified: true, otp },
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', accountId)
    .select()
    .single()
  
  if (error) throw error
  try {
    revalidatePath('/linkedin-account')
  } catch (e) {
    console.log('⚠️ Revalidation skipped')
  }
  return data
}

export async function checkAccountConnection(accountId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get the account with proxy data
  const { data: account, error: fetchError } = await supabase
    .from('linkedin_accounts')
    .select('session_cookies, email, proxy_id, proxy:proxies(*)')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .single()

  if (fetchError) throw fetchError
  if (!account.session_cookies?.li_at) {
    throw new Error('No session cookies found')
  }

  // Resolve proxy config if assigned (Playwright native proxy support)
  let proxyConfig: { server: string; username?: string; password?: string } | undefined
  if (account.proxy) {
    const { buildPlaywrightProxyConfig } = await import('@/lib/utils/proxy-helpers')
    const proxyRecord = Array.isArray(account.proxy) ? account.proxy[0] : account.proxy
    if (proxyRecord) proxyConfig = buildPlaywrightProxyConfig(proxyRecord)
  }

  // Validate the session through the same proxy the cookies were created on
  const { validateSessionCookie } = await import('@/lib/linkedin-cookie-auth')
  const isValid = await validateSessionCookie(account.session_cookies.li_at, account.session_cookies, proxyConfig)

  // Update account status
  const { error: updateError } = await supabase
    .from('linkedin_accounts')
    .update({
      status: isValid ? 'active' : 'disconnected',
      error_message: isValid ? null : 'LinkedIn session expired or account restricted',
      updated_at: new Date().toISOString()
    })
    .eq('id', accountId)

  if (updateError) throw updateError

  try {
    revalidatePath('/linkedin-account')
  } catch (e) {
    console.log('⚠️ Revalidation skipped')
  }

  return {
    isValid,
    status: isValid ? 'active' : 'disconnected'
  }
}

// =============== INFINITE LOGIN ACTIONS ===============

export async function createInfiniteLoginAccount(formData: {
  email: string
  password: string
  keepSessionAlive: boolean
  autoRefreshCookies: boolean
  proxy_id?: string
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  console.log('🚀 Starting infinite login for:', formData.email)

  // Start infinite login session
  const { startInfiniteLoginSession } = await import('@/lib/linkedin-session-manager')
  
  // Create account record first (in connecting status)
  const { data: account, error: createError } = await supabase
    .from('linkedin_accounts')
    .insert({
      user_id: user.id,
      email: formData.email,
      password_encrypted: null,
      connection_method: 'automated',
      proxy_id: formData.proxy_id || null,
      two_fa_enabled: true,
      status: 'connecting',
      session_cookies: null,
      error_message: 'Starting infinite login session...',
      last_activity_at: new Date().toISOString()
    })
    .select()
    .single()

  if (createError) throw createError

  const loginResult = await startInfiniteLoginSession(
    account.id,
    formData.email,
    formData.password,
    {
      keepSessionAlive: formData.keepSessionAlive,
      autoRefreshCookies: formData.autoRefreshCookies,
      handle2FA: true
    }
  )

  if (!loginResult.success) {
    if (loginResult.requiresAuth && loginResult.authType === '2FA') {
      // Update account to pending verification
      await supabase
        .from('linkedin_accounts')
        .update({
          status: 'pending_verification',
          session_id: loginResult.sessionId,
          error_message: 'Waiting for 2FA code. Browser is open and ready.'
        })
        .eq('id', account.id)

      try {
        revalidatePath('/linkedin-account')
      } catch (e) {
        console.log('⚠️ Revalidation skipped')
      }
      
      return {
        success: true,
        requires2FA: true,
        sessionId: loginResult.sessionId,
        accountId: account.id,
        message: 'Please enter the 2FA code sent to your email/phone. Browser will stay open.',
        infiniteSession: true
      }
    } else if (loginResult.error === 'INVALID_CREDENTIALS') {
      await supabase
        .from('linkedin_accounts')
        .delete()
        .eq('id', account.id)
      throw new Error('Invalid LinkedIn email or password')
    } else {
      await supabase
        .from('linkedin_accounts')
        .delete()
        .eq('id', account.id)
      throw new Error(loginResult.message || 'Failed to connect to LinkedIn')
    }
  }

  // Login successful - update account
  const { data: updatedAccount, error: updateError } = await supabase
    .from('linkedin_accounts')
    .update({
      status: 'active',
      session_cookies: loginResult.cookies,
      session_id: loginResult.sessionId || null,
      profile_name: loginResult.profileData?.name || null,
      profile_picture_url: loginResult.profileData?.profilePictureUrl || null,
      error_message: loginResult.infiniteSession 
        ? 'Infinite session active - browser maintaining login' 
        : null,
      last_activity_at: new Date().toISOString()
    })
    .eq('id', account.id)
    .select()
    .single()

  if (updateError) throw updateError

  console.log('✅ Infinite login account connected!')
  
  try {
    revalidatePath('/linkedin-account')
  } catch (e) {
    // Ignore revalidation errors in development
    console.log('⚠️ Revalidation skipped')
  }
  
  return {
    success: true,
    account: updatedAccount,
    infiniteSession: loginResult.infiniteSession,
    sessionId: loginResult.sessionId,
    message: loginResult.infiniteSession 
      ? 'Account connected with infinite session. Browser will keep you logged in.' 
      : 'Account connected successfully.'
  }
}

export async function complete2FAInfiniteLogin(formData: {
  accountId: string
  sessionId: string
  code: string
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  console.log('🔢 Completing 2FA for infinite session...')

  const { complete2FAForInfiniteSession } = await import('@/lib/linkedin-session-manager')
  
  const result = await complete2FAForInfiniteSession(formData.sessionId, formData.code)

  if (!result.success) {
    if (result.error === 'INVALID_CODE') {
      throw new Error('Invalid 2FA code. Please try again.')
    } else if (result.error === 'SESSION_NOT_FOUND') {
      throw new Error('Session expired. Please reconnect the account.')
    } else {
      throw new Error(result.message || 'Failed to verify 2FA code')
    }
  }

  // Update account with cookies and profile data
  const { data: updatedAccount, error: updateError } = await supabase
    .from('linkedin_accounts')
    .update({
      status: 'active',
      session_cookies: result.cookies,
      session_id: result.sessionId,
      profile_name: result.profileData?.name || null,
      profile_picture_url: result.profileData?.profilePictureUrl || null,
      error_message: 'Infinite session active - browser maintaining login',
      last_activity_at: new Date().toISOString()
    })
    .eq('id', formData.accountId)
    .select()
    .single()

  if (updateError) throw updateError

  console.log('✅ Infinite login 2FA completed!')
  
  try {
    revalidatePath('/linkedin-account')
  } catch (e) {
    console.log('⚠️ Revalidation skipped')
  }
  
  return {
    success: true,
    account: updatedAccount,
    infiniteSession: true,
    message: 'Infinite session activated. Browser will maintain your login.'
  }
}

export async function stopInfiniteSession(accountId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get account session ID
  const { data: account } = await supabase
    .from('linkedin_accounts')
    .select('session_id, email')
    .eq('id', accountId)
    .single()

  if (!account?.session_id) {
    throw new Error('No active infinite session found')
  }

  const { stopInfiniteSession: stopSession } = await import('@/lib/linkedin-session-manager')
  
  const result = await stopSession(account.session_id)

  if (result.success) {
    // Update account
    await supabase
      .from('linkedin_accounts')
      .update({
        session_id: null,
        error_message: 'Infinite session stopped',
        updated_at: new Date().toISOString()
      })
      .eq('id', accountId)

    try {
      revalidatePath('/linkedin-account')
    } catch (e) {
      console.log('⚠️ Revalidation skipped')
    }
  }

  return result
}

export async function getActiveInfiniteSessions() {
  const { getActiveSessions } = await import('@/lib/linkedin-session-manager')
  return getActiveSessions()
}

// =============== COOKIE-BASED INFINITE LOGIN ===============

export async function createInfiniteLoginWithCookie(formData: {
  email: string
  secret_key: string
  proxy_id?: string
}) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('❌ User not authenticated')
      throw new Error('Not authenticated')
    }

    console.log('🔑 Starting infinite login with cookie for:', formData.email)
    console.log('📝 Secret key length:', formData.secret_key?.length || 0)
    console.log('🌐 Proxy ID:', formData.proxy_id || 'none')

    // Validate inputs
    if (!formData.email || !formData.secret_key) {
      console.error('❌ Missing email or secret key')
      throw new Error('Email and secret key are required')
    }

    // Resolve proxy config if proxy_id is provided (Playwright native proxy support)
    let proxyConfig: { server: string; username?: string; password?: string } | undefined
    if (formData.proxy_id) {
      const { data: proxy } = await supabase
        .from('proxies')
        .select('*')
        .eq('id', formData.proxy_id)
        .single()
      if (proxy) {
        const { buildPlaywrightProxyConfig } = await import('@/lib/utils/proxy-helpers')
        proxyConfig = buildPlaywrightProxyConfig(proxy)
        console.log('🌐 Resolved proxy:', proxyConfig.server, '(user:', proxyConfig.username || 'none', ')')
      }
    }

    // Validate cookie using the cookie auth module (through proxy if available)
    console.log('📦 Loading cookie auth module...')
    const { loginWithCookie } = await import('@/lib/linkedin-cookie-auth')
    
    console.log('🔍 Validating cookie...' + (proxyConfig ? ' (via proxy)' : ' (no proxy)'))
    const result = await loginWithCookie(formData.email, formData.secret_key, proxyConfig)
    
    console.log('📊 Validation result:', {
      success: result.success,
      hasProfileData: !!result.profileData,
      hasCookies: !!result.cookies,
      error: result.error
    })
    
    if (!result.success) {
      const errorMsg = result.error === 'INVALID_SECRET_KEY' 
        ? 'Invalid secret key. Please check your li_at cookie value.'
        : result.message || 'Failed to authenticate with secret key'
      console.error('❌ Cookie validation failed:', errorMsg)
      throw new Error(errorMsg)
    }

    console.log('✅ Cookie validated successfully')
    console.log('👤 Profile data:', result.profileData)

    // Check if account already exists for this user/email
    let existingAccount
    try {
      const { data } = await supabase
        .from('linkedin_accounts')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('email', formData.email)
        .maybeSingle()
      existingAccount = data
    } catch (dbError: any) {
      console.error('⚠️ Database query error (will retry):', dbError.message)
      // Wait and retry once
      await new Promise(resolve => setTimeout(resolve, 2000))
      const { data } = await supabase
        .from('linkedin_accounts')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('email', formData.email)
        .maybeSingle()
      existingAccount = data
    }

    if (existingAccount) {
      console.log(`📝 Account already exists (${existingAccount.status}), updating instead of creating...`)
      
      // Update existing account instead of creating duplicate
      const { data, error } = await supabase
        .from('linkedin_accounts')
        .update({
          status: 'active',
          session_cookies: result.cookies,
          proxy_id: formData.proxy_id || null,
          profile_name: result.profileData?.name || null,
          profile_picture_url: result.profileData?.profilePictureUrl || null,
          headline: result.profileData?.headline || null,
          job_title: result.profileData?.jobTitle || null,
          company: result.profileData?.company || null,
          location: result.profileData?.location || null,
          profile_url: result.profileData?.profileUrl || null,
          connections_count: result.profileData?.connectionsCount || null,
          about: result.profileData?.about || null,
          error_message: null,
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAccount.id)
        .select()
        .single()
      
      if (error) throw error
      
      console.log('✅ Existing account updated successfully!')
      try {
        revalidatePath('/linkedin-account')
      } catch (e) {
        console.log('⚠️ Revalidation skipped')
      }
      return data
    }

    // Create new account with validated cookies
    console.log('💾 Creating new account in database...')
    const { data, error } = await supabase
      .from('linkedin_accounts')
      .insert({
        user_id: user.id,
        email: formData.email,
        password_encrypted: null,
        connection_method: 'cookie',
        proxy_id: formData.proxy_id || null,
        two_fa_enabled: false,
        status: 'active',
        session_cookies: result.cookies,
        profile_name: result.profileData?.name || null,
        profile_picture_url: result.profileData?.profilePictureUrl || null,
        headline: result.profileData?.headline || null,
        job_title: result.profileData?.jobTitle || null,
        company: result.profileData?.company || null,
        location: result.profileData?.location || null,
        profile_url: result.profileData?.profileUrl || null,
        connections_count: result.profileData?.connectionsCount || null,
        about: result.profileData?.about || null,
        error_message: null,
        last_activity_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) {
      console.error('❌ Database error:', error)
      throw error
    }
    
    console.log('✅ Infinite login account connected successfully!')
    console.log('📄 Account data:', data)
    
    try {
      revalidatePath('/linkedin-account')
    } catch (e) {
      console.log('⚠️ Revalidation skipped')
    }
    return data
  } catch (error: any) {
    console.error('❌ createInfiniteLoginWithCookie error:', error)
    console.error('Stack trace:', error.stack)
    throw error
  }
}

/**
 * Reconnect a disconnected LinkedIn account with fresh cookies
 */
export async function reconnectLinkedInAccount(
  accountId: string,
  formData: {
    secret_key: string
    proxy_id?: string
  }
) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Get the existing account
    const { data: existingAccount, error: fetchError } = await supabase
      .from('linkedin_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingAccount) {
      throw new Error('Account not found')
    }

    console.log('🔄 Reconnecting account:', existingAccount.email)

    // Resolve proxy config if proxy_id is provided (Playwright native proxy support)
    let proxyConfig: { server: string; username?: string; password?: string } | undefined
    const resolvedProxyId = formData.proxy_id || existingAccount.proxy_id
    if (resolvedProxyId) {
      const { data: proxy } = await supabase
        .from('proxies')
        .select('*')
        .eq('id', resolvedProxyId)
        .single()
      if (proxy) {
        const { buildPlaywrightProxyConfig } = await import('@/lib/utils/proxy-helpers')
        proxyConfig = buildPlaywrightProxyConfig(proxy)
        console.log('🌐 Reconnect using proxy:', proxyConfig.server, '(user:', proxyConfig.username || 'none', ')')
      }
    }

    // Validate cookie using the cookie auth module (through proxy if available)
    const { loginWithCookie } = await import('@/lib/linkedin-cookie-auth')
    
    const result = await loginWithCookie(existingAccount.email, formData.secret_key, proxyConfig)
    
    if (!result.success) {
      const errorMsg = result.error === 'INVALID_SECRET_KEY' 
        ? 'Invalid secret key. Please check your li_at cookie value.'
        : result.message || 'Failed to authenticate with secret key'
      throw new Error(errorMsg)
    }

    console.log('✅ Cookie validated, updating account with fresh data...')

    // Update account with validated cookies AND fresh profile data
    const { data, error } = await supabase
      .from('linkedin_accounts')
      .update({
        status: 'active',
        session_cookies: result.cookies,
        proxy_id: formData.proxy_id || existingAccount.proxy_id,
        profile_name: result.profileData?.name || existingAccount.profile_name,
        profile_picture_url: result.profileData?.profilePictureUrl || existingAccount.profile_picture_url,
        headline: result.profileData?.headline || existingAccount.headline,
        job_title: result.profileData?.jobTitle || existingAccount.job_title,
        company: result.profileData?.company || existingAccount.company,
        location: result.profileData?.location || existingAccount.location,
        profile_url: result.profileData?.profileUrl || existingAccount.profile_url,
        connections_count: result.profileData?.connectionsCount || existingAccount.connections_count,
        about: result.profileData?.about || existingAccount.about,
        error_message: null,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', accountId)
      .select()
      .single()
    
    if (error) throw error
    
    console.log('✅ Account reconnected successfully with updated profile data!')
    
    try {
      revalidatePath('/linkedin-account')
    } catch (e) {
      console.log('⚠️ Revalidation skipped')
    }
    return data
  } catch (error: any) {
    console.error('❌ Reconnect error:', error)
    throw error
  }
}

// ─── Proxy Login (Login through proxy — cookies born on proxy IP) ───────

/**
 * Connect a LinkedIn account by logging in through a proxy.
 * The cookies will be bound to the proxy IP — perfect for campaign automation.
 * 
 * This is the RECOMMENDED method for all users, especially when using proxies.
 */
export async function connectWithProxy(formData: {
  email: string
  password: string
  proxy_id?: string | null
}) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Validate inputs
    if (!formData.email || !formData.password) {
      throw new Error('Email and password are required')
    }

    console.log('🚀 Starting login for:', formData.email)

    // Auto-resolve proxy if none provided — pick best available
    let proxyId = formData.proxy_id
    if (!proxyId) {
      const { data: userProxies } = await supabase
        .from('proxies')
        .select('id, type, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      
      if (userProxies && userProxies.length > 0) {
        const residential = userProxies.find(p => p.type === 'residential' && p.status !== 'error')
        proxyId = residential?.id || userProxies[0].id
        console.log('🌐 Auto-selected proxy:', proxyId)
      }
    }

    // Resolve proxy config (if we have one)
    let proxyConfig: { server: string; username?: string; password?: string } | undefined
    if (proxyId) {
      const { data: proxy, error: proxyError } = await supabase
        .from('proxies')
        .select('*')
        .eq('id', proxyId)
        .single()
      
      if (proxyError || !proxy) {
        throw new Error('Proxy not found. Please add a proxy or select a valid one.')
      }

      const { buildPlaywrightProxyConfig } = await import('@/lib/utils/proxy-helpers')
      proxyConfig = buildPlaywrightProxyConfig(proxy)
      console.log('🌐 Proxy resolved:', proxyConfig.server)
    } else {
      console.log('⚠️ No proxy available — connecting without proxy (less safe)')
    }

    console.log('🌐 Proxy ID:', proxyId || 'none')

    // Login through proxy
    const { loginWithCredentialsThroughProxy } = await import('@/lib/linkedin-cookie-auth')
    const result = await loginWithCredentialsThroughProxy(formData.email, formData.password, proxyConfig)

    console.log('📊 Proxy login result:', {
      success: result.success,
      requires2FA: result.requires2FA,
      error: result.error,
    })

    // Handle 2FA
    if (result.requires2FA && result.sessionId) {
      // Check if account already exists for this user+email
      const { data: existing2FA } = await supabase
        .from('linkedin_accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('email', formData.email)
        .maybeSingle()

      const pendingData = {
        user_id: user.id,
        email: formData.email,
        password_encrypted: null,
        connection_method: 'proxy_login',
        proxy_id: proxyId || null,
        two_fa_enabled: true,
        status: 'pending_verification',
        session_id: result.sessionId,
        session_cookies: null,
        error_message: 'Waiting for PIN verification',
        last_activity_at: new Date().toISOString(),
      }

      let data
      if (existing2FA) {
        const { data: updated, error } = await supabase
          .from('linkedin_accounts')
          .update({ ...pendingData, updated_at: new Date().toISOString() })
          .eq('id', existing2FA.id)
          .select()
          .single()
        if (error) throw error
        data = updated
      } else {
        const { data: created, error } = await supabase
          .from('linkedin_accounts')
          .insert(pendingData)
          .select()
          .single()
        if (error) throw error
        data = created
      }

      return {
        requiresPin: true,
        sessionId: result.sessionId,
        accountId: data.id,
        message: result.message || 'LinkedIn sent a verification code to your email.',
      }
    }

    // Handle errors
    if (!result.success) {
      if (result.error === 'INVALID_CREDENTIALS') {
        throw new Error('Invalid LinkedIn email or password.')
      }
      if (result.error === 'SECURITY_CHECKPOINT') {
        throw new Error('LinkedIn security checkpoint. Try again later or use a different proxy.')
      }
      throw new Error(result.message || 'Failed to connect through proxy.')
    }

    // Success! Save account with proxy-bound cookies
    if (!result.cookies?.li_at) {
      throw new Error('Login succeeded but no session cookie was found.')
    }

    // Check if account exists
    const { data: existingAccount } = await supabase
      .from('linkedin_accounts')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('email', formData.email)
      .maybeSingle()

    const accountData = {
      user_id: user.id,
      email: formData.email,
      password_encrypted: null,
      connection_method: 'proxy_login',
      proxy_id: proxyId || null,
      two_fa_enabled: false,
      status: 'active' as const,
      session_cookies: result.cookies,
      profile_name: result.profileData?.name || null,
      profile_picture_url: result.profileData?.profilePictureUrl || null,
      headline: result.profileData?.headline || null,
      job_title: result.profileData?.jobTitle || null,
      company: result.profileData?.company || null,
      location: result.profileData?.location || null,
      profile_url: result.profileData?.profileUrl || null,
      connections_count: result.profileData?.connectionsCount || null,
      about: result.profileData?.about || null,
      error_message: null,
      last_activity_at: new Date().toISOString(),
    }

    let data
    if (existingAccount) {
      const { data: updated, error } = await supabase
        .from('linkedin_accounts')
        .update({ ...accountData, updated_at: new Date().toISOString() })
        .eq('id', existingAccount.id)
        .select()
        .single()
      if (error) throw error
      data = updated
    } else {
      const { data: created, error } = await supabase
        .from('linkedin_accounts')
        .insert(accountData)
        .select()
        .single()
      if (error) throw error
      data = created
    }

    console.log('✅ Account connected via proxy login!')
    
    try { revalidatePath('/linkedin-account') } catch {}
    return data
  } catch (error: any) {
    console.error('❌ connectWithProxy error:', error)
    throw error
  }
}

/**
 * Complete 2FA for a proxy login session.
 * User provides the PIN received via email.
 */
export async function completeProxyLogin2FA(formData: {
  account_id: string
  pin: string
  session_id: string
  proxy_id: string
}) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    console.log('🔢 Completing proxy 2FA for account:', formData.account_id)

    const { completeProxy2FA } = await import('@/lib/linkedin-cookie-auth')
    const result = await completeProxy2FA(formData.session_id, formData.pin)

    if (!result.success) {
      // Update account with error
      await supabase
        .from('linkedin_accounts')
        .update({
          error_message: result.message || 'PIN verification failed',
          status: 'error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', formData.account_id)

      throw new Error(result.message || 'Invalid verification code.')
    }

    // Success! Update account with proxy-bound cookies
    if (!result.cookies?.li_at) {
      throw new Error('Verification succeeded but no session cookie was found.')
    }

    const { data, error } = await supabase
      .from('linkedin_accounts')
      .update({
        status: 'active',
        session_cookies: result.cookies,
        proxy_id: formData.proxy_id,
        profile_name: result.profileData?.name || null,
        profile_picture_url: result.profileData?.profilePictureUrl || null,
        headline: result.profileData?.headline || null,
        job_title: result.profileData?.jobTitle || null,
        company: result.profileData?.company || null,
        location: result.profileData?.location || null,
        profile_url: result.profileData?.profileUrl || null,
        connections_count: result.profileData?.connectionsCount || null,
        about: result.profileData?.about || null,
        error_message: null,
        session_id: null,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', formData.account_id)
      .select()
      .single()

    if (error) throw error

    console.log('✅ Proxy 2FA completed, account active!')
    
    try { revalidatePath('/linkedin-account') } catch {}
    return data
  } catch (error: any) {
    console.error('❌ completeProxyLogin2FA error:', error)
    throw error
  }
}
