import { createClient } from '@supabase/supabase-js'
import { sessionCookiesToPlaywright } from '../lib/linkedin-cookie-auth'
import { chromium } from 'playwright'

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: acct } = await sb.from('linkedin_accounts')
    .select('id, email, session_cookies, password_encrypted')
    .eq('id', '67b75216-06b0-49b1-9470-234588fdba45')
    .single()

  const cookies = sessionCookiesToPlaywright(acct!.session_cookies)
  console.log('Cookies to inject:', cookies.map((c: any) => `${c.name}=${c.value.slice(0,15)}...`))
  
  console.log('\nLaunching browser...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  await context.addCookies(cookies)
  
  const page = await context.newPage()
  console.log('Navigating to /feed...')
  await page.goto('https://www.linkedin.com/feed', { waitUntil: 'domcontentloaded', timeout: 30000 })
  const url = page.url()
  console.log('Final URL:', url)
  console.log('Auth result:', url.includes('/feed') ? '✅ LOGGED IN' : '❌ NOT LOGGED IN — cookies expired or invalid')
  
  await browser.close()
}

main().catch(console.error)
