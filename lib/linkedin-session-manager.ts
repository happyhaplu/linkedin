// lib/linkedin-session-manager.ts
// @ts-nocheck
/* eslint-disable */
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { createClient } from '@/lib/db/server'

puppeteer.use(StealthPlugin())

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Store persistent sessions for infinite login
const persistentSessions = new Map<string, {
  browser: any
  page: any
  accountId: string
  email: string
  lastActivity: Date
  keepAlive: boolean
}>()

export interface InfiniteLoginOptions {
  keepSessionAlive: boolean // If true, keeps browser session running
  autoRefreshCookies: boolean // If true, automatically refreshes cookies
  handle2FA: boolean // If true, waits for 2FA codes
}

/**
 * Start an infinite login session - keeps the browser running
 * to maintain LinkedIn session without expiration
 */
export async function startInfiniteLoginSession(
  accountId: string,
  email: string,
  password: string,
  options: InfiniteLoginOptions = {
    keepSessionAlive: true,
    autoRefreshCookies: true,
    handle2FA: true
  }
) {
  try {
    console.log(`🚀 Starting infinite login session for ${email}`)
    
    // Launch browser in non-headless mode for persistent session
    const browser = await puppeteer.launch({
      headless: false, // Keep visible to maintain session
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-position=2000,0', // Move to side monitor or off-screen
        '--window-size=800,600'
      ]
    })

    const page = await browser.newPage()
    
    // Set user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    console.log('📱 Navigating to LinkedIn login...')
    await page.goto('https://www.linkedin.com/login', {
      waitUntil: 'networkidle2',
      timeout: 30000
    })

    // Enter credentials
    await page.waitForSelector('input[name="session_key"]', { timeout: 10000 })
    await page.type('input[name="session_key"]', email, { delay: 100 })
    await page.type('input[name="session_password"]', password, { delay: 100 })
    
    console.log('🔐 Submitting credentials...')
    await page.click('button[type="submit"]')
    
    // Wait for navigation
    await page.waitForNavigation({ 
      waitUntil: 'networkidle2',
      timeout: 30000 
    }).catch(() => console.log('Navigation timeout'))

    await delay(2000)

    const currentUrl = page.url()
    console.log('Current URL:', currentUrl)

    // Check for 2FA/PIN challenge
    if (currentUrl.includes('/checkpoint') || currentUrl.includes('/challenge')) {
      console.log('🔒 2FA/PIN challenge detected')
      
      if (options.handle2FA) {
        // Store session for user to complete 2FA
        const sessionId = `infinite_${accountId}_${Date.now()}`
        
        persistentSessions.set(sessionId, {
          browser,
          page,
          accountId,
          email,
          lastActivity: new Date(),
          keepAlive: options.keepSessionAlive
        })

        console.log('💾 Session stored, waiting for 2FA completion...')
        
        return {
          success: false,
          requiresAuth: true,
          authType: '2FA',
          sessionId,
          message: 'Please complete 2FA verification. Browser will stay open.'
        }
      } else {
        await browser.close()
        return {
          success: false,
          error: '2FA_REQUIRED',
          message: '2FA is required but not enabled in options'
        }
      }
    }

    // Check if login successful
    if (currentUrl.includes('/login') || currentUrl.includes('error')) {
      await browser.close()
      return {
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      }
    }

    console.log('✅ Login successful!')

    // Extract cookies
    const cookies = await page.cookies()
    const li_at = cookies.find(c => c.name === 'li_at')
    const jsessionid = cookies.find(c => c.name === 'JSESSIONID')

    if (!li_at) {
      await browser.close()
      return {
        success: false,
        error: 'COOKIE_NOT_FOUND',
        message: 'Could not extract session cookies'
      }
    }

    // Extract profile data
    let profileData: any = {}
    try {
      await page.goto('https://www.linkedin.com/feed/', { 
        waitUntil: 'networkidle2',
        timeout: 15000 
      })
      
      const name = await page.$eval('.global-nav__me-photo', 
        (el) => el.getAttribute('alt')
      ).catch(() => null)
      
      const profilePictureUrl = await page.$eval('.global-nav__me-photo', 
        (el) => (el as HTMLImageElement).src
      ).catch(() => null)
      
      if (name) profileData.name = name
      if (profilePictureUrl) profileData.profilePictureUrl = profilePictureUrl
    } catch (e) {
      console.log('Could not extract profile data')
    }

    // If keep session alive, store the browser session
    if (options.keepSessionAlive) {
      const sessionId = `infinite_${accountId}_${Date.now()}`
      
      persistentSessions.set(sessionId, {
        browser,
        page,
        accountId,
        email,
        lastActivity: new Date(),
        keepAlive: true
      })

      console.log('🔄 Infinite session started - browser will stay open')
      
      // Setup auto-refresh if enabled
      if (options.autoRefreshCookies) {
        setupAutoRefresh(sessionId)
      }

      return {
        success: true,
        cookies: {
          li_at: li_at.value,
          JSESSIONID: jsessionid?.value
        },
        profileData,
        sessionId,
        infiniteSession: true,
        message: 'Infinite session started. Browser will maintain login.'
      }
    } else {
      // Close browser if not keeping alive
      await browser.close()
      
      return {
        success: true,
        cookies: {
          li_at: li_at.value,
          JSESSIONID: jsessionid?.value
        },
        profileData,
        infiniteSession: false
      }
    }

  } catch (error: any) {
    console.error('❌ Infinite login error:', error.message)
    return {
      success: false,
      error: 'LOGIN_FAILED',
      message: error.message
    }
  }
}

