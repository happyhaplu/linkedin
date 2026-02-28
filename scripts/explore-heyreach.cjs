const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const fs = require('fs')

puppeteer.use(StealthPlugin())

async function exploreHeyReach() {
  const browser = await puppeteer.launch({
    headless: false, // Show browser so we can see what's happening
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })

    console.log('🌐 Navigating to HeyReach login...')
    await page.goto('https://app.heyreach.io/account/login', {
      waitUntil: 'networkidle2',
      timeout: 30000
    })

    await page.waitForTimeout(2000)

    console.log('🔐 Logging in...')
    // Find and fill email
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 })
    await page.type('input[type="email"], input[name="email"]', 'happy.haplu@gmail.com', { delay: 50 })
    
    await page.waitForTimeout(500)
    
    // Find and fill password
    await page.type('input[type="password"], input[name="password"]', 'F#wk&?7KiZ8?h5v', { delay: 50 })
    
    await page.waitForTimeout(500)
    
    // Click login button
    await page.click('button[type="submit"]')
    
    console.log('⏳ Waiting for navigation...')
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
    
    await page.waitForTimeout(3000)
    
    console.log('📍 Current URL:', page.url())
    
    // Navigate to LinkedIn accounts page
    console.log('🔍 Looking for LinkedIn accounts menu...')
    await page.waitForTimeout(2000)
    
    // Try to find and click on LinkedIn accounts or similar
    const possibleSelectors = [
      'a[href*="linkedin"]',
      'a[href*="account"]',
      'button:has-text("LinkedIn")',
      'nav a'
    ]
    
    for (const selector of possibleSelectors) {
      try {
        const elements = await page.$$(selector)
        if (elements.length > 0) {
          console.log(`Found ${elements.length} elements matching: ${selector}`)
          for (let i = 0; i < Math.min(3, elements.length); i++) {
            const text = await page.evaluate(el => el.textContent, elements[i])
            const href = await page.evaluate(el => el.href || el.getAttribute('href'), elements[i])
            console.log(`  - ${text} (${href})`)
          }
        }
      } catch (e) {}
    }
    
    // Take screenshot
    await page.screenshot({ path: '/tmp/heyreach-dashboard.png', fullPage: true })
    console.log('📸 Screenshot saved to /tmp/heyreach-dashboard.png')
    
    console.log('\n⏸️  Browser will stay open for 60 seconds for manual exploration...')
    await page.waitForTimeout(60000)

  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await browser.close()
  }
}

exploreHeyReach()
