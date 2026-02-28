const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const fs = require('fs')

puppeteer.use(StealthPlugin())

async function checkHeyReachLinkedIn() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
    defaultViewport: null
  })

  try {
    const page = await browser.newPage()

    console.log('🌐 Navigating to HeyReach login...')
    await page.goto('https://app.heyreach.io/account/login', {
      waitUntil: 'networkidle2',
      timeout: 30000
    })

    await page.waitForTimeout(2000)

    console.log('🔐 Logging in...')
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 })
    await page.type('input[type="email"], input[name="email"]', 'happy.haplu@gmail.com', { delay: 50 })
    await page.waitForTimeout(500)
    
    await page.type('input[type="password"], input[name="password"]', 'System@123321', { delay: 50 })
    await page.waitForTimeout(500)
    
    await page.click('button[type="submit"]')
    
    console.log('⏳ Waiting for navigation...')
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
    
    await page.waitForTimeout(3000)
    
    console.log('📍 Current URL:', page.url())
    
    // Look for LinkedIn accounts link
    console.log('🔍 Looking for LinkedIn accounts...')
    
    // Try different selectors to find LinkedIn accounts page
    const links = await page.$$('a')
    for (const link of links) {
      const text = await page.evaluate(el => el.textContent, link)
      const href = await page.evaluate(el => el.href, link)
      if (text && (text.toLowerCase().includes('linkedin') || href.includes('linkedin'))) {
        console.log(`Found link: "${text}" -> ${href}`)
      }
    }
    
    // Navigate to LinkedIn accounts (try common URLs)
    const possibleUrls = [
      'https://app.heyreach.io/linkedin-accounts',
      'https://app.heyreach.io/accounts',
      'https://app.heyreach.io/settings/linkedin'
    ]
    
    for (const url of possibleUrls) {
      console.log(`\n🔍 Trying: ${url}`)
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(2000)
      
      // Take screenshot
      const filename = `/tmp/heyreach-${url.split('/').pop()}.png`
      await page.screenshot({ path: filename, fullPage: true })
      console.log(`📸 Screenshot saved: ${filename}`)
      
      // Check for account info
      const bodyText = await page.evaluate(() => document.body.innerText)
      if (bodyText.includes('aadarsh') || bodyText.includes('disconnect') || bodyText.includes('LinkedIn')) {
        console.log('✅ Found LinkedIn accounts page!')
        
        // Get HTML structure
        const html = await page.evaluate(() => {
          const accounts = document.querySelectorAll('[class*="account"], [class*="linkedin"], tr, li')
          return Array.from(accounts).slice(0, 5).map(el => el.outerHTML).join('\n\n---\n\n')
        })
        
        fs.writeFileSync('/tmp/heyreach-accounts-html.txt', html)
        console.log('📝 HTML saved to /tmp/heyreach-accounts-html.txt')
        break
      }
    }
    
    console.log('\n⏸️  Browser will stay open for 120 seconds for manual exploration...')
    await page.waitForTimeout(120000)

  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await browser.close()
  }
}

checkHeyReachLinkedIn()
