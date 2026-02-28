// lib/linkedin-cookie-auth.ts
// @ts-nocheck
/* eslint-disable */
import { chromium } from 'playwright'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export interface CookieAuthResult {
  success: boolean
  cookies?: {
    li_at: string
    JSESSIONID?: string
  }
  profileData?: {
    name?: string
    profilePictureUrl?: string
    headline?: string
    location?: string
    jobTitle?: string
    company?: string
    profileUrl?: string
    connectionsCount?: number
    about?: string
  }
  error?: string
  message?: string
}

// ─── Cookie Parsing ────────────────────────────────────────

function parseCookieInput(secretKey: string): { li_at: string; cookiesObj: Record<string, string> } {
  let cookiesObj: Record<string, string> = {}
  let li_at = secretKey

  try {
    const parsed = JSON.parse(secretKey)
    if (Array.isArray(parsed)) {
      const keyNames = ['li_at', 'JSESSIONID', 'bcookie', 'lidc', 'bscookie']
      parsed.forEach((cookie: any) => {
        if (keyNames.includes(cookie.name)) {
          let value = cookie.value
          if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1)
          }
          cookiesObj[cookie.name] = value
        }
      })
      li_at = cookiesObj.li_at
    } else if (parsed.li_at) {
      cookiesObj = parsed
      li_at = parsed.li_at
    }
  } catch {
    cookiesObj = { li_at: secretKey }
  }

  if (!li_at) {
    throw new Error('No li_at cookie found. Please provide a valid li_at cookie or full cookie JSON.')
  }
  return { li_at, cookiesObj }
}