/**
 * Complete 2FA for infinite session
 */
export async function complete2FAForInfiniteSession(
  sessionId: string,
  code: string
) {
  const session = persistentSessions.get(sessionId)
  
  if (!session) {
    return {
      success: false,
      error: 'SESSION_NOT_FOUND',
      message: 'Session expired or not found'
    }
  }

  try {
    const { page, browser, accountId, email } = session
    
    console.log('🔢 Entering 2FA code...')
    
    // Find and fill the PIN input
    const pinInput = await page.$('input[name="pin"]').catch(() => null) ||
                     await page.$('input[type="text"][id*="verification"]').catch(() => null) ||
                     await page.$('input[autocomplete="one-time-code"]').catch(() => null)
    
    if (pinInput) {
      await pinInput.type(code, { delay: 100 })
    } else {
      // Fallback: type in any focused input
      await page.keyboard.type(code, { delay: 100 })
    }

    await delay(500)
    
    // Submit
    await page.click('button[type="submit"]')
    
    await page.waitForNavigation({ 
      waitUntil: 'networkidle2',
      timeout: 30000 
    }).catch(() => console.log('Navigation complete'))

    await delay(2000)

    const currentUrl = page.url()
    
    if (currentUrl.includes('/login') || currentUrl.includes('error')) {
      return {
        success: false,
        error: 'INVALID_CODE',
        message: 'Invalid 2FA code'
      }
    }

    console.log('✅ 2FA completed!')

    // Extract cookies
    const cookies = await page.cookies()
    const li_at = cookies.find(c => c.name === 'li_at')
    const jsessionid = cookies.find(c => c.name === 'JSESSIONID')

    if (!li_at) {
      return {
        success: false,
        error: 'COOKIE_NOT_FOUND'
      }
    }

    // Extract profile data
    let profileData: any = {}
    try {
      await page.goto('https://www.linkedin.com/feed/', { 
        waitUntil: 'networkidle2',
        timeout: 15000 
      })
      
      const name = await page.$eval('.global-nav__me-photo', 
        (el) => el.getAttribute('alt')
      ).catch(() => null)
      
      const profilePictureUrl = await page.$eval('.global-nav__me-photo', 
        (el) => (el as HTMLImageElement).src
      ).catch(() => null)
      
      if (name) profileData.name = name
      if (profilePictureUrl) profileData.profilePictureUrl = profilePictureUrl
    } catch (e) {
      console.log('Could not extract profile data')
    }

    // Update session
    session.lastActivity = new Date()

    // Setup auto-refresh
    setupAutoRefresh(sessionId)

    return {
      success: true,
      cookies: {
        li_at: li_at.value,
        JSESSIONID: jsessionid?.value
      },
      profileData,
      sessionId,
      infiniteSession: true,
      message: 'Infinite session active. Browser will maintain login.'
    }

  } catch (error: any) {
    console.error('❌ 2FA completion error:', error.message)
    return {
      success: false,
      error: 'AUTH_FAILED',
      message: error.message
    }
  }
}

