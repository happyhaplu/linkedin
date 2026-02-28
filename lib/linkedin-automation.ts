// @ts-nocheck
/* eslint-disable */
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin())

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Store active browser sessions
const activeSessions = new Map()

export interface LinkedInLoginResult {
  success: boolean
  cookies?: {
    li_at: string
    JSESSIONID?: string
  }
  profileData?: {
    name?: string
    headline?: string
    profilePictureUrl?: string
    jobTitle?: string
    company?: string
    location?: string
    profileUrl?: string
    connectionsCount?: number
    about?: string
  }
  error?: string
  sessionId?: string
}

export async function loginToLinkedIn(
  email: string,
  password: string,
  otpCode?: string
): Promise<LinkedInLoginResult> {
  let browser
  
  try {
    console.log('🚀 Launching browser...')
    
    // Launch headless browser with more realistic settings
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      ignoreDefaultArgs: ['--enable-automation']
    })

    const page = await browser.newPage()
    
    // Set realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 })
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    
    // Remove webdriver property
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      })
    })

    console.log('📄 Navigating to LinkedIn login...')
    
    // Navigate to LinkedIn login page
    await page.goto('https://www.linkedin.com/login', {
      waitUntil: 'networkidle2',
      timeout: 30000
    })

    // Wait for login form
    await page.waitForSelector('#username', { timeout: 10000 })
    
    console.log('✍️ Filling in credentials...')
    
    // Add random delay to appear more human
    await delay(1000 + Math.random() * 1000)
    
    // Fill in email with random delays
    await page.type('#username', email, { delay: 50 + Math.random() * 100 })
    
    // Random pause between fields
    await delay(500 + Math.random() * 500)
    
    // Fill in password with random delays
    await page.type('#password', password, { delay: 50 + Math.random() * 100 })
    
    // Random pause before clicking
    await delay(500 + Math.random() * 500)
    
    console.log('🔐 Submitting login form...')
    
    // Click sign in button
    await page.click('button[type="submit"]')
    
    // Wait for navigation
    await page.waitForNavigation({ 
      waitUntil: 'networkidle2',
      timeout: 30000 
    }).catch(() => {
      console.log('Navigation timeout - checking if login successful anyway...')
    })

    // Check current URL
    const currentUrl = page.url()
    console.log('📍 Current URL:', currentUrl)

    // Check if 2FA/OTP or security checkpoint is required
    if (currentUrl.includes('checkpoint') || currentUrl.includes('challenge')) {
      console.log('🔒 Security checkpoint detected - attempting to bypass...')
      
      // Wait a bit for the page to fully load
      await delay(3000)
      
      // Try to find and click "Skip" / "Not now" / "Verify later" buttons
      const skipSelectors = [
        'button[data-tracking-control-name*="skip"]',
        'button:has-text("Skip")',
        'button:has-text("Not now")',
        'button:has-text("Verify later")',
        'button.secondary-action',
        'button[aria-label*="Skip"]',
        'a:has-text("Skip")',
        'a:has-text("Not now")'
      ]
      
      let skipped = false
      for (const selector of skipSelectors) {
        try {
          const skipButton = await page.$(selector)
          if (skipButton) {
            console.log(`✅ Found skip button: ${selector}`)
            await skipButton.click()
            await delay(2000)
            
            // Wait for navigation
            await page.waitForNavigation({ 
              waitUntil: 'networkidle2',
              timeout: 10000 
            }).catch(() => {})
            
            skipped = true
            break
          }
        } catch (e) {
          continue
        }
      }
      
      // If we couldn't skip and no OTP is provided, store session and wait
      if (!skipped && !otpCode) {
        console.log('⏳ Waiting for checkpoint to auto-resolve...')
        await delay(5000)
        
        // Check if we've moved past the checkpoint
        const newUrl = page.url()
        if (newUrl.includes('checkpoint') || newUrl.includes('challenge')) {
          // Still on checkpoint, check if it's asking for verification
          const hasOTPInput = await page.$('input[name="pin"]').catch(() => null)
          
          if (hasOTPInput) {
            // Store the browser session for later use
            const sessionId = `${email}-${Date.now()}`
            console.log('💾 Storing browser session:', sessionId)
            activeSessions.set(sessionId, { browser, page, email })
            
            // Auto-cleanup after 5 minutes
            setTimeout(() => {
              if (activeSessions.has(sessionId)) {
                console.log('🧹 Cleaning up expired session:', sessionId)
                const session = activeSessions.get(sessionId)
                if (session?.browser) {
                  session.browser.close().catch(() => {})
                }
                activeSessions.delete(sessionId)
              }
            }, 5 * 60 * 1000)
            
            return {
              success: false,
              error: '2FA_REQUIRED',
              sessionId
            }
          }
          
          // Try to navigate to feed to trigger checkpoint bypass
          console.log('🔄 Attempting to navigate to feed...')
          try {
            await page.goto('https://www.linkedin.com/feed/', {
              waitUntil: 'networkidle2',
              timeout: 15000
            })
            await delay(3000)
            
            // Check if still on checkpoint
            if (page.url().includes('checkpoint') || page.url().includes('challenge')) {
              console.log('⚠️ Still on security checkpoint after navigation')
              // Store session for manual verification
              const sessionId = `${email}-${Date.now()}`
              activeSessions.set(sessionId, { browser, page, email })
              
              setTimeout(() => {
                if (activeSessions.has(sessionId)) {
                  const session = activeSessions.get(sessionId)
                  if (session?.browser) {
                    session.browser.close().catch(() => {})
                  }
                  activeSessions.delete(sessionId)
                }
              }, 5 * 60 * 1000)
              
              return {
                success: false,
                error: 'SECURITY_CHECKPOINT',
                sessionId
              }
            }
          } catch (e) {
            console.log('⏳ Waiting additional time for security check...')
            await delay(5000)
          }
        }
      }
      
      // Handle OTP verification if code is provided
      if (otpCode) {
        console.log('🔢 Entering OTP code...')
        const otpInput = await page.$('input[name="pin"]')
        if (otpInput) {
          await page.type('input[name="pin"]', otpCode, { delay: 100 })
          await page.click('button[type="submit"]')
          
          await page.waitForNavigation({ 
            waitUntil: 'networkidle2',
            timeout: 30000 
          }).catch(() => {})
        }
      }
    }

    // Check if login was successful
    const finalUrl = page.url()
    
    if (finalUrl.includes('/login') || finalUrl.includes('error') || finalUrl.includes('checkpoint') || finalUrl.includes('challenge')) {
      console.log('❌ Login failed - still on login/checkpoint page:', finalUrl)
      
      // Check if there's an error message on the login page
      let hasErrorMessage = false
      try {
        const errorElement = await page.$('.form__input--error, .alert, [data-test-id="alert"]')
        hasErrorMessage = !!errorElement
      } catch (e) {
        // No error element found
      }
      
      // If on checkpoint or back on login without error message, it's likely automation detection
      if (finalUrl.includes('checkpoint') || finalUrl.includes('challenge') || (finalUrl.includes('/login') && !hasErrorMessage)) {
        const sessionId = `${email}-${Date.now()}`
        console.log('💾 Storing browser session for manual verification:', sessionId)
        activeSessions.set(sessionId, { browser, page, email })
        
        setTimeout(() => {
          if (activeSessions.has(sessionId)) {
            const session = activeSessions.get(sessionId)
            if (session?.browser) {
              session.browser.close().catch(() => {})
            }
            activeSessions.delete(sessionId)
          }
        }, 5 * 60 * 1000)
        
        return {
          success: false,
          error: 'SECURITY_CHECKPOINT',
          sessionId
        }
      }
      
      await browser.close()
      return {
        success: false,
        error: 'INVALID_CREDENTIALS'
      }
    }

    console.log('✅ Login successful!')
    
    // Extract cookies
    const cookies = await page.cookies()
    const li_at = cookies.find(c => c.name === 'li_at')
    const jsessionid = cookies.find(c => c.name === 'JSESSIONID')

    if (!li_at) {
      console.log('❌ Could not find li_at cookie')
      console.log('📊 Available cookies:', cookies.map(c => c.name).join(', '))
      await browser.close()
      return {
        success: false,
        error: 'COOKIE_NOT_FOUND'
      }
    }

    console.log('🍪 Extracted cookies successfully')

    // Try to get profile data
    let profileData: { name?: string; profilePictureUrl?: string } = {}
    try {
      await page.goto('https://www.linkedin.com/feed/', { 
        waitUntil: 'networkidle2',
        timeout: 15000 
      })
      
      // Extract profile name and picture if available
      const name = await page.$eval('.global-nav__me-photo', 
        (el) => el.getAttribute('alt')
      ).catch(() => null)
      
      const profilePictureUrl = await page.$eval('.global-nav__me-photo', 
        (el) => (el as HTMLImageElement).src
      ).catch(() => null)
      
      if (name) {
        profileData.name = name
      }
      if (profilePictureUrl) {
        profileData.profilePictureUrl = profilePictureUrl
      }
    } catch (e) {
      console.log('Could not extract profile data, but login was successful')
    }

    await browser.close()

    return {
      success: true,
      cookies: {
        li_at: li_at.value,
        JSESSIONID: jsessionid?.value
      },
      profileData
    }

  } catch (error: any) {
    console.error('❌ LinkedIn automation error:', error.message)
    
    if (browser) {
      await browser.close()
    }

    return {
      success: false,
      error: error.message || 'AUTOMATION_FAILED'
    }
  }
}