export function buildPlaywrightCookies(li_at: string, cookiesObj: Record<string, string>): any[] {
  const cookies: any[] = [
    { name: 'li_at', value: li_at, domain: '.linkedin.com', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' as const },
  ]
  const optional: Record<string, string> = {
    JSESSIONID: '.www.linkedin.com',
    bcookie: '.linkedin.com',
    lidc: '.linkedin.com',
    bscookie: '.linkedin.com',
  }
  for (const [name, domain] of Object.entries(optional)) {
    const value = cookiesObj[name]
    if (value && value.trim()) {
      cookies.push({ name, value, domain, path: '/', httpOnly: false, secure: true, sameSite: 'Lax' as const })
    }
  }
  return cookies
}

/**
 * Convert session_cookies JSONB from the DB to Playwright cookie array.
 * Accepts the raw session_cookies object (e.g. { li_at: "...", JSESSIONID: "...", ... })
 */
export function sessionCookiesToPlaywright(sessionCookies: Record<string, any>): any[] {
  const li_at = sessionCookies?.li_at
  if (!li_at) return []
  return buildPlaywrightCookies(li_at, sessionCookies)
}

// ─── Profile Extraction via LinkedIn Voyager API ───────────

async function extractProfileViaAPI(page: any, knownCsrfToken?: string): Promise<Record<string, any>> {
  const profileData: Record<string, any> = {}
  try {
    // Try reading from document.cookie first, fall back to the known token passed in
    let csrfToken = await page.evaluate(() => {
      const m = document.cookie.match(/JSESSIONID="?([^";]+)/)
      return m ? m[1] : ''
    }).catch(() => '')
    
    if (!csrfToken && knownCsrfToken) {
      csrfToken = knownCsrfToken.replace(/^"|"$/g, '') // strip surrounding quotes
      console.log('📌 Using known CSRF token from cookies')
    }
    if (!csrfToken) {
      console.log('⚠️ No CSRF token, skipping API extraction')
      return profileData
    }
    console.log('🔑 CSRF token found, calling Voyager API...')

    // Call /voyager/api/me
    const apiData = await page.evaluate(async (token: string) => {
      try {
        const r = await fetch('https://www.linkedin.com/voyager/api/me', {
          headers: { 'csrf-token': token, 'accept': 'application/vnd.linkedin.normalized+json+2.1' },
        })
        return r.ok ? await r.json() : null
      } catch { return null }
    }, csrfToken)

    if (apiData) {
      console.log('✅ Voyager /me returned data')
      const mini = apiData.miniProfile || apiData.data?.miniProfile || apiData
      const included = apiData.included || []

      const firstName = mini?.firstName || apiData?.firstName || ''
      const lastName = mini?.lastName || apiData?.lastName || ''
      if (firstName || lastName) profileData.name = `${firstName} ${lastName}`.trim()
      profileData.headline = mini?.occupation || mini?.headline || apiData?.headline || null

      // Profile picture
      const pic = mini?.picture || mini?.profilePicture
      if (pic) {
        const rootUrl = pic.rootUrl || pic.com_linkedin_common_VectorImage?.rootUrl || ''
        const artifacts = pic.artifacts || pic.com_linkedin_common_VectorImage?.artifacts || []
        if (rootUrl && artifacts.length > 0) {
          profileData.profilePictureUrl = rootUrl + (artifacts[artifacts.length - 1].fileIdentifyingUrlPathSegment || '')
        }
      }

      const publicId = mini?.publicIdentifier || mini?.entityUrn?.split(':')?.pop()
      if (publicId) profileData.profileUrl = `https://www.linkedin.com/in/${publicId}/`

      // Check included array for richer data
      for (const item of included) {
        if (item.$type === 'com.linkedin.voyager.identity.shared.MiniProfile' || (item.firstName && item.lastName)) {
          if (!profileData.name) profileData.name = `${item.firstName || ''} ${item.lastName || ''}`.trim()
          if (!profileData.headline && item.occupation) profileData.headline = item.occupation
          if (!profileData.profilePictureUrl && item.picture) {
            const p = item.picture
            const ru = p.rootUrl || p.com_linkedin_common_VectorImage?.rootUrl || ''
            const ar = p.artifacts || p.com_linkedin_common_VectorImage?.artifacts || []
            if (ru && ar.length > 0) profileData.profilePictureUrl = ru + (ar[ar.length - 1].fileIdentifyingUrlPathSegment || '')
          }
          if (!profileData.profileUrl && item.publicIdentifier) profileData.profileUrl = `https://www.linkedin.com/in/${item.publicIdentifier}/`
          break
        }
      }
    }

    // Fallback: dashboard profile API
    if (!profileData.name || !profileData.headline) {
      console.log('🔍 Trying dashboard profile API...')
      const dashData = await page.evaluate(async (token: string) => {
        try {
          const r = await fetch(
            'https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=me&decorationId=com.linkedin.voyager.dash.deco.identity.profile.WebTopCardCore-18',
            { headers: { 'csrf-token': token, 'accept': 'application/vnd.linkedin.normalized+json+2.1' } }
          )
          return r.ok ? await r.json() : null
        } catch { return null }
      }, csrfToken)

      if (dashData) {
        console.log('✅ Dashboard API returned data')
        const elements = dashData.included || dashData.elements || []
        for (const el of elements) {
          if (el.firstName && el.lastName && !profileData.name) profileData.name = `${el.firstName} ${el.lastName}`.trim()
          if (el.headline && !profileData.headline) profileData.headline = el.headline
          if ((el.locationName || el.geoLocationName) && !profileData.location) profileData.location = el.locationName || el.geoLocationName
          if (!profileData.profilePictureUrl && el.profilePicture) {
            const dp = el.profilePicture.displayImageReference?.vectorImage || el.profilePicture.displayImage?.com_linkedin_common_VectorImage
            if (dp) {
              const ru = dp.rootUrl || ''
              const ar = dp.artifacts || []
              if (ru && ar.length > 0) profileData.profilePictureUrl = ru + (ar[ar.length - 1].fileIdentifyingUrlPathSegment || '')
            }
          }
          if (el.publicIdentifier && !profileData.profileUrl) profileData.profileUrl = `https://www.linkedin.com/in/${el.publicIdentifier}/`
        }
      }
    }

    // Parse headline → jobTitle + company
    if (profileData.headline && !profileData.jobTitle) {
      const m = profileData.headline.match(/^(.+?)\s+at\s+(.+)$/i)
      if (m) { profileData.jobTitle = m[1].trim(); profileData.company = m[2].trim() }
    }
  } catch (e: any) {
    console.log('⚠️ API extraction error:', e.message)
  }
  return profileData
}

// ─── Main: loginWithCookie ─────────────────────────────────