/**
 * Setup automatic cookie refresh
 */
function setupAutoRefresh(sessionId: string) {
  const session = persistentSessions.get(sessionId)
  if (!session) return

  // Refresh cookies every 4 hours
  const refreshInterval = setInterval(async () => {
    const currentSession = persistentSessions.get(sessionId)
    if (!currentSession || !currentSession.keepAlive) {
      clearInterval(refreshInterval)
      return
    }

    try {
      console.log(`🔄 Auto-refreshing session for ${currentSession.email}`)
      
      const { page } = currentSession
      
      // Visit LinkedIn feed to keep session active
      await page.goto('https://www.linkedin.com/feed/', {
        waitUntil: 'networkidle2',
        timeout: 15000
      }).catch(() => console.log('Refresh navigation timeout'))

      // Extract fresh cookies
      const cookies = await page.cookies()
      const li_at = cookies.find(c => c.name === 'li_at')

      if (li_at) {
        // Update database with fresh cookies
        const supabase = await createClient()
        await supabase
          .from('linkedin_accounts')
          .update({
            session_cookies: {
              li_at: li_at.value,
              JSESSIONID: cookies.find(c => c.name === 'JSESSIONID')?.value
            },
            last_activity_at: new Date().toISOString()
          })
          .eq('id', currentSession.accountId)

        console.log(`✅ Cookies refreshed for ${currentSession.email}`)
        currentSession.lastActivity = new Date()
      }
    } catch (error: any) {
      console.error('❌ Auto-refresh error:', error.message)
    }
  }, 4 * 60 * 60 * 1000) // Every 4 hours
}

/**
 * Stop infinite session
 */
export async function stopInfiniteSession(sessionId: string) {
  const session = persistentSessions.get(sessionId)
  
  if (session) {
    session.keepAlive = false
    
    if (session.browser) {
      await session.browser.close()
    }
    
    persistentSessions.delete(sessionId)
    
    return {
      success: true,
      message: 'Infinite session stopped'
    }
  }
  
  return {
    success: false,
    error: 'SESSION_NOT_FOUND'
  }
}

/**
 * Get all active infinite sessions
 */
export function getActiveSessions() {
  return Array.from(persistentSessions.entries()).map(([id, session]) => ({
    sessionId: id,
    accountId: session.accountId,
    email: session.email,
    lastActivity: session.lastActivity,
    keepAlive: session.keepAlive
  }))
}

/**
 * Cleanup inactive sessions (older than 24 hours)
 */
export async function cleanupInactiveSessions() {
  const now = new Date()
  const maxAge = 24 * 60 * 60 * 1000 // 24 hours

  for (const [sessionId, session] of persistentSessions.entries()) {
    const age = now.getTime() - session.lastActivity.getTime()
    
    if (age > maxAge && !session.keepAlive) {
      console.log(`🧹 Cleaning up inactive session: ${session.email}`)
      await stopInfiniteSession(sessionId)
    }
  }
}

// Cleanup every hour
setInterval(cleanupInactiveSessions, 60 * 60 * 1000)
