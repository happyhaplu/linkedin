import { createClient } from '@supabase/supabase-js'
import { sessionCookiesToPlaywright } from '../lib/linkedin-cookie-auth'
import { chromium } from 'playwright'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function checkProfile(url: string) {
  const { data: acct } = await sb.from('linkedin_accounts')
    .select('id, email, session_cookies')
    .eq('id', '67b75216-06b0-49b1-9470-234588fdba45').single()

  const cookies = sessionCookiesToPlaywright(acct!.session_cookies)
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' })
  await context.addCookies(cookies)
  const page = await context.newPage()

  const normalized = url.trim().replace(/^http:\/\//, 'https://').replace(/^https:\/\/linkedin\.com\//, 'https://www.linkedin.com/')
  console.log(`\n--- Checking: ${normalized} ---`)
  await page.goto(normalized, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)

  const finalUrl = page.url()
  console.log('Final URL:', finalUrl)

  // Log ALL buttons
  const allButtons = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).map(b => ({ text: b.textContent?.trim(), class: b.className?.slice(0,60) })).filter(b => b.text && b.text.length < 60)
  )
  console.log('All buttons:', JSON.stringify(allButtons, null, 2))

  // Check specific degree indicator
  const degreeText = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('span'))
    return spans.filter(s => s.textContent?.includes('1st') || s.textContent?.includes('2nd') || s.textContent?.includes('3rd') || s.textContent?.includes('Connect')).map(s => s.textContent?.trim()).slice(0, 5)
  })
  console.log('Degree indicators:', degreeText)

  await browser.close()
}

async function main() {
  // Check one of the "false positive" leads
  const { data: leads } = await sb.from('campaign_leads')
    .select('id, lead:leads(full_name, linkedin_url)')
    .eq('campaign_id', 'c644a9b8-7df9-411f-95f7-dd9831abf34f')
    .limit(2)

  for (const cl of (leads || []).slice(0, 2)) {
    const lead = Array.isArray(cl.lead) ? cl.lead[0] : cl.lead
    if (lead?.linkedin_url) await checkProfile(lead.linkedin_url)
  }
}

main().catch(console.error)