export async function loginWithCookie(
  email: string,
  secretKey: string,
  proxyConfig?: { server: string; username?: string; password?: string }
): Promise<CookieAuthResult> {
  let browser
  try {
    console.log('🔑 Logging in with session cookie...')
    if (proxyConfig) console.log('🌐 Using proxy for cookie validation:', proxyConfig.server)

    // 1. Parse cookie input
    const { li_at, cookiesObj } = parseCookieInput(secretKey)
    console.log(`🍪 Parsed ${Object.keys(cookiesObj).length} cookies`)

    // 2. Launch browser
    const launchArgs = ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-setuid-sandbox']

    browser = await chromium.launch({
      headless: true,
      args: launchArgs,
    })

    // Use Playwright's native proxy support on context (handles auth properly)
    const contextOptions: any = {
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
    }
    if (proxyConfig) contextOptions.proxy = proxyConfig

    const context = await browser.newContext(contextOptions)
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false })
    })
    const page = await context.newPage()

    // 3. Set cookies
    await context.addCookies(buildPlaywrightCookies(li_at, cookiesObj))

    // 4. Navigate to feed
    try {
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 })
    } catch (e: any) {
      if (!e.message.includes('timeout')) throw e
      console.log('⚠️ Navigation timeout, continuing...')
    }
    await delay(3000)

    // 5. Validate cookies
    const currentUrl = page.url()
    console.log('📍 Current URL:', currentUrl)

    if (currentUrl.includes('/login') || currentUrl.includes('authwall')) {
      await browser.close()
      return { success: false, error: 'INVALID_SECRET_KEY', message: 'Invalid or expired cookies. Please get fresh cookies from your browser.' }
    }
    if (!currentUrl.includes('linkedin.com')) {
      await browser.close()
      return { success: false, error: 'UNEXPECTED_REDIRECT', message: 'Unexpected redirect. Please try again with fresh cookies.' }
    }
    console.log('✅ Session cookie is valid!')

    // 6. Capture JSESSIONID from browser
    const allCookies = await context.cookies()
    const jsessionid = allCookies.find(c => c.name === 'JSESSIONID')
    if (jsessionid && !cookiesObj.JSESSIONID) cookiesObj.JSESSIONID = jsessionid.value

    // 7. Extract profile data via Voyager API
    const knownCsrf = cookiesObj.JSESSIONID || jsessionid?.value || ''
    console.log('📊 Extracting profile data via Voyager API...')
    let profileData = await extractProfileViaAPI(page, knownCsrf)

    console.log('✅ Profile extraction complete:', {
      name: profileData.name || null,
      hasPhoto: !!profileData.profilePictureUrl,
      headline: profileData.headline || null,
      jobTitle: profileData.jobTitle || null,
      company: profileData.company || null,
      location: profileData.location || null,
      profileUrl: profileData.profileUrl || null,
    })

    await browser.close()

    return {
      success: true,
      cookies: cookiesObj,
      profileData: {
        name: profileData.name || null,
        profilePictureUrl: profileData.profilePictureUrl || null,
        headline: profileData.headline || null,
        location: profileData.location || null,
        jobTitle: profileData.jobTitle || null,
        company: profileData.company || null,
        profileUrl: profileData.profileUrl || null,
        connectionsCount: profileData.connectionsCount || null,
        about: profileData.about || null,
      },
    }
  } catch (error: any) {
    console.error('❌ Cookie auth error:', error.message)
    if (browser) await browser.close()
    return { success: false, error: 'AUTH_FAILED', message: error.message }
  }
}

// ─── Validate Cookie ───────────────────────────────────────

export async function validateSessionCookie(li_at: string, sessionCookies?: Record<string, any>, proxyConfig?: { server: string; username?: string; password?: string }): Promise<boolean> {
  let browser
  try {
    const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox']

    browser = await chromium.launch({
      headless: true,
      args: launchArgs,
    })

    // Use Playwright's native proxy support on context
    const contextOptions: any = {
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    }
    if (proxyConfig) contextOptions.proxy = proxyConfig

    const context = await browser.newContext(contextOptions)
    // Use full cookies if available to avoid redirect loops
    if (sessionCookies?.li_at) {
      await context.addCookies(sessionCookiesToPlaywright(sessionCookies))
    } else {
      await context.addCookies([
        { name: 'li_at', value: li_at, domain: '.linkedin.com', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' as const },
      ])
    }
    const page = await context.newPage()

    try {
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 })
    } catch (e: any) {
      if (!e.message.includes('timeout')) throw e
    }
    await delay(2000)
    const url = page.url()
    await browser.close()
    return !url.includes('/login') && !url.includes('authwall')
  } catch {
    if (browser) await browser.close()
    return false
  }
}

