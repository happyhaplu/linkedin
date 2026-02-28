// lib/linkedin-network-sync.ts
// @ts-nocheck
/* eslint-disable */
import { chromium } from 'playwright'
import { createClient } from '@/lib/supabase/server'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

interface NetworkSyncResult {
  total_connections_synced: number
  new_connections_added: number
  connections_updated: number
  total_requests_synced?: number
  pending_requests?: number
  accepted_requests?: number
}

/**
 * Sync LinkedIn network connections using session cookies
 */
export async function syncLinkedInNetwork(
  cookies: any,
  linkedinAccountId: string,
  userId: string,
  syncType: 'full' | 'incremental' | 'connection_requests' = 'full'
): Promise<NetworkSyncResult> {
  let browser
  const supabase = await createClient()
  
  try {
    console.log('🚀 Launching Playwright browser with stealth mode...')
    
    // Launch browser with anti-detection flags
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--start-maximized',
      ]
    })

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Upgrade-Insecure-Requests': '1'
      }
    })
    
    // Add init script to override navigator properties
    await context.addInitScript(() => {
      // Override webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      })
      
      // Add chrome object
      window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      }
      
      // Override permissions
      const originalQuery = window.navigator.permissions.query
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      )
      
      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      })
      
      // Mock languages  
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      })
    })

    const page = await context.newPage()
    
    // Set all LinkedIn cookies to match user's browser session exactly
    console.log('🍪 Setting LinkedIn session cookies...')
    
    // Extract li_at from cookies object
    const li_at = typeof cookies === 'string' ? cookies : cookies.li_at
    
    if (!li_at) {
      throw new Error('No li_at cookie provided')
    }
    
    // Parse cookies if it's a JSON string
    let cookiesObj = cookies
    if (typeof cookies === 'string') {
      try {
        const parsed = JSON.parse(cookies)
        
        // Check if it's an array (browser extension format)
        if (Array.isArray(parsed)) {
          console.log('📦 Detected browser extension cookie format (array)')
          const keyNames = ['li_at', 'JSESSIONID', 'bcookie', 'lidc', 'bscookie']
          const converted: any = {}
          parsed.forEach((cookie: any) => {
            if (keyNames.includes(cookie.name)) {
              // Remove quotes if present
              let value = cookie.value
              if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1)
              }
              converted[cookie.name] = value
            }
          })
          cookiesObj = converted
          console.log('✅ Converted to object format')
        } else {
          cookiesObj = parsed
        }
      } catch {
        cookiesObj = { li_at: cookies }
      }
    }
    
    // Set all LinkedIn cookies with proper Playwright format
    const cookiesToSet: any[] = []
    
    // Always set li_at
    cookiesToSet.push({
      name: 'li_at',
      value: cookiesObj.li_at || li_at,
      domain: '.linkedin.com',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax' as const
    })
    
    // Add other cookies if available and not empty
    if (cookiesObj.JSESSIONID && cookiesObj.JSESSIONID.trim()) {
      cookiesToSet.push({
        name: 'JSESSIONID',
        value: cookiesObj.JSESSIONID,
        domain: '.www.linkedin.com',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax' as const
      })
    }
    
    if (cookiesObj.bcookie && cookiesObj.bcookie.trim()) {
      cookiesToSet.push({
        name: 'bcookie',
        value: cookiesObj.bcookie,
        domain: '.linkedin.com',
        path: '/',
        secure: true,
        sameSite: 'Lax' as const
      })
    }
    
    if (cookiesObj.bscookie && cookiesObj.bscookie.trim()) {
      cookiesToSet.push({
        name: 'bscookie',
        value: cookiesObj.bscookie,
        domain: '.linkedin.com',
        path: '/',
        secure: true,
        sameSite: 'Lax' as const
      })
    }
    
    if (cookiesObj.lidc && cookiesObj.lidc.trim()) {
      cookiesToSet.push({
        name: 'lidc',
        value: cookiesObj.lidc,
        domain: '.linkedin.com',
        path: '/',
        secure: true,
        sameSite: 'Lax' as const
      })
    }
    
    await context.addCookies(cookiesToSet)
    console.log(`✅ Set ${cookiesToSet.length} cookies successfully`)
    await delay(1000)

    console.log('🔗 Navigating to My Network...')

    // Navigate like a real user: go to feed first, then to connections
    let navigationSuccess = false
    
    try {
      // Step 1: Load feed page first (this is what real users do)
      console.log('📰 Loading LinkedIn feed...')
      await page.goto('https://www.linkedin.com/feed/', {
        waitUntil: 'domcontentloaded',
        timeout: 45000
      })
      
      await delay(2000)
      
      const feedUrl = page.url()
      console.log('📍 Feed URL:', feedUrl)
      
      // Check if we're logged in
      if (feedUrl.includes('/login') || feedUrl.includes('authwall')) {
        throw new Error('Session invalid - redirected to login')
      }
      
      console.log('✅ Feed loaded successfully')
      
      // Step 2: Now navigate to connections (like clicking the link)
      console.log('🔗 Navigating to connections...')
      await page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/', {
        waitUntil: 'domcontentloaded',
        timeout: 45000
      })
      
      await delay(3000)
      
      const currentUrl = page.url()
      console.log('📍 Connections URL:', currentUrl)
      
      // Check if we're on the right page
      if (currentUrl.includes('/login') || currentUrl.includes('authwall')) {
        throw new Error('Redirected to login after accessing connections page')
      }
      
      navigationSuccess = true
      console.log('✅ Successfully navigated to connections page')
      
      // Wait for the page to be fully loaded and stable
      await delay(3000)
      console.log('⏳ Waiting for page to stabilize...')
      
      // Wait for network idle
      try {
        await page.waitForLoadState('networkidle', { timeout: 10000 })
        console.log('✅ Page is stable')
      } catch (e) {
        console.log('⚠️ Page still loading, continuing anyway...')
      }
      
    } catch (error: any) {
      console.error('❌ Navigation error:', error.message)
      
      if (error.message.includes('ERR_TOO_MANY_REDIRECTS')) {
        throw new Error(
          '🚫 Unable to Access LinkedIn\n\n' +
          'LinkedIn is preventing automated access. This can happen due to:\n' +
          '• Outdated or incomplete cookies\n' +
          '• LinkedIn detecting automation patterns\n' +
          '• Account security restrictions\n\n' +
          '✅ Solution - Get ALL cookies from your browser:\n\n' +
          '1. Open LinkedIn in Chrome and make sure you are logged in\n' +
          '2. Press F12 → Application → Cookies → https://www.linkedin.com\n' +
          '3. Copy these cookie values:\n' +
          '   - li_at (required)\n' +
          '   - JSESSIONID (required)\n' +
          '   - bcookie (recommended)\n' +
          '   - lidc (recommended)\n\n' +
          '4. Go to LinkedIn Account page → Disconnect Account\n' +
          '5. Reconnect and provide ALL the cookies\n\n' +
          '💡 Tip: The more cookies you provide, the better it works!'
        )
      }
      
      throw error
    }

    if (!navigationSuccess) {
      throw new Error('Failed to navigate to LinkedIn connections page')
    }

    console.log('📊 Extracting connections...')
    
    // Debug: Take a screenshot and log page structure
    try {
      await page.screenshot({ 
        path: '/tmp/linkedin-connections.png',
        fullPage: false 
      })
      console.log('📸 Screenshot saved to /tmp/linkedin-connections.png')
    } catch (e) {
      console.log('⚠️ Could not save screenshot:', e)
    }
    
    // First, try to extract visible connections without scrolling
    console.log('🔍 Extracting visible connections first...')
    
    const visibleConnections = await page.evaluate(() => {
      const items: any[] = []
      const links = document.querySelectorAll('a[href*="/in/"]')
      
      links.forEach((link) => {
        const href = link.getAttribute('href')
        if (href && href.includes('/in/')) {
          const match = href.match(/\/in\/([^/?]+)/)
          if (match) {
            const name = link.textContent?.trim() || link.getAttribute('aria-label') || ''
            if (name) {
              items.push({
                profile_id: match[1],
                name: name,
                url: href.startsWith('http') ? href : `https://www.linkedin.com${href.split('?')[0]}`
              })
            }
          }
        }
      })
      
      return items.filter((item, index, self) => 
        index === self.findIndex((t) => t.profile_id === item.profile_id)
      )
    }).catch(() => [])
    
    console.log(`Found ${visibleConnections.length} visible connections before scrolling`)


    // Wait for content to load
    await delay(3000)

    // Scroll to load more connections
    let previousHeight = 0
    let scrollAttempts = 0
    const maxScrolls = syncType === 'full' ? 15 : 5 // Reduced from 20 to 15 for stability
    
    console.log(`🔄 Starting scroll (max ${maxScrolls} scrolls)...`)
    
    while (scrollAttempts < maxScrolls) {
      const currentHeight = await page.evaluate(() => document.body.scrollHeight)
      
      if (currentHeight === previousHeight) {
        console.log('⏹️ No more content to load')
        break // No more content to load
      }
      
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await delay(2500) // Increased delay for content to load
      
      previousHeight = currentHeight
      scrollAttempts++
      console.log(`📜 Scroll ${scrollAttempts}/${maxScrolls} - Height: ${currentHeight}`)
    }

    console.log('🔍 Extracting detailed connection data from page...')

    // Re-extract all connections with more details after scrolling
    let connections: any[] = []
    
    connections = await page.evaluate(() => {
      const connectionsList: any[] = []
      
      const getText = (el: Element | null): string => {
        if (!el) return ''
        return el.textContent?.trim() || ''
      }
      
      // Find all list items that might contain connections
      const listItems = document.querySelectorAll('li')
      
      listItems.forEach((li) => {
        // Find profile link in this list item
        const profileLink = li.querySelector('a[href*="/in/"]')
        if (!profileLink) return
        
        const href = profileLink.getAttribute('href')
        if (!href) return
        
        const match = href.match(/\/in\/([^/?]+)/)
        if (!match) return
        
        const data: any = {
          connection_profile_id: match[1],
          connection_linkedin_url: href.startsWith('http') ? href : `https://www.linkedin.com${href.split('?')[0]}`
        }
        
        // Get name - try multiple approaches
        const nameFromLink = getText(profileLink)
        const nameFromSpan = getText(li.querySelector('span[aria-hidden="true"]'))
        const nameFromDiv = getText(li.querySelector('div.mn-connection-card__name'))
        
        data.name = nameFromSpan || nameFromDiv || nameFromLink || data.connection_profile_id.replace(/-/g, ' ')
        
        // Get profile picture
        const img = li.querySelector('img')
        if (img) {
          const src = img.getAttribute('src')
          if (src && !src.includes('data:image') && !src.includes('ghost')) {
            data.profile_picture_url = src
          }
        }
        
        // Get headline (job title)
        const headlineEl = li.querySelector('div.mn-connection-card__occupation, .artdeco-entity-lockup__subtitle, .t-14')
        if (headlineEl) {
          data.headline = getText(headlineEl)
          
          // Extract position and company from headline
          if (data.headline.includes(' at ')) {
            const parts = data.headline.split(' at ')
            data.position = parts[0].trim()
            data.company = parts[1].split('|')[0].trim()
          } else {
            data.position = data.headline.split('|')[0].trim()
          }
        }
        
        // Get location
        const locationEl = li.querySelector('.mn-connection-card__location, .artdeco-entity-lockup__caption, .t-12')
        if (locationEl) {
          const loc = getText(locationEl)
          if (loc && loc !== data.headline) {
            data.location = loc
          }
        }
        
        if (data.name && data.connection_profile_id) {
          connectionsList.push(data)
        }
      })
      
      // Remove duplicates based on connection_profile_id
      const uniqueConnections = Array.from(
        new Map(connectionsList.map(c => [c.connection_profile_id, c])).values()
      )
      
      return uniqueConnections
    }).catch((error: any) => {
      console.error('⚠️ Error during data extraction:', error.message)
      return []
    })

    console.log(`✅ Extracted ${connections.length} connections`)
    
    // Log sample of extracted data for debugging
    if (connections.length > 0) {
      console.log('\n📊 Sample extracted data:')
      const sample = connections[0]
      console.log(`  Name: ${sample.name}`)
      console.log(`  Headline: ${sample.headline || 'N/A'}`)
      console.log(`  Company: ${sample.company || 'N/A'}`)
      console.log(`  Position: ${sample.position || 'N/A'}`)
      console.log(`  Location: ${sample.location || 'N/A'}`)
      console.log(`  Profile URL: ${sample.connection_linkedin_url || 'N/A'}`)
      console.log(`  Picture: ${sample.profile_picture_url ? 'Yes' : 'No'}\n`)
    }

    await browser.close()

    // Now save connections to database
    let newCount = 0
    let updatedCount = 0

    for (const conn of connections) {
      try {
        // Check if connection already exists
        const { data: existing } = await supabase
          .from('network_connections')
          .select('id')
          .eq('linkedin_account_id', linkedinAccountId)
          .eq('connection_profile_id', conn.connection_profile_id)
          .single()

        if (existing) {
          // Update existing connection
          await supabase
            .from('network_connections')
            .update({
              full_name: conn.name,
              headline: conn.headline,
              profile_picture_url: conn.profile_picture_url,
              connection_linkedin_url: conn.connection_linkedin_url,
              location: conn.location,
              company: conn.company,
              position: conn.position,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
          
          console.log(`📝 Updated: ${conn.name} - ${conn.company || 'No company'}`)
          updatedCount++
        } else {
          // Insert new connection
          await supabase
            .from('network_connections')
            .insert({
              user_id: userId,
              linkedin_account_id: linkedinAccountId,
              connection_profile_id: conn.connection_profile_id,
              full_name: conn.name,
              headline: conn.headline,
              profile_picture_url: conn.profile_picture_url,
              connection_linkedin_url: conn.connection_linkedin_url,
              location: conn.location,
              company: conn.company,
              position: conn.position,
              connection_status: 'connected',
              connected_at: new Date().toISOString(),
              last_synced_at: new Date().toISOString()
            })
          
          console.log(`✨ Added: ${conn.name} - ${conn.company || 'No company'}`)
          newCount++
        }
      } catch (dbError: any) {
        console.error(`Error saving connection ${conn.name}:`, dbError.message)
      }
    }

    console.log(`💾 Database: ${newCount} new, ${updatedCount} updated`)

    return {
      total_connections_synced: connections.length,
      new_connections_added: newCount,
      connections_updated: updatedCount
    }

  } catch (error: any) {
    console.error('❌ Network sync error:', error.message)
    
    if (browser) {
      await browser.close()
    }
    
    throw error
  } finally {
    // Ensure browser is always closed
    if (browser && !browser.isConnected()) {
      try {
        await browser.close()
      } catch (e) {
        // Browser already closed
      }
    }
  }
}

/**
 * Get connection count from LinkedIn profile
 */
export async function getLinkedInConnectionCount(li_at_cookie: string): Promise<number> {
  let browser
  
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const context = await browser.newContext()
    const page = await context.newPage()
    
    await context.addCookies([{
      name: 'li_at',
      value: li_at_cookie,
      domain: '.linkedin.com',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'None' as const
    }])

    await page.goto('https://www.linkedin.com/in/me/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    })

    await delay(2000)

    const count = await page.evaluate(() => {
      const connectionsEl = document.querySelector('span.t-bold')
      if (connectionsEl && connectionsEl.textContent?.includes('connection')) {
        const match = connectionsEl.textContent.match(/(\d+[\d,]*)\+?/)
        if (match) return parseInt(match[1].replace(/,/g, ''))
      }
      return 0
    })

    await browser.close()
    return count

  } catch (error) {
    if (browser) {
      await browser.close()
    }
    return 0
  }
}
