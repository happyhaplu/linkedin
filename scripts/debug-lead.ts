import { DbClient } from '../lib/db/query-builder'
import { sessionCookiesToPlaywright } from '../lib/linkedin-cookie-auth'
import { chromium } from 'playwright'

const sb = new DbClient()

async function checkProfile(profileUrl: string, cookies: any[]) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  await context.addCookies(cookies)
  const page = await context.newPage()

  // Normalize URL
  let url = profileUrl.trim().replace(/^http:\/\//i, 'https://')
  url = url.replace(/^https:\/\/linkedin\.com\//i, 'https://www.linkedin.com/')
  url = url.split('?')[0].replace(/\/+$/, '')

  console.log(`\n--- Profile: ${url} ---`)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)

  const finalUrl = page.url()
  console.log(`  Final URL: ${finalUrl}`)

  // Check for 404 / unavailable
  const pageText = await page.textContent('body').catch(() => '')
  if (finalUrl.includes('/404') || (pageText || '').includes('Page not found')) {
    console.log('  ❌ Profile not found (404)')
    await browser.close()
    return
  }

  // Count all buttons
  const allButtons = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.textContent?.trim(),
      ariaLabel: b.getAttribute('aria-label'),
      className: b.className?.slice(0, 60)
    })).filter(b => b.text && b.text.length < 50).slice(0, 20)
  )
  console.log('  All buttons:', JSON.stringify(allButtons, null, 2))

  // Specific checks
  const hasMessage = await page.locator('button:has-text("Message")').count()
  const hasConnect = await page.locator('button:has-text("Connect")').count()
  const hasPending = await page.locator('button:has-text("Pending"), button:has-text("Withdraw")').count()
  const hasMore = await page.locator('button:has-text("More")').count()

  console.log(`  Message buttons: ${hasMessage}`)
  console.log(`  Connect buttons: ${hasConnect}`)
  console.log(`  Pending/Withdraw buttons: ${hasPending}`)
  console.log(`  More buttons: ${hasMore}`)

  // Check degree badge
  const degree = await page.locator('.dist-value, [class*="degree"]').first().textContent().catch(() => 'not found')
  console.log(`  Degree badge: ${degree}`)

  await browser.close()
}

async function main() {
  const { data: acct } = await sb.from('linkedin_accounts')
    .select('session_cookies')
    .eq('id', '67b75216-06b0-49b1-9470-234588fdba45').single()
  const cookies = sessionCookiesToPlaywright(acct!.session_cookies)

  // Check the leads that were wrongly marked "Already connected"
  const { data: leads } = await sb.from('campaign_leads')
    .select('lead:leads(full_name, linkedin_url)')
    .eq('campaign_id', 'c644a9b8-7df9-411f-95f7-dd9831abf34f')
  
  for (const l of (leads || []).slice(0, 4)) {
    const lead = Array.isArray(l.lead) ? l.lead[0] : l.lead as any
    if (lead?.linkedin_url) {
      await checkProfile(lead.linkedin_url, cookies)
    }
  }
}

main().catch(console.error)