// ─── Credential Login Through Proxy ────────────────────────

export interface ProxyLoginResult {
  success: boolean
  cookies?: Record<string, string>
  profileData?: {
    name?: string
    profilePictureUrl?: string
    headline?: string
    location?: string
    jobTitle?: string
    company?: string
    profileUrl?: string
    connectionsCount?: number
    about?: string
  }
  error?: string
  message?: string
  requires2FA?: boolean
  sessionId?: string
}

/**
 * Login to LinkedIn with email+password through a proxy.
 * This creates cookies bound to the PROXY IP — which is exactly what we need
 * for campaign automation to work through the same proxy.
 *
 * Flow:
 *   1. Launch Playwright through proxy
 *   2. Navigate to LinkedIn login
 *   3. Fill credentials with human-like typing
 *   4. Handle 2FA if needed (returns requires2FA=true)
 *   5. Extract all cookies + profile data
 *   6. Return cookies bound to proxy IP
 */
export async function loginWithCredentialsThroughProxy(
  email: string,
  password: string,
  proxyConfig?: { server: string; username?: string; password?: string }
): Promise<ProxyLoginResult> {
  let browser: any
  try {
    console.log('🚀 Starting proxy login for:', email)
    if (proxyConfig) {
      console.log('🌐 Proxy:', proxyConfig.server)
    } else {
      console.log('⚠️ No proxy — connecting directly')
    }

    // 1. Launch browser
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    })

    // 2. Create context (with proxy if available)
    const contextOptions: any = {
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'Europe/London',
      extraHTTPHeaders: {
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
      },
    }
    if (proxyConfig) {
      contextOptions.proxy = proxyConfig
    }
    const context = await browser.newContext(contextOptions)
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
      // @ts-ignore
      delete window.__playwright
      // @ts-ignore
      delete window.__pwInitScripts
    })

    const page = await context.newPage()

    // 3. Verify proxy is working
    try {
      await page.goto('https://ipv4.webshare.io/', { timeout: 10000 })
      const ip = (await page.textContent('body'))?.trim()
      console.log(`✅ Proxy IP verified: ${ip}`)
    } catch {
      console.log('⚠️ Could not verify proxy IP (non-critical, continuing...)')
    }

    // 4. Navigate to LinkedIn login
    console.log('📄 Navigating to LinkedIn login...')
    await page.goto('https://www.linkedin.com/login', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    await delay(1500 + Math.random() * 1500)

    // 5. Fill credentials with human-like behavior
    console.log('✍️ Filling credentials...')
    
    // Wait for the login form
    await page.waitForSelector('#username', { timeout: 10000 })
    
    // Click and type email (human-like)
    await page.click('#username')
    await delay(200 + Math.random() * 300)
    for (const char of email) {
      await page.keyboard.type(char, { delay: 30 + Math.random() * 70 })
    }
    
    await delay(300 + Math.random() * 500)
    
    // Click and type password
    await page.click('#password')
    await delay(200 + Math.random() * 300)
    for (const char of password) {
      await page.keyboard.type(char, { delay: 30 + Math.random() * 70 })
    }
    
    await delay(500 + Math.random() * 1000)

    // 6. Submit login
    console.log('🔐 Submitting login...')
    await page.click('button[type="submit"]')
    
    // Wait for navigation (could go to /feed, /checkpoint, or stay on /login)
    try {
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 })
    } catch {
      // Navigation timeout — page might have loaded already
    }
    await delay(3000)

    const postLoginUrl = page.url()
    console.log('📍 Post-login URL:', postLoginUrl)

    // 7. Check for 2FA / Security Checkpoint
    if (postLoginUrl.includes('checkpoint') || postLoginUrl.includes('challenge')) {
      console.log('🔒 2FA or checkpoint detected')
      
      // Check if there's a PIN input
      const hasPinInput = await page.$('input[name="pin"]').catch(() => null)
      
      if (hasPinInput) {
        console.log('📧 2FA PIN required — LinkedIn sent a verification code to email')
        
        // We can't enter the PIN yet — return the browser session info
        // The user will provide the PIN and we'll continue
        // For now, store the session and return
        const sessionId = `proxy_${email}_${Date.now()}`
        
        // Store browser + context in memory for 2FA completion
        proxyLoginSessions.set(sessionId, { browser, context, page, email, proxyConfig })
        
        // Auto-cleanup after 5 minutes
        setTimeout(() => {
          if (proxyLoginSessions.has(sessionId)) {
            console.log(`🧹 Cleaning up expired proxy login session: ${sessionId}`)
            const session = proxyLoginSessions.get(sessionId)
            try { session?.browser?.close() } catch {}
            proxyLoginSessions.delete(sessionId)
          }
        }, 5 * 60 * 1000)
        
        return {
          success: false,
          requires2FA: true,
          sessionId,
          message: 'LinkedIn sent a verification code to your email. Please enter it to complete login.',
        }
      }
      
      // Check for other checkpoint types (app-based, security question, etc.)
      // Try to skip if possible
      const skipSelectors = [
        'button:has-text("Skip")',
        'button:has-text("Not now")',
        'button:has-text("Remind me later")',
        'button.secondary-action',
      ]
      for (const sel of skipSelectors) {
        try {
          const btn = await page.$(sel)
          if (btn) {
            await btn.click()
            await delay(2000)
            break
          }
        } catch { /* skip */ }
      }
      
      // Re-check URL after skip attempt
      const afterSkipUrl = page.url()
      if (afterSkipUrl.includes('checkpoint') || afterSkipUrl.includes('challenge')) {
        await browser.close()
        return {
          success: false,
          error: 'SECURITY_CHECKPOINT',
          message: 'LinkedIn security checkpoint detected. Try again in a few minutes, or use a different proxy.',
        }
      }
    }

    // 8. Check if login failed (still on login page)
    const finalUrl = page.url()
    if (finalUrl.includes('/login') || finalUrl.includes('/authwall')) {
      // Check for error messages
      const errorText = await page.$eval('.form__input--error, .alert-content, [role="alert"]', 
        (el: Element) => el.textContent?.trim() || ''
      ).catch(() => '')
      
      await browser.close()
      
      if (errorText.toLowerCase().includes('password') || errorText.toLowerCase().includes('credential')) {
        return { success: false, error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }
      }
      
      return {
        success: false,
        error: 'LOGIN_FAILED',
        message: errorText || 'Login failed. LinkedIn may be blocking the login attempt.',
      }
    }

    // 9. Login successful! Extract cookies
    console.log('✅ Login successful through proxy!')
    
    // Navigate to feed to make sure we're fully logged in
    if (!finalUrl.includes('/feed')) {
      try {
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 15000 })
        await delay(2000)
      } catch { /* ok */ }
    }

    // Extract ALL cookies
    const allCookies = await context.cookies()
    const cookiesObj: Record<string, string> = {}
    const importantCookies = ['li_at', 'JSESSIONID', 'bcookie', 'bscookie', 'lidc']
    for (const cookie of allCookies) {
      if (importantCookies.includes(cookie.name)) {
        cookiesObj[cookie.name] = cookie.value
      }
    }

    if (!cookiesObj.li_at) {
      await browser.close()
      return { success: false, error: 'NO_COOKIES', message: 'Login appeared successful but no session cookie was created.' }
    }

    console.log(`🍪 Extracted ${Object.keys(cookiesObj).length} cookies (bound to proxy IP)`)

    // 10. Extract profile data via Voyager API
    const csrfToken = cookiesObj.JSESSIONID || ''
    console.log('📊 Extracting profile data...')
    const profileData = await extractProfileViaAPI(page, csrfToken)

    await browser.close()

    console.log('✅ Proxy login complete!', {
      name: profileData.name,
      hasPhoto: !!profileData.profilePictureUrl,
      cookieCount: Object.keys(cookiesObj).length,
    })

    return {
      success: true,
      cookies: cookiesObj,
      profileData: {
        name: profileData.name || null,
        profilePictureUrl: profileData.profilePictureUrl || null,
        headline: profileData.headline || null,
        location: profileData.location || null,
        jobTitle: profileData.jobTitle || null,
        company: profileData.company || null,
        profileUrl: profileData.profileUrl || null,
        connectionsCount: profileData.connectionsCount || null,
        about: profileData.about || null,
      },
    }
  } catch (error: any) {
    console.error('❌ Proxy login error:', error.message)
    try { browser?.close() } catch {}
    return { success: false, error: 'PROXY_LOGIN_FAILED', message: error.message }
  }
}

