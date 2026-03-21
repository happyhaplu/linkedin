import dotenv from 'dotenv'
dotenv.config({ path: '/home/harekrishna/Projects/Linkedin/.env.local' })

import { DbClient } from '../lib/db/query-builder'
import { chromium } from 'playwright'
import { sessionCookiesToPlaywright } from '../lib/linkedin-cookie-auth'

async function main() {
  const sb = new DbClient()

  // 1. Fetch cookies from DB
  const { data: account } = await sb
    .from('linkedin_accounts')
    .select('id, email, session_cookies, status')
    .eq('id', 'b4884875-d423-402f-b717-2e339bc34223')
    .single()

  if (!account) { console.error('Account not found'); process.exit(1) }

  console.log('Account:', account.email, '| status:', account.status)
  console.log('session_cookies keys:', Object.keys(account.session_cookies || {}))
  console.log('li_at length:', account.session_cookies?.li_at?.length)
  console.log('li_at prefix:', account.session_cookies?.li_at?.substring(0, 30))

  // 2. Convert to Playwright format
  const pwCookies = sessionCookiesToPlaywright(account.session_cookies)
  console.log('\nPlaywright cookies:')
  pwCookies.forEach((c: any) => console.log(`  ${c.name} = ${c.value.substring(0, 25)}... (domain: ${c.domain})`))

  // 3. Launch browser and set cookies
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  })

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  await context.addCookies(pwCookies)

  // 4. Verify cookies were set
  const setCookies = await context.cookies('https://www.linkedin.com')
  console.log('\nCookies in browser context:')
  setCookies.forEach(c => console.log(`  ${c.name} = ${c.value.substring(0, 25)}... (domain: ${c.domain})`))

  // 5. Navigate to LinkedIn feed
  const page = await context.newPage()
  console.log('\nNavigating to https://www.linkedin.com/feed ...')

  try {
    const response = await page.goto('https://www.linkedin.com/feed', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    console.log('Response status:', response?.status())
    console.log('Final URL:', page.url())

    const url = page.url()
    if (url.includes('/feed') || url.includes('/in/')) {
      console.log('\n✅ COOKIE IS VALID — LinkedIn session works!')
    } else if (url.includes('/login') || url.includes('authwall')) {
      console.log('\n❌ COOKIE IS EXPIRED — landed on login page')
      console.log('URL:', url)
    } else {
      console.log('\n⚠️ UNEXPECTED URL:', url)
    }

    // Try to get page title
    const title = await page.title()
    console.log('Page title:', title)

  } catch (err: any) {
    console.error('\n❌ Navigation failed:', err.message)
    if (err.message.includes('ERR_TOO_MANY_REDIRECTS')) {
      console.log('This means the cookie is INVALID or EXPIRED')
    }
  }

  await browser.close()
}

main().catch(console.error)