export async function continueLinkedInLogin(
  sessionId: string,
  otpCode: string
): Promise<LinkedInLoginResult> {
  console.log('🔄 Continuing login with session:', sessionId)
  
  const session = activeSessions.get(sessionId)
  if (!session) {
    console.error('❌ Session not found:', sessionId)
    return {
      success: false,
      error: 'SESSION_EXPIRED'
    }
  }

  const { browser, page, email } = session
  
  try {
    console.log('🔢 Entering OTP code in existing session...')
    
    // Check current page state
    const currentUrl = page.url()
    console.log('📍 Current page:', currentUrl)
    
    // If still on checkpoint/login page without PIN field, session needs manual verification
    if (currentUrl.includes('/login') || (currentUrl.includes('checkpoint') && !currentUrl.includes('pin'))) {
      console.log('⚠️ Session is on checkpoint/login page, not PIN verification')
      // Don't close browser - keep it open for manual verification
      return {
        success: false,
        error: 'SECURITY_CHECKPOINT',
        sessionId
      }
    }
    
    // Enter the OTP code
    const otpInput = await page.$('input[name="pin"]')
    if (!otpInput) {
      console.log('⚠️ PIN input field not found on page')
      return {
        success: false,
        error: 'PIN_FIELD_NOT_FOUND',
        sessionId
      }
    }
    
    await page.type('input[name="pin"]', otpCode, { delay: 100 })
    
    // Add small delay before clicking
    await delay(500)
    
    // Click submit button
    await page.click('button[type="submit"]')
    
    // Wait for navigation
    await page.waitForNavigation({ 
      waitUntil: 'networkidle2',
      timeout: 30000 
    }).catch(() => {
      console.log('Navigation timeout after PIN - checking if login successful...')
    })

    // Check if login was successful
    const finalUrl = page.url()
    
    if (finalUrl.includes('/login') || finalUrl.includes('error')) {
      console.log('❌ Login failed - invalid PIN or credentials')
      await browser.close()
      activeSessions.delete(sessionId)
      return {
        success: false,
        error: 'INVALID_CREDENTIALS'
      }
    }

    console.log('✅ Login successful after PIN verification!')
    
    // Extract cookies
    const cookies = await page.cookies()
    const li_at = cookies.find(c => c.name === 'li_at')
    const jsessionid = cookies.find(c => c.name === 'JSESSIONID')

    if (!li_at) {
      console.log('❌ Could not find li_at cookie')
      await browser.close()
      activeSessions.delete(sessionId)
      return {
        success: false,
        error: 'COOKIE_NOT_FOUND'
      }
    }

    console.log('🍪 Extracted cookies successfully')

    // Try to get profile data
    let profileData = {}
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
      
      if (name) {
        profileData = { name }
      }
      if (profilePictureUrl) {
        (profileData as any).profilePictureUrl = profilePictureUrl
      }
    } catch (e) {
      console.log('Could not extract profile data, but login was successful')
    }

    await browser.close()
    activeSessions.delete(sessionId)

    return {
      success: true,
      cookies: {
        li_at: li_at.value,
        JSESSIONID: jsessionid?.value
      },
      profileData
    }

  } catch (error: any) {
    console.error('❌ PIN verification error:', error.message)
    
    if (browser) {
      await browser.close()
    }
    activeSessions.delete(sessionId)

    return {
      success: false,
      error: error.message || 'VERIFICATION_FAILED'
    }
  }
}

export async function validateLinkedInCookie(li_at: string): Promise<boolean> {
  let browser
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const page = await browser.newPage()
    
    // Set the cookie
    await page.setCookie({
      name: 'li_at',
      value: li_at,
      domain: '.linkedin.com',
      path: '/',
      httpOnly: true,
      secure: true
    })

    // Try to access LinkedIn feed
    const response = await page.goto('https://www.linkedin.com/feed/', {
      waitUntil: 'networkidle2',
      timeout: 15000
    })

    const url = page.url()
    
    await browser.close()

    // If redirected to login, cookie is invalid
    return !url.includes('/login')

  } catch (error) {
    if (browser) {
      await browser.close()
    }
    return false
  }
}