// In-memory store for 2FA sessions (browser kept alive while waiting for PIN)
const proxyLoginSessions = new Map<string, {
  browser: any
  context: any
  page: any
  email: string
  proxyConfig: { server: string; username?: string; password?: string }
}>()

/**
 * Complete 2FA for a proxy login session.
 * Called after the user receives the PIN and enters it.
 */
export async function completeProxy2FA(
  sessionId: string,
  pin: string
): Promise<ProxyLoginResult> {
  const session = proxyLoginSessions.get(sessionId)
  if (!session) {
    return { success: false, error: 'SESSION_EXPIRED', message: 'Login session expired. Please try again.' }
  }

  const { browser, context, page, email } = session

  try {
    console.log(`🔢 Entering 2FA PIN for ${email}...`)

    // Find and fill the PIN input
    const pinInput = await page.$('input[name="pin"]')
    if (!pinInput) {
      proxyLoginSessions.delete(sessionId)
      await browser.close()
      return { success: false, error: 'NO_PIN_INPUT', message: 'PIN input not found. Session may have changed.' }
    }

    // Type PIN with human-like delays
    await pinInput.click()
    await delay(200)
    for (const char of pin) {
      await page.keyboard.type(char, { delay: 50 + Math.random() * 50 })
    }
    await delay(500)

    // Submit
    await page.click('button[type="submit"]')
    
    try {
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 })
    } catch { /* timeout ok */ }
    await delay(3000)

    const finalUrl = page.url()
    console.log('📍 Post-2FA URL:', finalUrl)

    if (finalUrl.includes('/login') || finalUrl.includes('checkpoint') || finalUrl.includes('challenge')) {
      proxyLoginSessions.delete(sessionId)
      await browser.close()
      return { success: false, error: 'INVALID_PIN', message: 'Invalid verification code or additional verification required.' }
    }

    // Navigate to feed
    if (!finalUrl.includes('/feed')) {
      try {
        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 15000 })
        await delay(2000)
      } catch { /* ok */ }
    }

    // Extract cookies
    const allCookies = await context.cookies()
    const cookiesObj: Record<string, string> = {}
    const importantCookies = ['li_at', 'JSESSIONID', 'bcookie', 'bscookie', 'lidc']
    for (const cookie of allCookies) {
      if (importantCookies.includes(cookie.name)) {
        cookiesObj[cookie.name] = cookie.value
      }
    }

    if (!cookiesObj.li_at) {
      proxyLoginSessions.delete(sessionId)
      await browser.close()
      return { success: false, error: 'NO_COOKIES', message: '2FA succeeded but no session cookie was created.' }
    }

    console.log(`🍪 Extracted ${Object.keys(cookiesObj).length} cookies after 2FA`)

    // Extract profile
    const csrfToken = cookiesObj.JSESSIONID || ''
    const profileData = await extractProfileViaAPI(page, csrfToken)

    proxyLoginSessions.delete(sessionId)
    await browser.close()

    return {
      success: true,
      cookies: cookiesObj,
      profileData: {
        name: profileData.name || null,
        profilePictureUrl: profileData.profilePictureUrl || null,
        headline: profileData.headline || null,
        location: profileData.location || null,
        jobTitle: profileData.jobTitle || null,
        company: profileData.company || null,
        profileUrl: profileData.profileUrl || null,
        connectionsCount: profileData.connectionsCount || null,
        about: profileData.about || null,
      },
    }
  } catch (error: any) {
    console.error('❌ 2FA completion error:', error.message)
    proxyLoginSessions.delete(sessionId)
    try { browser?.close() } catch {}
    return { success: false, error: '2FA_FAILED', message: error.message }
  }
}
